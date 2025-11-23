# backend/ai_integration_gemini.py
"""
AI integration module (Gemini / Google GenAI wrapper with robust fallbacks).

Simplified: returns only the AI response (parsed JSON when possible; otherwise raw model text).
Removed chart/graph/metric builders — kept redaction, robust GenAI invocation, JSON extraction,
and a compact heuristic fallback that returns a brief summary + evidence lines.
"""

import os
import re
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

logger = logging.getLogger("ai_integration_gemini")
if not logger.handlers:
    logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)

# Config from env (safe defaults)
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-1.5-mini")
GEMINI_MAX_TOKENS = int(os.getenv("GEMINI_MAX_TOKENS", "1200"))
MAX_LOG_CHARS = int(os.getenv("MAX_LOG_CHARS", "200000"))
LOG_DEFAULT_TZ = os.getenv("LOG_DEFAULT_TZ", "UTC")
MAX_EVENTS_IN_MEMORY = int(os.getenv("MAX_EVENTS_IN_MEMORY", "20000"))

# Try to import Google GenAI SDK (google-genai)
GENAI_CLIENT = None
_HAS_GENAI = False
try:
    from google import genai  # type: ignore
    try:
        if GEMINI_API_KEY:
            try:
                GENAI_CLIENT = genai.Client(api_key=GEMINI_API_KEY)
            except TypeError:
                os.environ.setdefault("GEMINI_API_KEY", GEMINI_API_KEY)
                GENAI_CLIENT = genai.Client()
        else:
            GENAI_CLIENT = genai.Client()
        _HAS_GENAI = True
        logger.info("Google GenAI SDK available. Model default=%s", GEMINI_MODEL)
    except Exception as e:
        logger.warning("Failed to initialize GenAI client (will fallback): %s", e)
        GENAI_CLIENT = None
        _HAS_GENAI = False
except Exception:
    GENAI_CLIENT = None
    _HAS_GENAI = False
    logger.info("google-genai SDK not installed; using heuristic fallback only. (pip install google-genai)")

# --------------------------
# Redaction / utils
# --------------------------
SECRET_PATTERNS = [
    r"(?i)(?:api[_-]?key|secret|authorization|bearer|token)[\s:=]+[A-Za-z0-9\-._~+/=]{8,}",
    r"(?i)password[\s:=]+[^,\n]+",
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    r"-----BEGIN PRIVATE KEY-----"
]
SECRET_REGEXES = [re.compile(p) for p in SECRET_PATTERNS]


def redact_text(text: Optional[str]) -> str:
    if not text:
        return ""
    out = text
    for rx in SECRET_REGEXES:
        out = rx.sub("[REDACTED]", out)
    out = re.sub(r"\s{3,}", " ", out)
    return out


# Prompt prefix (keeps original instructions)
PROMPT_PREFIX = r'''
You are an expert log analyst. A normal non-technical user uploaded these logs from their application.
Explain clearly in plain language what is wrong (if anything), why it happened, and how to fix it.
Return a single JSON object EXACTLY like this schema (fill in values -- human text OK inside values):

{
  "summary": "<string>",

  "issues_found": [
    {
      "title": "<string>",
      "why_it_happened": "<string>",
      "how_to_fix": "<string>",
      "severity": "<low|medium|high|critical>",
      "occurrences": <number>
    }
  ],

  "extra_insights": ["<string>", ...]
}

Rules:
- DO NOT output anything outside the JSON object.
- Redact secrets/PII using [REDACTED].
- Keep responses concise and actionable.
Now analyze the logs below and return that JSON only.
LOGS:
'''


# --------------------------
# Parsing helpers (kept minimal)
# --------------------------
TIMESTAMP_PATTERNS = [
    r"(?P<ts>\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d{1,6})?)",
    r"(?P<ts>\d{1,2}/\d{1,2}/\d{4}\s+\d{2}:\d{2}:\d{2})",
]
LEVEL_PATTERN = re.compile(r"\b(INFO|WARN|WARNING|ERROR|CRITICAL|DEBUG|TRACE)\b", re.IGNORECASE)


def parse_timestamp(ts_str: str) -> Optional[datetime]:
    formats = [
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S",
        "%m/%d/%Y %H:%M:%S",
    ]
    for f in formats:
        try:
            dt = datetime.strptime(ts_str.replace("T", " "), f)
            if dt.tzinfo is None:
                try:
                    return dt.replace(tzinfo=timezone.utc).astimezone(timezone.utc).replace(tzinfo=None)
                except Exception:
                    return dt
            return dt
        except Exception:
            continue
    return None


def extract_events_from_text(text: str) -> List[Dict[str, Any]]:
    events: List[Dict[str, Any]] = []
    lines = (text or "").splitlines()
    now = datetime.utcnow()
    fallback_index = 0
    for ln in lines[:MAX_EVENTS_IN_MEMORY]:
        ts = None
        stripped = ln.strip()
        # try to find timestamp pattern in line
        for pat in TIMESTAMP_PATTERNS:
            m = re.search(pat, ln)
            if m:
                ts_str = m.group("ts")
                ts = parse_timestamp(ts_str)
                if ts:
                    break
        if not ts:
            ts = now + timedelta(seconds=fallback_index)
            fallback_index += 1
        level_m = LEVEL_PATTERN.search(ln)
        level = level_m.group(1).upper() if level_m else None
        events.append({"ts": ts, "level": (level or "UNKNOWN"), "raw": ln})
    return events


# --------------------------
# Gemini / GenAI call wrapper (robust) - simplified behaviour retained
# --------------------------
def _call_gemini(prompt: str) -> Optional[str]:
    if not GENAI_CLIENT:
        logger.debug("No GenAI client available.")
        return None

    attempts_log = []

    def try_invoke(fn_desc: str, invoke_callable):
        try:
            attempts_log.append(fn_desc)
            resp = invoke_callable()
            return resp
        except TypeError as te:
            logger.warning("%s TypeError: %s", fn_desc, te)
            attempts_log.append(f"{fn_desc} TypeError: {te}")
            return None
        except Exception as e:
            logger.exception("%s failed: %s", fn_desc, e)
            attempts_log.append(f"{fn_desc} failed: {e}")
            return None

    def extract_text_from_response(response) -> Optional[str]:
        if response is None:
            return None
        out_texts = []
        for attr in ("text", "output_text"):
            t = getattr(response, attr, None)
            if t:
                if isinstance(t, list):
                    out_texts.extend([str(x) for x in t if x])
                else:
                    out_texts.append(str(t))
        out_attr = getattr(response, "output", None)
        if isinstance(out_attr, list):
            for item in out_attr:
                if isinstance(item, dict):
                    content = item.get("content") or item.get("text") or []
                else:
                    content = getattr(item, "content", None) or getattr(item, "text", None) or []
                if isinstance(content, list):
                    for part in content:
                        if isinstance(part, dict):
                            text_val = part.get("text") or part.get("content") or None
                            if isinstance(text_val, str):
                                out_texts.append(text_val)
                        elif isinstance(part, str):
                            out_texts.append(part)
                elif isinstance(content, str):
                    out_texts.append(content)
        cand = getattr(response, "candidates", None)
        if isinstance(cand, list):
            for c in cand:
                if isinstance(c, dict):
                    text_val = c.get("content") or c.get("text") or None
                    if text_val:
                        out_texts.append(str(text_val))
                else:
                    text_val = getattr(c, "content", None) or getattr(c, "text", None)
                    if text_val:
                        out_texts.append(str(text_val))
        if isinstance(response, dict):
            if "output_text" in response:
                return str(response["output_text"])
            try:
                return json.dumps(response)
            except Exception:
                return str(response)
        if out_texts:
            return " ".join(o.strip() for o in out_texts if o and isinstance(o, str)).strip()
        try:
            return str(response)
        except Exception:
            return None

    invocations = []

    invocations.append(("models.generate_content(contents, generationConfig)", lambda:
                        getattr(GENAI_CLIENT, "models").generate_content(
                            model=GEMINI_MODEL,
                            contents=prompt,
                            generationConfig={"maxOutputTokens": int(GEMINI_MAX_TOKENS), "temperature": 0.0}
                        ) if getattr(GENAI_CLIENT, "models", None) else None))

    invocations.append(("models.generate_content(contents, maxOutputTokens)", lambda:
                        getattr(GENAI_CLIENT, "models").generate_content(
                            model=GEMINI_MODEL,
                            contents=prompt,
                            maxOutputTokens=int(GEMINI_MAX_TOKENS)
                        ) if getattr(GENAI_CLIENT, "models", None) else None))

    invocations.append(("models.generate_content(content, max_output_tokens)", lambda:
                        getattr(GENAI_CLIENT, "models").generate_content(
                            model=GEMINI_MODEL,
                            content=prompt,
                            max_output_tokens=int(GEMINI_MAX_TOKENS)
                        ) if getattr(GENAI_CLIENT, "models", None) else None))

    invocations.append(("models.generate_content(input, max_output_tokens)", lambda:
                        getattr(GENAI_CLIENT, "models").generate_content(
                            model=GEMINI_MODEL,
                            input=prompt,
                            max_output_tokens=int(GEMINI_MAX_TOKENS)
                        ) if getattr(GENAI_CLIENT, "models", None) else None))

    if hasattr(GENAI_CLIENT, "responses"):
        invocations.append(("responses.create(model, input, max_output_tokens)", lambda:
                            GENAI_CLIENT.responses.create(model=GEMINI_MODEL, input=prompt, max_output_tokens=int(GEMINI_MAX_TOKENS))))

        invocations.append(("responses.create(model, input, maxOutputTokens)", lambda:
                            GENAI_CLIENT.responses.create(model=GEMINI_MODEL, input=prompt, maxOutputTokens=int(GEMINI_MAX_TOKENS))))

    if hasattr(GENAI_CLIENT, "generate"):
        invocations.append(("client.generate(model, prompt, max_output_tokens)", lambda:
                            GENAI_CLIENT.generate(model=GEMINI_MODEL, prompt=prompt, max_output_tokens=int(GEMINI_MAX_TOKENS))))
        invocations.append(("client.generate(model, prompt)", lambda:
                            GENAI_CLIENT.generate(model=GEMINI_MODEL, prompt=prompt)))

    invocations.append(("models.generate_content(contents)", lambda:
                        getattr(GENAI_CLIENT, "models").generate_content(
                            model=GEMINI_MODEL,
                            contents=prompt
                        ) if getattr(GENAI_CLIENT, "models", None) else None))

    for desc, inv in invocations:
        resp = try_invoke(desc, inv)
        if resp is not None:
            text = extract_text_from_response(resp)
            if text:
                logger.info("Gemini call succeeded with attempt: %s", desc)
                return text
            else:
                logger.warning("Gemini attempt %s returned no extractable text; continuing.", desc)

    logger.warning("All Gemini attempts failed. Attempts log: %s", attempts_log)
    return None


# --------------------------
# JSON extraction & cleaning
# --------------------------
def _find_best_json_substring(s: str) -> Optional[str]:
    if not s:
        return None
    candidates: List[Tuple[int, int, str]] = []
    starts = []
    for i, ch in enumerate(s):
        if ch == "{":
            starts.append(i)
        elif ch == "}":
            if starts:
                start = starts.pop()
                end = i
                candidates.append((start, end + 1, s[start:end + 1]))
    candidates = sorted(candidates, key=lambda t: (t[1] - t[0]), reverse=True)
    for start, end, substr in candidates:
        cleaned = substr.strip()
        try:
            json.loads(cleaned)
            return cleaned
        except Exception:
            maybe = _clean_json_like_string(cleaned)
            try:
                json.loads(maybe)
                return maybe
            except Exception:
                continue
    m = re.search(r"\{(?:.|\n)*\}", s)
    if m:
        cand = m.group(0)
        try:
            json.loads(cand)
            return cand
        except Exception:
            maybe = _clean_json_like_string(cand)
            try:
                json.loads(maybe)
                return maybe
            except Exception:
                return None
    return None


def _clean_json_like_string(s: str) -> str:
    t = s.strip()
    t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*```$", "", t, flags=re.IGNORECASE)
    first_brace = t.find("{")
    if first_brace > 0:
        t = t[first_brace:]
    t = re.sub(r"//.*?$", "", t, flags=re.MULTILINE)
    t = re.sub(r"/\*[\s\S]*?\*/", "", t)
    t = t.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    double_quote_count = t.count('"')
    single_quote_count = t.count("'")
    if double_quote_count < 2 and single_quote_count > 2:
        t = t.replace("'", '"')
    t = re.sub(r",\s*(\}|])", r"\1", t)
    t = re.sub(r",\s*,+", ",", t)
    t = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", t)
    return t


# --------------------------
# Compact heuristic fallback
# --------------------------
def fallback_analysis_from_redacted(redacted: str) -> Dict[str, Any]:
    """
    Return a small fallback dict: summary + evidence lines (no graphs or metrics).
    """
    events = extract_events_from_text(redacted)
    total_logs = len(events)
    # simple counts
    errors = sum(1 for e in events if e.get("level") and e["level"].upper().startswith("ERR"))
    warnings = sum(1 for e in events if e.get("level") and e["level"].upper().startswith("WARN"))
    summary = f"Analyzed {total_logs} lines. Found {errors} error-like lines and {warnings} warning-like lines."
    evidence = [e.get("raw") for e in events[:50] if e.get("raw")]
    return {"summary": summary, "evidence": evidence, "_source": "heuristic_fallback"}


# --------------------------
# Sample snippets (kept)
# --------------------------
def sample_snippets_from_events(events: List[Dict[str, Any]], max_snippets: int = 12, window: int = 4) -> List[Dict[str, Any]]:
    snippets = []
    error_indices = [i for i, e in enumerate(events) if (e.get("level") and e["level"].upper().startswith("ERR")) or ("exception" in (e.get("raw") or "").lower())]
    seen = set()
    if not error_indices:
        for i in range(max(0, len(events) - max_snippets), len(events)):
            snippets.append({"center_index": i, "timestamp": events[i]["ts"].isoformat() + "Z", "snippet": events[i]["raw"]})
        return snippets
    for idx in error_indices:
        start = max(0, idx - window)
        end = min(len(events), idx + window + 1)
        snippet_lines = [events[j]["raw"] for j in range(start, end)]
        snippet_text = "\n".join(snippet_lines)
        key = (events[idx]["ts"].isoformat(), snippet_text[:120])
        if key in seen:
            continue
        seen.add(key)
        snippets.append({"center_index": idx, "timestamp": events[idx]["ts"].isoformat() + "Z", "snippet": snippet_text})
        if len(snippets) >= max_snippets:
            break
    return snippets


# --------------------------
# Public analyze function (simplified output)
# --------------------------
def analyze_log_text(text: Optional[str], filename: str = "uploaded.log") -> Dict[str, Any]:
    raw_text = text or ""
    if not raw_text.strip():
        return fallback_analysis_from_redacted(raw_text)

    redacted = redact_text(raw_text)
    use_full_log = len(redacted) <= MAX_LOG_CHARS
    events = extract_events_from_text(redacted)
    logger.info("analyze_log_text: filename=%s total_events=%d sending_full_log=%s", filename, min(len(raw_text), 200), use_full_log)

    if not use_full_log:
        try:
            snippets = sample_snippets_from_events(events, max_snippets=12, window=4)
        except Exception:
            snippets = []
        snippets_text = "\n\n--- SNIPPET ---\n\n".join(f"[{s['timestamp']}]\n{s['snippet']}" for s in snippets)
        prompt_body = f"(NOTE: full log truncated; showing {len(snippets)} sampled snippets around errors/warnings)\n\n{snippets_text}"
    else:
        prompt_body = redacted

    full_prompt = PROMPT_PREFIX + "\n" + prompt_body + "\n"

    # Try GenAI
    try:
        gemini_out = _call_gemini(full_prompt) if _HAS_GENAI else None
        if gemini_out:
            # try to extract JSON substring
            candidate = None
            try:
                candidate = _find_best_json_substring(gemini_out)
            except Exception as e:
                logger.warning("Error while searching for JSON substring: %s", e)
                candidate = None

            if candidate:
                parsed = None
                try:
                    parsed = json.loads(candidate)
                except Exception:
                    try:
                        cleaned = _clean_json_like_string(candidate)
                        parsed = json.loads(cleaned)
                    except Exception as e:
                        logger.warning("Final JSON parse attempts failed: %s", e)
                        parsed = None

                if parsed and isinstance(parsed, dict):
                    # scrub textual fields
                    def scrub(o):
                        if isinstance(o, str):
                            return redact_text(o)
                        if isinstance(o, dict):
                            return {k: scrub(v) for k, v in o.items()}
                        if isinstance(o, list):
                            return [scrub(x) for x in o]
                        return o
                    parsed = scrub(parsed)
                    parsed["_source"] = "genai"
                    return parsed
                else:
                    # Return the full model text as summary (model returned something but we couldn't parse JSON)
                    return {"summary": redact_text(gemini_out), "_source": "genai_text"}
            else:
                # model returned text but no JSON substring: return text
                return {"summary": redact_text(gemini_out), "_source": "genai_text"}
        else:
            # no model output -> fallback
            return fallback_analysis_from_redacted(redacted)
    except Exception as e:
        logger.exception("Gemini wrapper failed (falling back): %s", e)
        return fallback_analysis_from_redacted(redacted)

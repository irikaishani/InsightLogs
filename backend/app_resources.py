# backend/app_resources.py  (or whatever path your router file is)
import os
import uuid
import json
import threading
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Body
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from fastapi.responses import JSONResponse, FileResponse
from db import get_db
from models import Upload, AnalysisJob, Report, LogEntry, User
from pydantic import BaseModel
import traceback
import concurrent.futures

AI_ANALYSIS_TIMEOUT_SECS = 80

# Attempt to import ai_integration if available (module local)
analyze_log_text = None
AI_INTEGRATION_AVAILABLE = False
try:
    try:
        # prefer ai_integration_gemini if present
        from ai_integration import analyze_log_text as _analyze
        analyze_log_text = _analyze
        AI_INTEGRATION_AVAILABLE = True
        logging.getLogger(__name__).info("Using ai_integration_gemini module for AI integration.")
    except Exception:
        from ai_integration import analyze_log_text as _analyze
        analyze_log_text = _analyze
        AI_INTEGRATION_AVAILABLE = True
        logging.getLogger(__name__).info("Using ai_integration module for AI integration.")
except Exception as e:
    analyze_log_text = None
    AI_INTEGRATION_AVAILABLE = False
    logging.getLogger(__name__).warning("ai_integration not available or failed to import: %s", e)

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", "data/uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Read allowed front-end origin from env (supports FRONTEND_ORIGIN or CORS_ALLOWED_ORIGINS)
_ALLOWED_ORIGIN_ENV = os.environ.get("FRONTEND_ORIGIN", "").strip() or os.environ.get("CORS_ALLOWED_ORIGINS", "").strip()
if not _ALLOWED_ORIGIN_ENV:
    # sensible default for your deployed frontend
    ALLOWED_CORS_ORIGIN = "https://insightlogs.onrender.com"
else:
    # if allowed list provided, pick the first origin (keep simple)
    ALLOWED_CORS_ORIGIN = [p.strip().rstrip("/") for p in _ALLOWED_ORIGIN_ENV.split(",") if p.strip()][0]

router = APIRouter(tags=["resources"])

# -------------------------
# Pydantic schemas (subset)
# -------------------------
class DashboardLastUpload(BaseModel):
    file_id: int
    name: str
    created_at: Optional[datetime]
    size: Optional[int]
    parsed_count: Optional[int]

class DashboardResponse(BaseModel):
    total_logs: int
    errors: int
    active_uploads: int
    recent_reports: List[Dict] = []
    last_upload: Optional[DashboardLastUpload] = None

class UploadResponse(BaseModel):
    upload_id: int
    job_id: int
    status: str

class JobStatusResponse(BaseModel):
    job_id: int
    status: str
    progress: int
    error: Optional[str] = None
    finished_at: Optional[datetime] = None

class LogEntryResponse(BaseModel):
    id: int
    timestamp: Optional[datetime]
    level: Optional[str]
    service: Optional[str]
    message: Optional[str]
    upload_id: Optional[int]        # <--- included for client convenience


class ReportResponse(BaseModel):
    id: int
    title: str
    summary: Optional[str]
    created_at: datetime

# Keep AnalyzeResponse for simple fallback; endpoints will return richer dict when available
class AnalyzeResponse(BaseModel):
    graph: Optional[Dict] = None
    suggestions: Optional[List[str]] = []


# -------------------------
# Background worker (adjusted: removed latency extraction)
# -------------------------
from db import SessionLocal  # for direct session in background threads

RESULTS_DIR = os.path.join(UPLOAD_DIR, "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

def _result_path_for_job(job_id: int) -> str:
    return os.path.join(RESULTS_DIR, f"job-{job_id}.json")

def save_job_result_to_file(job_id: int, payload: dict):
    p = _result_path_for_job(job_id)
    try:
        with open(p, "w", encoding="utf-8") as fh:
            json.dump(payload, fh)
    except Exception:
        logging.exception("Failed to save job result to file for job %s", job_id)

def load_job_result_from_file(job_id: int) -> Optional[dict]:
    p = _result_path_for_job(job_id)
    if not os.path.exists(p):
        return None
    try:
        with open(p, "r", encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        logging.exception("Failed to read job result file for job %s", job_id)
        return None

def process_job_in_thread(job_id: int):
    db = SessionLocal()
    try:
        job: AnalysisJob = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
        if not job:
            logging.getLogger(__name__).warning("process_job_in_thread: job not found %s", job_id)
            return

        logging.getLogger(__name__).info("process_job_in_thread: starting job_id=%s upload_id=%s user=%s", job.id, job.upload_id, job.user_email)

        # mark running
        job.status = "running"
        job.progress = 5
        db.commit()

        upload: Upload = db.query(Upload).filter(Upload.id == job.upload_id).first()
        if not upload:
            job.status = "failed"
            job.error = "Upload record missing"
            job.finished_at = datetime.utcnow()
            db.commit()
            logging.getLogger(__name__).error("process_job_in_thread: upload missing for job %s", job_id)
            return

        filepath = upload.storage_path
        logging.getLogger(__name__).info("process_job_in_thread: processing file path=%s", filepath)

        # initial counters
        parsed = 0
        errors_count = 0

        # try reading total lines for progress (best-effort)
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as fh:
                total_lines = sum(1 for _ in fh)
        except Exception as e:
            job.status = "failed"
            job.error = f"Failed to read upload file: {e}"
            job.finished_at = datetime.utcnow()
            db.commit()
            logging.getLogger(__name__).exception("process_job_in_thread: cannot read file %s: %s", filepath, e)
            return

        processed = 0
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as fh:
                for line in fh:
                    # keep an upper bound to avoid huge immediate inserts
                    if processed >= 1000:
                        break

                    line_stripped = line.strip()
                    if not line_stripped:
                        continue

                    # parse JSON if possible
                    parsed_json = None
                    try:
                        parsed_json = json.loads(line_stripped)
                    except Exception:
                        parsed_json = None

                    timestamp = None
                    level = None
                    service = None
                    message = None
                    if isinstance(parsed_json, dict):
                        timestamp_raw = parsed_json.get("timestamp") or parsed_json.get("time") or parsed_json.get("@timestamp")
                        if timestamp_raw:
                            try:
                                timestamp = datetime.fromisoformat(str(timestamp_raw).replace("Z", "+00:00"))
                            except Exception:
                                timestamp = None
                        level = parsed_json.get("level") or parsed_json.get("severity")
                        service = parsed_json.get("service") or parsed_json.get("name")
                        message = parsed_json.get("message") or parsed_json.get("msg") or json.dumps(parsed_json)
                    else:
                        message = line_stripped

                    # simple error detection
                    if level and isinstance(level, str) and level.lower().startswith("err"):
                        errors_count += 1
                    elif "error" in (message or "").lower():
                        errors_count += 1

                    # ---------- DEDUPE CHECK (simple, safe) ----------
                    raw_trunc = line_stripped[:8000]

                    try:
                        exists = db.query(LogEntry).filter(
                            LogEntry.upload_id == upload.id,
                            LogEntry.user_email == job.user_email,
                            LogEntry.raw == raw_trunc
                        ).first()
                    except Exception as e:
                        logging.getLogger(__name__).exception("process_job_in_thread: dedupe select failed: %s", e)
                        exists = None

                    if exists:
                        # already present -> skip insertion
                        processed += 1
                        # keep parsed as unique lines count; do not increment parsed here
                        # update progress occasionally
                        if processed % 50 == 0:
                            try:
                                job.progress = min(90, int((processed / max(1, total_lines)) * 80) + 10)
                                db.commit()
                            except Exception:
                                db.rollback()
                        continue

                    # ---------- INSERT (only when not duplicate) ----------
                    le = LogEntry(
                        user_email=job.user_email,
                        upload_id=upload.id,
                        timestamp=timestamp,
                        level=(level or "").upper() if level else None,
                        service=service,
                        message=(message[:4000] if message else None),
                        raw=raw_trunc,
                    )
                    db.add(le)
                    parsed += 1
                    processed += 1

                    # commit in batches to avoid long transactions and update progress
                    if processed % 50 == 0:
                        try:
                            db.commit()
                        except Exception:
                            db.rollback()
                        try:
                            job.progress = min(90, int((processed / max(1, total_lines)) * 80) + 10)
                            db.commit()
                        except Exception:
                            db.rollback()

            # final commit after loop
            try:
                db.commit()
            except Exception:
                db.rollback()

        except Exception as e:
            logging.getLogger(__name__).exception("process_job_in_thread: parsing loop failed: %s", e)
            # continue - we'll still attempt AI/fallback and finalize job

        logging.getLogger(__name__).info("process_job_in_thread: finished parsing (unique_parsed=%d approximate_errors=%d)", parsed, errors_count)

        # optional: update upload.parsed_count so UI shows correct counts (best-effort)
        try:
            if hasattr(upload, "parsed_count"):
                upload.parsed_count = (upload.parsed_count or 0) + parsed
                db.commit()
        except Exception:
            db.rollback()

        # --- Prepare a small sample for AI (first ~200 lines) ---
        sample_lines = []
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as fh:
                for i, raw_line in enumerate(fh):
                    if i >= 200:
                        break
                    sample_lines.append(raw_line.rstrip("\n"))
        except Exception:
            sample_lines = []
        txt_sample = "\n".join(sample_lines)

        # --- Run AI with a short per-call timeout; if it fails, run fallback ---
        ai_result = None
        ai_error = None
        if AI_INTEGRATION_AVAILABLE and analyze_log_text:
            AI_CALL_TIMEOUT = 25  # seconds; tune as needed
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as ex:
                fut = ex.submit(lambda: analyze_log_text(txt_sample, filename=upload.filename))
                try:
                    ai_result = fut.result(timeout=AI_CALL_TIMEOUT)
                except concurrent.futures.TimeoutError:
                    ai_error = f"AI call timed out after {AI_CALL_TIMEOUT}s"
                    logging.getLogger(__name__).warning("process_job_in_thread: ai call timed out for job %s", job.id)
                except Exception as e:
                    logging.getLogger(__name__).exception("process_job_in_thread: AI call raised: %s", e)
                    ai_error = str(e)

        # If AI didn't return dict, use heuristic fallback (so UI always gets something)
        final_result = None
        if isinstance(ai_result, dict):
            final_result = ai_result
        else:
            try:
                from ai_integration import redact_text, fallback_analysis_from_redacted
                redacted = redact_text(txt_sample)
                fallback = fallback_analysis_from_redacted(redacted)
                if isinstance(fallback, dict):
                    fallback["_source"] = fallback.get("_source", "heuristic_fallback")
                    final_result = fallback
                else:
                    final_result = {"summary": "Fallback produced non-dict result", "source": "heuristic_fallback"}
            except Exception:
                logging.getLogger(__name__).exception("process_job_in_thread: Fallback heuristic failed")
                final_result = {"summary": "No AI result and fallback failed", "error": ai_error or "no ai and fallback failed", "source": "none"}

        # --- Save final_result to disk and set job.result_path + mark job done ---
        try:
            final_payload = {
                "job_id": job.id,
                "generated_at": datetime.utcnow().isoformat() + "Z",
                "result": final_result
            }
            save_job_result_to_file(job.id, final_payload)
            job.result_path = _result_path_for_job(job.id)
            job.status = "done"
            job.progress = 100
            job.finished_at = datetime.utcnow()
            db.commit()
            logging.getLogger(__name__).info("process_job_in_thread: job %s complete; result_path=%s", job.id, job.result_path)
        except Exception as e:
            logging.getLogger(__name__).exception("process_job_in_thread: Failed to save job result: %s", e)
            job.status = "failed"
            job.error = f"failed to save result: {e}"
            job.finished_at = datetime.utcnow()
            db.commit()

        # optional: create a small Report row (best-effort)
        try:
            summary_parts = [
                f"Parsed {parsed} unique lines from file {upload.filename}.",
                f"Detected ~{errors_count} error-like messages.",
            ]
            summary = "\n".join(summary_parts)
            report = Report(job_id=job.id, user_email=job.user_email, title=f"Report for {upload.filename}", summary=summary)
            db.add(report)
            db.commit()
            db.refresh(report)
        except Exception:
            logging.getLogger(__name__).exception("process_job_in_thread: Failed to create report row")

    except Exception as e:
        logging.getLogger(__name__).exception("process_job_in_thread: Unexpected failure: %s", e)
        try:
            job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error = str(e)
                job.finished_at = datetime.utcnow()
                db.commit()
        except Exception:
            pass
    finally:
        db.close()


def enqueue_job(job_id: int):
    t = threading.Thread(target=process_job_in_thread, args=(job_id,), daemon=True)
    t.start()


# -------------------------
# Endpoints (adjusted: removed latency computations)
# -------------------------
from auth import get_current_active_user  # import dependency

@router.get("/dashboard", response_model=DashboardResponse)
def get_dashboard(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """
    Dashboard summary (keeps original response model).
    Improved error detection and robust active_uploads computation.
    """
    logging.getLogger(__name__).info("GET /dashboard called by user: %s", getattr(current_user, "email", None))

    user_email = getattr(current_user, "email", None)
    if not user_email:
        return DashboardResponse(
            total_logs=0,
            errors=0,
            active_uploads=0,
            recent_reports=[],
            last_upload=None,
        )

    logger = logging.getLogger(__name__)

    # total_logs (simple, defensive)
    try:
        total_logs = db.query(func.count()).select_from(LogEntry).filter(LogEntry.user_email == user_email).scalar() or 0
    except Exception:
        logger.exception("Counting total_logs failed")
        total_logs = 0

    # ---- errors: robust detection using level OR message keywords ----
    errors = 0
    try:
        # normalize level and message: trim + lower + coalesce to avoid NULLs
        lvl_expr = func.lower(func.trim(func.coalesce(LogEntry.level, "")))
        msg_expr = func.lower(func.coalesce(LogEntry.message, ""))

        # level starts with 'err' (covers "ERR", "ERROR", "Err:", "ERROR: ...")
        cond_level = lvl_expr.like("err%")
        # message contains common error words (covers logs without level)
        cond_msg = or_(
            msg_expr.like("%error%"),
            msg_expr.like("%exception%"),
            msg_expr.like("%traceback%")
        )

        # count distinct ids so rows matching both aren't double-counted
        errors = (
            db.query(func.count(func.distinct(LogEntry.id)))
            .filter(LogEntry.user_email == user_email)
            .filter(or_(cond_level, cond_msg))
            .scalar() or 0
        )
    except Exception:
        # fallback: simpler prefix match on trimmed uppercase level
        try:
            errors = db.query(func.count()).select_from(LogEntry).filter(
                LogEntry.user_email == user_email,
                func.upper(func.coalesce(func.trim(LogEntry.level), "")) .like("ERROR%")
            ).scalar() or 0
        except Exception:
            logger.exception("Counting errors failed (fallback)")
            errors = 0

    # ---- active_uploads: tolerant check for queued/running ----
    active_uploads = 0
    try:
        active_uploads = db.query(func.count()).select_from(AnalysisJob).filter(
            AnalysisJob.user_email == user_email,
            func.lower(func.coalesce(AnalysisJob.status, "")) .in_(["queued", "running"])
        ).scalar() or 0
    except Exception:
        try:
            queued = db.query(func.count()).select_from(AnalysisJob).filter(
                AnalysisJob.user_email == user_email,
                func.lower(func.coalesce(AnalysisJob.status, "")) == "queued"
            ).scalar() or 0
            running = db.query(func.count()).select_from(AnalysisJob).filter(
                AnalysisJob.user_email == user_email,
                func.lower(func.coalesce(AnalysisJob.status, "")) == "running"
            ).scalar() or 0
            active_uploads = queued + running
        except Exception:
            logger.exception("Counting active_uploads failed")
            active_uploads = 0

    # recent_reports (unchanged but defensive)
    recent_reports = []
    try:
        recent_reports_q = db.query(Report).filter(Report.user_email == user_email).order_by(Report.created_at.desc()).limit(5).all()
        recent_reports = [{"id": r.id, "title": r.title, "created_at": r.created_at.isoformat() if r.created_at else None} for r in recent_reports_q]
    except Exception:
        logger.exception("Fetching recent_reports failed")
        recent_reports = []

    # last_upload (unchanged but defensive)
    last_upload = None
    try:
        last_upload_row = db.query(Upload).filter(Upload.user_email == user_email).order_by(Upload.created_at.desc()).first()
        if last_upload_row:
            last_upload = {
                "file_id": last_upload_row.id,
                "name": last_upload_row.filename,
                "created_at": last_upload_row.created_at.isoformat() if last_upload_row.created_at else None,
                "size": last_upload_row.size,
                "parsed_count": last_upload_row.parsed_count or 0,
            }
    except Exception:
        logger.exception("Fetching last_upload failed")
        last_upload = None

    logger.info(
        "dashboard counts for user=%s total_logs=%s errors=%s active_uploads=%s recent_reports=%d last_upload=%s",
        user_email, total_logs, errors, active_uploads, len(recent_reports), bool(last_upload)
    )

    return DashboardResponse(
        total_logs=total_logs,
        errors=errors,
        active_uploads=active_uploads,
        recent_reports=recent_reports,
        last_upload=last_upload,
    )


@router.post("/upload", response_model=UploadResponse)
def upload_file(file: UploadFile = File(...), current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    filename = file.filename or f"upload-{uuid.uuid4().hex}.log"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".log", ".txt", ".json", ".jsonl"]:
        logging.getLogger(__name__).warning("Uploading file with unusual extension: %s", ext)

    unique_name = f"{datetime.utcnow().strftime('%Y%m%dT%H%M%S')}-{uuid.uuid4().hex[:8]}-{filename}"
    path = os.path.join(UPLOAD_DIR, unique_name)
    try:
        with open(path, "wb") as fh:
            contents = file.file.read()
            fh.write(contents)
            size = len(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    upload = Upload(user_email=current_user.email, filename=filename, storage_path=path, size=size)
    db.add(upload)
    db.commit()
    db.refresh(upload)

    job = AnalysisJob(upload_id=upload.id, user_email=current_user.email, status="queued", progress=0)
    db.add(job)
    db.commit()
    db.refresh(job)

    enqueue_job(job.id)
    return UploadResponse(upload_id=upload.id, job_id=job.id, status=job.status)

@router.get("/uploads")
def list_uploads(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    q = db.query(Upload).filter(Upload.user_email == current_user.email).order_by(Upload.created_at.desc()).all()
    out = []
    for u in q:
        out.append({"id": u.id, "name": u.filename, "created_at": u.created_at.isoformat() if u.created_at else None, "size": u.size, "parsed_count": u.parsed_count})
    return out

# -------------------------
# Serve uploaded file with explicit CORS headers (unchanged)
# -------------------------
@router.get("/uploads/{upload_id}")
def serve_upload_file(upload_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    """
    Serve the actual uploaded file (FileResponse) and ensure CORS headers are present
    so browser clients from the frontend origin can fetch the file.
    """
    upload = db.query(Upload).filter(Upload.id == upload_id, Upload.user_email == current_user.email).first()
    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    file_path = getattr(upload, "storage_path", None)
    if not file_path or not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Stored file not found")

    try:
        response = FileResponse(file_path, media_type="application/octet-stream", filename=upload.filename)
        # Add CORS headers explicitly (FileResponse bypasses some middleware)
        response.headers["Access-Control-Allow-Origin"] = ALLOWED_CORS_ORIGIN
        response.headers["Access-Control-Allow-Credentials"] = "true"
        # you can add more headers if needed
        response.headers["Access-Control-Expose-Headers"] = "Content-Disposition,Content-Length"
        return response
    except Exception as e:
        logging.getLogger(__name__).exception("serve_upload_file: failed to serve file %s: %s", file_path, e)
        raise HTTPException(status_code=500, detail="Failed to serve file")

@router.get("/files/last")
def get_last_file(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    logging.getLogger(__name__).info("GET /files/last requested by user=%s", getattr(current_user, "email", None))
    u = db.query(Upload).filter(Upload.user_email == current_user.email).order_by(Upload.created_at.desc()).first()
    if not u:
        logging.getLogger(__name__).info("No uploads found for user=%s", getattr(current_user, "email", None))
        raise HTTPException(status_code=404, detail="No uploads found")
    logging.getLogger(__name__).info("Found last upload id=%s name=%s for user=%s", u.id, u.filename, getattr(current_user, "email", None))
    return {"file_id": u.id, "name": u.filename, "created_at": u.created_at.isoformat() if u.created_at else None, "size": u.size, "parsed_count": u.parsed_count}

@router.get("/analysis/{job_id}", response_model=JobStatusResponse)
def get_job_status(job_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id, AnalysisJob.user_email == current_user.email).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobStatusResponse(job_id=job.id, status=job.status, progress=job.progress, error=job.error, finished_at=job.finished_at)

@router.get("/logs", response_model=List[LogEntryResponse])
def get_logs(
    limit: int = 200,
    upload_id: Optional[int] = None,
    level: Optional[str] = None,
    q: Optional[str] = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
    
):
    try:
        limit = max(1, min(int(limit), 10000))
    except Exception:
        limit = 200

    logging.getLogger(__name__).debug("GET /logs params: limit=%s upload_id=%s level=%s q=%s user=%s",
                                      limit, upload_id, level, q, getattr(current_user, "email", None))

    query = db.query(LogEntry).filter(LogEntry.user_email == current_user.email)

    if upload_id is not None and str(upload_id).strip() != "":
        try:
            uid = int(upload_id)
            query = query.filter(LogEntry.upload_id == uid)
        except Exception:
            pass

        # optional level filter (case-insensitive, prefix-match to be more permissive)
    if level and level.strip() != "":
        lvl = level.strip().upper()
        # allow exact or prefix matches like "ERROR", "ERR", "ERROR:Something"
        try:
            query = query.filter(func.upper(func.coalesce(LogEntry.level, "")).like(f"{lvl}%"))
        except Exception:
            # fallback to safer equality if DB backend doesn't support LIKE in this context
            query = query.filter(func.upper(func.coalesce(LogEntry.level, "")) == lvl)


    if q and q.strip() != "":
        likepat = f"%{q.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(func.coalesce(LogEntry.message, "")) .like(likepat),
                func.lower(func.coalesce(LogEntry.service, "")) .like(likepat),
                func.lower(func.coalesce(LogEntry.raw, "")) .like(likepat),
            )
        )

    rows = query.order_by(LogEntry.created_at.desc()).limit(limit).all()

    out = []
    for l in rows:
        out.append(
            LogEntryResponse(
                id=l.id,
                timestamp=l.timestamp,
                level=l.level,
                service=l.service,
                message=(l.message[:1000] if l.message else None),
                upload_id=l.upload_id 
            )
        )
    return out

@router.get("/reports", response_model=List[ReportResponse])
def list_reports(current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    q = db.query(Report).filter(Report.user_email == current_user.email).order_by(Report.created_at.desc()).all()
    return [ReportResponse(id=r.id, title=r.title, summary=r.summary, created_at=r.created_at) for r in q]

@router.get("/reports/{report_id}", response_model=ReportResponse)
def get_report(report_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    r = db.query(Report).filter(Report.id == report_id, Report.user_email == current_user.email).first()
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")
    return ReportResponse(id=r.id, title=r.title, summary=r.summary, created_at=r.created_at)

@router.patch("/profile", response_model=dict)
def update_profile(payload: dict, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    if not payload or not isinstance(payload, dict) or len(payload) == 0:
        raise HTTPException(status_code=400, detail="Nothing to update")

    PROTECTED = {"id", "email", "password", "created_at", "updated_at"}

    user_columns = set([c.name for c in User.__table__.columns]) if hasattr(User, "__table__") else set()
    updates = {}
    for key, value in payload.items():
        if key in PROTECTED:
            continue
        if key not in user_columns:
            continue
        if isinstance(value, str):
            v = value.strip()
            if len(v) > 2000:
                raise HTTPException(status_code=400, detail=f"Field '{key}' is too long")
            updates[key] = v
        else:
            updates[key] = value

    if not updates:
        raise HTTPException(status_code=400, detail="No valid profile fields to update")

    u = db.query(User).filter(User.id == current_user.id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    for k, v in updates.items():
        try:
            setattr(u, k, v)
        except Exception as e:
            logging.getLogger(__name__).warning("Skipping update for %s: %s", k, e)

    db.commit()
    db.refresh(u)

    out = {}
    for col in user_columns:
        if col in {"password"}:
            continue
        out[col] = getattr(u, col)
    return out


@router.post("/ai/analyze")
def ai_analyze(
    payload: dict = Body(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    file_id = payload.get("file_id")
    if not file_id:
        raise HTTPException(status_code=400, detail="file_id required")

    # Validate upload belongs to user
    upload = db.query(Upload).filter(
        Upload.id == file_id,
        Upload.user_email == current_user.email
    ).first()

    if not upload:
        raise HTTPException(status_code=404, detail="Upload not found")

    # Create a NEW AnalysisJob row
    job = AnalysisJob(
        upload_id=upload.id,
        user_email=current_user.email,
        status="queued",
        progress=0
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Trigger background worker
    enqueue_job(job.id)

    # IMPORTANT: return only job_id, status, message
    return JSONResponse(
        status_code=202,
        content={
            "job_id": job.id,
            "status": "queued",
            "message": "Analysis started in background"
        }
    )

@router.post("/ai/query", response_model=AnalyzeResponse)
def ai_query(payload: dict = Body(...), current_user: User = Depends(get_current_active_user)):
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text required")

    suggestions = []
    graph = {"values": []}
    try:
        if AI_INTEGRATION_AVAILABLE and analyze_log_text:
            parsed = analyze_log_text(text, filename="query.txt")
            if isinstance(parsed, dict):
                probs = parsed.get("issues_found", []) or []
                ins = parsed.get("extra_insights", []) or []
                for p in probs:
                    title = p.get("title") if isinstance(p, dict) else str(p)
                    fix = p.get("how_to_fix") if isinstance(p, dict) else None
                    suggestions.append((title + (f": {fix}" if fix else "")).strip())
                for ii in ins:
                    title = ii if isinstance(ii, str) else (ii.get("title") if isinstance(ii, dict) else str(ii))
                    suggestions.append(title)
        else:
            if "error" in text.lower() or "exception" in text.lower():
                suggestions.append("Text includes error keywords — consider running full analysis on the related logs.")
            else:
                suggestions.append("No obvious issues detected by lightweight analysis.")
    except Exception as e:
        logging.exception("AI query failed: %s", e)
        suggestions.append("AI analysis failed (internal).")

    return AnalyzeResponse(graph=graph, suggestions=suggestions)

@router.get("/ai/analyze/result/{job_id}")
def ai_analyze_result(job_id: int, current_user: User = Depends(get_current_active_user), db: Session = Depends(get_db)):
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id, AnalysisJob.user_email == current_user.email).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # prefer reading result_path saved on job
    if getattr(job, "result_path", None):
        try:
            with open(job.result_path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
                return data
        except Exception:
            logging.exception("Failed to load job result from path: %s", job.result_path)

    # fallback: try results dir loader
    result = load_job_result_from_file(job_id)
    if result:
        return result

    # if result not ready yet
    raise HTTPException(status_code=404, detail="Result not ready")

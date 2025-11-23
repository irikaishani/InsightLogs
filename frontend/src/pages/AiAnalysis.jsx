// src/pages/AiAnalysis.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../shared/Card";
import { API_BASE } from "../firebasework/firebaseconfig";

/* Helpers (unchanged) */
function getAuthToken() {
  return localStorage.getItem("token") || sessionStorage.getItem("access_token") || null;
}

function headers(token) {
  const h = { "Content-Type": "application/json", Accept: "application/json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

function ISOtoLabel(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString();
  } catch {
    return iso;
  }
}

/* Compact ripple loader (keeps previous style) */
function LoadingRipples({ size = "md", colorClass = "bg-[#60a5fa]", ariaLabel = "Loading" }) {
  const sizeMap = {
    sm: { wrapper: "w-8 h-8", ring: "w-8 h-8", scale: 0.9 },
    md: { wrapper: "w-10 h-10", ring: "w-10 h-10", scale: 1 },
    lg: { wrapper: "w-12 h-12", ring: "w-12 h-12", scale: 1.15 },
  };
  const cfg = sizeMap[size] || sizeMap.md;

  return (
    <span role="status" aria-live="polite" aria-label={ariaLabel} className="inline-flex items-center">
      <span className="sr-only">{ariaLabel}</span>

      <style>{`
        @keyframes rippleExpand {
          0% { transform: scale(0.2); opacity: 0.9; }
          60% { transform: scale(0.9); opacity: 0.5; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        @keyframes innerPulse {
          0% { transform: scale(0.95); opacity: 0.95; }
          50% { transform: scale(1.05); opacity: 0.7; }
          100% { transform: scale(0.95); opacity: 0.95; }
        }
        .ripple-ring { border-radius: 9999px; box-shadow: 0 0 18px rgba(96,165,250,0.12); }
      `}</style>

      <span className={`${cfg.wrapper} relative flex items-center justify-center`} aria-hidden="true" style={{ transform: `scale(${cfg.scale})` }}>
        <span
          className={`absolute ${cfg.ring} rounded-full ripple-ring ${colorClass}`}
          style={{
            opacity: 0,
            filter: "blur(6px)",
            animation: "rippleExpand 1.2s cubic-bezier(.2,.8,.2,1) infinite",
            animationDelay: "0s",
            mixBlendMode: "screen",
          }}
        />
        <span
          className={`absolute ${cfg.ring} rounded-full ripple-ring ${colorClass}`}
          style={{
            opacity: 0,
            filter: "blur(6px)",
            animation: "rippleExpand 1.2s cubic-bezier(.2,.8,.2,1) infinite",
            animationDelay: "0.36s",
            mixBlendMode: "screen",
          }}
        />
        <span
          className={`relative inline-block ${cfg.ring} rounded-full ${colorClass}`}
          style={{
            width: "42%",
            height: "42%",
            boxShadow: "0 0 10px rgba(96,165,250,0.25)",
            animation: "innerPulse 1.2s ease-in-out infinite",
            display: "inline-block",
          }}
        />
      </span>
    </span>
  );
}

/* Copy helper stays the same */
const copySteps = (steps) => {
  try {
    const txt = (steps || []).map((s, i) => `${i + 1}. ${s}`).join("\n");
    navigator.clipboard.writeText(txt);
    alert("Steps copied to clipboard");
  } catch {
    alert("Copy failed");
  }
};

/* New: download helper */
async function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/* Main component (logic preserved; UI reorganized) */
export default function AiAnalysis() {
  const token = getAuthToken();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [lastFileId, setLastFileId] = useState(null);
  const [pendingJob, setPendingJob] = useState(null); // { jobId, status, message, lastChecked }
  const mountedRef = useRef(true);
  const pollRef = useRef(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    (async () => {
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/files/last`, {
          method: "GET",
          headers: { "Accept": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }
        });
        if (!res.ok) {
          if (res.status === 404) {
            setLastFileId(null);
            return;
          }
          const txt = await res.text();
          throw new Error(txt || `${res.status} ${res.statusText}`);
        }
        const j = await res.json();
        const fid = j?.file_id || j?.id || null;
        if (fid) {
          setLastFileId(fid);
          // do NOT auto-run analysis here — user will click Start.
        } else {
          setLastFileId(null);
        }
      } catch (err) {
        console.warn("fetch last file failed:", err);
        setLastFileId(null);
        if (mountedRef.current) setError(typeof err.message === "string" ? err.message : "Failed to fetch last file");
      }
    })();
  }, []); // run once


  const onClickUpload = () => navigate("/uploads");
  const onClickViewLast = () => {
    if (lastFileId) runAnalysisForFile(lastFileId);
    else setError("No uploaded file found. Upload first.");
  };

  // ----- analyze + polling (unchanged) -----
  const runAnalysisForFile = async (fileId, { clientTimeout = 15000 } = {}) => {
    if (!fileId) {
      setError("No file id provided");
      return;
    }
    setError(null);
    setAnalysis(null);
    setEvidenceOpen(false);
    setPendingJob(null);
    setLoading(true);

    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), clientTimeout);

    try {
      const res = await fetch(`${API_BASE}/ai/analyze`, {
        method: "POST",
        headers: headers(token),
        body: JSON.stringify({ file_id: fileId }),
        signal: ac.signal,
      });

      clearTimeout(timer);

      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = null; }

      if (res.status === 202) {
        const jobId = (body && (body.job_id || body.job)) || null;
        setPendingJob({ jobId, status: "queued", message: body?.message || "Queued for analysis", lastChecked: new Date().toISOString() });
        setLoading(false);
        if (jobId) pollJobStatus(jobId);
        else setError("Analysis queued but server returned no job id");
        return;
      }

      if (res.ok) {
        const result = body ?? (text ? { summary: text } : null);
        if (mountedRef.current) setAnalysis(result);
        return;
      }

      const errMsg = (body && (body.detail || body.error || body.message)) || text || `${res.status} ${res.statusText}`;
      throw new Error(errMsg);
    } catch (err) {
      if (err.name === "AbortError") {
        setError("Request timed out. Analysis will continue on server; check job status if available.");
      } else {
        setError(err.message || String(err));
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const pollJobStatus = (jobId, { intervalMs = 5000, maxAttempts = 120 } = {}) => {

    if (!jobId) {
      setError("No job id to poll");
      return;
    }
    if (pollRef.current) clearInterval(pollRef.current);
    let attempts = 0;

    const doPoll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`${API_BASE}/analysis/${jobId}`, { method: "GET", headers: headers(token) });
        const text = await res.text();
        let body = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = null; }

        if (!res.ok) {
          const msg = (body && (body.detail || body.error || body.message)) || text || `${res.status} ${res.statusText}`;
          setError(`Polling error: ${msg}`);
          clearInterval(pollRef.current); pollRef.current = null;
          return;
        }

        const status = (body && (body.status || body.state)) || "unknown";
        if (mountedRef.current) setPendingJob(prev => ({ ...(prev || {}), jobId, status, lastChecked: new Date().toISOString(), message: body?.error || body?.message || prev?.message || null }));

        if (status === "done" || status === "succeeded" || status === "complete") {
          try {
            const rres = await fetch(`${API_BASE}/ai/analyze/result/${jobId}`, { method: "GET", headers: headers(token) });
            const rtext = await rres.text();
            let rbody = null;
            try { rbody = rtext ? JSON.parse(rtext) : null; } catch { rbody = null; }

            if (rres.ok && rbody) {
              setAnalysis(rbody);
            } else if (rres.ok && !rbody) {
              setAnalysis({ summary: rtext });
            } else {
              setError((rbody && (rbody.detail || rbody.error)) || rtext || `Result fetch returned ${rres.status}`);
            }
          } catch (e) {
            setError(`Failed to fetch analysis result: ${e.message || e}`);
          } finally {
            if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
            if (mountedRef.current) setLoading(false);
            setPendingJob(prev => prev ? ({ ...prev, status: "done" }) : { jobId, status: "done" });
          }
          return;
        }

        if (status === "failed" || status === "error") {
          setError(body?.error || body?.message || "Analysis job failed on server");
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          if (mountedRef.current) setLoading(false);
          return;
        }

        if (attempts >= maxAttempts) {
          setError("Polling timed out (max attempts). Analysis may still be running on server.");
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
          return;
        }
      } catch (err) {
        setError(`Polling network error: ${err.message || String(err)}`);
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        if (mountedRef.current) setLoading(false);
      }
    };

    doPoll();
    pollRef.current = setInterval(doPoll, intervalMs);
  };

  const cancelPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
      setPendingJob(prev => prev ? ({ ...prev, status: "cancelled" }) : null);
      setError("Polling cancelled by user.");
      setLoading(false);
    }
  };

  // Guarded start: prevents starting another job if one is already queued/running.
  const startAnalysis = async () => {
    setError(null);
    if (!lastFileId) {
      setError("No uploaded file found. Upload first.");
      return;
    }
    // If we already have a pending job that's not done/cancelled, don't start a new one
    if (pendingJob && pendingJob.status && pendingJob.status !== "done" && pendingJob.status !== "cancelled") {
      setError("An analysis is already queued or running for this upload. Please wait or cancel the existing job.");
      return;
    }
    // Keep UI responsive
    setLoading(true);
    try {
      await runAnalysisForFile(lastFileId);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };


  // ----- NEW: download action -----
  const onDownloadAnalysis = async () => {
    try {
      if (analysis) {
        const filename = `analysis-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        await downloadJSON(filename, analysis);
        return;
      }

      // no analysis loaded; try to fetch result if job id present
      const jobId = pendingJob?.jobId || null;
      if (!jobId) {
        alert("No analysis available to download.");
        return;
      }

      // attempt to fetch result from server
      const res = await fetch(`${API_BASE}/ai/analyze/result/${jobId}`, { method: "GET", headers: headers(token) });
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = null; }

      if (!res.ok) {
        const msg = (body && (body.detail || body.error || body.message)) || text || `${res.status} ${res.statusText}`;
        alert(`Failed to fetch analysis: ${msg}`);
        return;
      }

      const obj = body ?? (text ? { summary: text } : {});
      const filename = `analysis-${jobId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
      await downloadJSON(filename, obj);
    } catch (e) {
      alert(`Download failed: ${e?.message || e}`);
    }
  };

  // ----- UI render (Quick Insights removed, Start button moved below paragraph) -----
  const startDisabled = !lastFileId || loading || (pendingJob && pendingJob.status && pendingJob.status !== "done" && pendingJob.status !== "cancelled");

  return (
    <div className="min-h-screen p-6 bg-[#060712]">
      <header className="flex items-start justify-between mb-6 gap-6">
        <div className="flex-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-[#93c5fd]">AI Analysis</h1>
          <p className="text-sm text-gray-300 mt-1 max-w-xl">
            Analysis of the most recent uploaded log. Clear recommendations and evidence are shown below — no noisy charts, just actionable findings.
          </p>

          {/* NEW: prominent Start analysis button placed directly under the paragraph */}
          <div className="mt-5">
            <style>{`
              @keyframes floatIn {
                0% { transform: translateY(8px) scale(0.98); opacity: 0; }
                60% { transform: translateY(-4px) scale(1.02); opacity: 1; }
                100% { transform: translateY(0) scale(1); opacity: 1; }
              }
              @keyframes subtleGlow {
                0% { box-shadow: 0 6px 20px rgba(14,165,233,0.06); }
                50% { box-shadow: 0 12px 30px rgba(14,165,233,0.10); }
                100% { box-shadow: 0 6px 20px rgba(14,165,233,0.06); }
              }
            `}</style>

            <button
              onClick={startAnalysis}
              disabled={startDisabled}
              aria-disabled={startDisabled}
              className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl text-black font-semibold transform transition duration-200 ease-out
                ${startDisabled ? "opacity-70 cursor-not-allowed" : "hover:scale-105 active:scale-98"}
              `}
              style={{
                background: startDisabled ? "linear-gradient(90deg,#9ddffb,#7fbef6)" : "linear-gradient(90deg,#34d3ff,#0ea5e9)",
                animation: "floatIn 420ms ease-out, subtleGlow 3s ease-in-out infinite",
                color: "#041025",
              }}
            >
              {pendingJob && pendingJob.status && pendingJob.status !== "done" ? (
                <>
                  <LoadingRipples size="md" colorClass="bg-[#7dd3fc]" />
                  <span className="text-sm">{pendingJob.status}</span>
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14m7-7H5" />
                  </svg>
                  <span className="text-sm">Start analysis</span>
                </>
              )}
            </button>

            <div className="mt-2 text-xs text-gray-400">
              {lastFileId ? `Will analyze upload: ${lastFileId}` : "No upload detected — please upload a log file first."}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <style>{`
    @keyframes uploadPress {
      0% { transform: scale(1); }
      50% { transform: scale(0.96); }
      100% { transform: scale(1); }
    }
  `}</style>

          <button
            onClick={onClickUpload}
            className="
      px-6 py-3 
      rounded-xl 
      font-semibold 
      text-black 
      shadow-md 
      transition-all 
      duration-200 
      hover:brightness-110 
      active:scale-95
    "
            style={{
              background: "linear-gradient(90deg, #34d3ff, #3b82f6)",
              animation: "uploadPress 0.25s ease-out",
            }}
          >
            Upload new file
          </button>
        </div>

      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Analysis flow + summary */}
        <div className="lg:col-span-2 space-y-4">
          {/* If no upload */}
          {!lastFileId && !analysis && !loading && !pendingJob && (
            <Card title="No uploads found">
              <div className="text-gray-200 mb-3">There is no previously uploaded log file to analyze.</div>
              <div className="flex gap-3">
                <button onClick={onClickUpload} className="px-4 py-2 rounded bg-[#3b82f6] text-black font-semibold">Upload a file</button>
                <button onClick={() => setError("Please upload a file first (redirecting to Uploads).")} className="px-4 py-2 rounded bg-[#0ea5e9] text-black font-semibold">View last upload</button>
              </div>
            </Card>
          )}

          {/* Loading / queued */}
          {(loading || (pendingJob && pendingJob.status && pendingJob.status !== "done" && pendingJob.status !== "cancelled")) && (
            <Card title={pendingJob ? `Analysis job status — ${pendingJob.status}` : "Starting analysis…"}>
              <div className="flex items-center gap-4 mb-3">
                <LoadingRipples size="md" colorClass="bg-[#60a5fa]" />
                <div className="flex-1">
                  <div className="text-sm text-gray-200">{pendingJob ? (pendingJob.message || "Queued for analysis") : "Requesting analysis — this should only take a moment."}</div>
                  <div className="text-xs text-gray-400 mt-2">{pendingJob ? `Last checked: ${pendingJob.lastChecked ? new Date(pendingJob.lastChecked).toLocaleString() : "—"}` : null}</div>
                </div>
              </div>

              <div className="flex gap-2">
                {pendingJob && <button onClick={() => pendingJob.jobId && pollJobStatus(pendingJob.jobId)} className="px-3 py-1 rounded bg-[#353c44] text-black" disabled={!pendingJob.jobId}>Poll status</button>}
                <button onClick={() => runAnalysisForFile(lastFileId)} className="px-3 py-1 rounded bg-[#0ea5e9] text-black">Re-run</button>
                <button onClick={cancelPoll} className="px-3 py-1 rounded bg-[#ef4444] text-black">Cancel</button>
              </div>
            </Card>
          )}

          {/* Final analysis presentation */}
          {analysis && (
            <>
              {/* Summary card */}
              <Card title="Summary">
                <div className="text-gray-100 leading-relaxed whitespace-pre-wrap">{analysis.summary ?? (analysis.result && analysis.result.summary) ?? "No summary provided."}</div>

                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex gap-3">
                    <button onClick={() => runAnalysisForFile(lastFileId)} disabled={loading} className="px-3 py-1 rounded bg-[#60a5fa] text-black">Re-run</button>
                    <button onClick={() => copySteps((analysis.recommended_steps || (analysis.result && analysis.result.issues_found?.map(i => i.how_to_fix)) || analysis.issues_found?.map(i => i.how_to_fix)))} className="px-3 py-1 rounded bg-[#0ea5e9] text-black">Copy steps</button>
                  </div>

                  <div className="text-xs text-gray-400">
                    Source: <span className="font-medium text-gray-200">{analysis._source ?? "ai"}</span>
                  </div>
                </div>
              </Card>

             
               

              {/* Issues & Fixes (detailed) */}
              <Card title="Issues & Fixes">
                {analysis && ((analysis.issues_found && analysis.issues_found.length) || (analysis.result && analysis.result.issues_found && analysis.result.issues_found.length)) ? (
                  <div className="space-y-3">
                    <div className="flex justify-end gap-2 mb-2">
                      <button onClick={() => copySteps((analysis.issues_found || (analysis.result && analysis.result.issues_found) || []).map(i => i.how_to_fix))} className="px-3 py-1 text-sm rounded bg-[#0ea5e9]">Copy fixes</button>
                    </div>
                    {((analysis.issues_found && analysis.issues_found) || (analysis.result && analysis.result.issues_found)).map((it, i) => (
                      <div key={i} className="p-4 bg-[#071b2a] rounded border border-gray-800">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="text-lg font-semibold text-gray-100">{it.title}</div>
                            <div className="text-sm text-gray-300 mt-1"><b>Why:</b> {it.why_it_happened}</div>
                            <div className="text-sm text-gray-300 mt-1"><b>Fix:</b> {it.how_to_fix}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-gray-400">Severity</div>
                            <div className="text-sm font-semibold mt-1">{it.severity}</div>
                            <div className="text-xs text-gray-400 mt-2">Occurrences</div>
                            <div className="text-sm font-medium mt-1">{it.occurrences ?? "—"}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : <div className="text-xs text-gray-400">No issues detected</div>}
              </Card>
            </>
          )}
        </div>

        {/* Right column: Actions (Quick Insights removed) */}
        <div className="space-y-2">
          <Card title="Actions">
            <div className="flex flex-col gap-2 ">
              <button onClick={onDownloadAnalysis} className="px-3 py-2 rounded bg-[#0ea5e9] text-black font-semibold">Download analysis (JSON)</button>
              <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(analysis || {}, null, 2)).then(() => alert("Analysis copied")) }} className="px-3 py-2 rounded bg-[#3b82f6] text-black font-semibold">Copy JSON</button>
              <div className="text-xs text-gray-400 mt-1">Useful quick actions for sharing or storing the analysis.</div>
            </div>
          </Card>

        </div>
      </main>

      {/* error banner */}
      {error && <div className="fixed bottom-6 right-6 p-3 bg-red-600 text-white rounded max-w-md shadow" role="alert" aria-live="assertive">{error}</div>}
    </div>
  );
}

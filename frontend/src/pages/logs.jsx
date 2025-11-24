// src/pages/logs.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import Card from "../shared/card";
import { API_BASE } from "../firebasework/firebaseconfig";

/* Helpers */
function getAuthToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    null
  );
}

async function handleJsonResponse(resp) {
  if (resp.ok) {
    try {
      return await resp.json();
    } catch {
      return null;
    }
  }
  let bodyText = `${resp.status} ${resp.statusText}`;
  try {
    const txt = await resp.text();
    try {
      const parsed = JSON.parse(txt);
      if (parsed?.detail) bodyText = parsed.detail;
      else if (txt) bodyText = txt;
    } catch {
      if (txt) bodyText = txt;
    }
  } catch {}
  throw new Error(bodyText);
}

function levelColor(level = "") {
  const l = (level || "").toUpperCase();
  if (l.startsWith("ERROR")) return "text-red-400";
  if (l.startsWith("WARN")) return "text-yellow-300";
  if (l.startsWith("INFO")) return "text-sky-300";
  if (l.startsWith("DEBUG") || l.startsWith("TRACE")) return "text-gray-400";
  return "text-gray-300";
}

function levelMatchesAnyFields(record, filter) {
  if (!filter) return true;
  const want = filter.toUpperCase();

  const candidates = [
    record.level,
    record.level_name,
    record.severity,
    record.raw,
    record.message,
  ]
    .filter(Boolean)
    .map((x) => String(x).toUpperCase());

  for (const c of candidates) {
    if (c === want || c.includes(want)) return true;
  }

  return false;
}

/* small utility: dedupe logs by id or by combined key */
function dedupeLogs(arr = []) {
  const seen = new Set();
  const out = [];
  for (const r of arr) {
    const key = r.id ?? `${r.timestamp || ""}::${r.message || r.raw || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(r);
    }
  }
  return out;
}

/* Component */
export default function Logs() {
  const [logs, setLogs] = useState([]);
  const [uploads, setUploads] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [error, setError] = useState(null);
  const [serverFilteringSupported, setServerFilteringSupported] = useState(true);

  const [q, setQ] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [selectedUploadId, setSelectedUploadId] = useState("");
  const [limit, setLimit] = useState(500);

  const searchTimeout = useRef(null);
  const inflightController = useRef(null);

  // Guard to ensure only latest fetch response applies
  const fetchIdRef = useRef(0);

  /* Fetch uploads */
  useEffect(() => {
    let mounted = true;
    setLoadingUploads(true);
    setError(null);

    const token = getAuthToken();
    fetch(`${API_BASE}/uploads`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(handleJsonResponse)
      .then((j) => mounted && setUploads(j || []))
      .catch(() => mounted && setError("Failed to load uploads"))
      .finally(() => mounted && setLoadingUploads(false));

    return () => (mounted = false);
  }, []);

  /* Fetch logs */
  const fetchLogsFromServer = async ({ useServerFiltering = true, params = {} } = {}) => {
    // increment global fetch id for this request
    const thisFetchId = ++fetchIdRef.current;

    // abort previous inflight request (if any)
    if (inflightController.current) {
      try {
        inflightController.current.abort();
      } catch {}
    }

    const controller = new AbortController();
    inflightController.current = controller;
    setLoadingLogs(true);
    setError(null);

    const qs = new URLSearchParams();
    if (params.limit) qs.set("limit", params.limit);
    if (useServerFiltering) {
      if (params.upload_id) qs.set("upload_id", params.upload_id);
      if (params.q) qs.set("q", params.q);
    }

    const url = `${API_BASE}/logs?${qs.toString()}`;

    try {
      const token = getAuthToken();
      const resp = await fetch(url, {
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      // If server replies that the filtering params are not supported,
      // mark unsupported and RETURN (do NOT recursively call from here).
      if ([404, 400, 422].includes(resp.status) && useServerFiltering) {
        setServerFilteringSupported(false);
        // clear loading for this request (the outer useEffect will re-run and fetch again)
        if (thisFetchId === fetchIdRef.current) setLoadingLogs(false);
        return;
      }

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        throw new Error(txt || `${resp.status} ${resp.statusText}`);
      }

      const body = await resp.json().catch(() => null);
      const incoming = Array.isArray(body) ? body : [];

      // ensure this response is still the latest request
      if (thisFetchId !== fetchIdRef.current) {
        // a newer fetch has been issued; ignore this response
        return;
      }

      // dedupe server results to avoid duplicate rows if responses overlapped
      setLogs((_) => dedupeLogs(incoming));
    } catch (err) {
      if (err.name !== "AbortError") {
        console.error("fetchLogsFromServer error:", err);
        setError("Failed to load logs");
      }
    } finally {
      // Only clear loading if this is the latest fetch
      if (thisFetchId === fetchIdRef.current) {
        setLoadingLogs(false);
      }
    }
  };

  /* Trigger fetch when filters change */
  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    const params = { limit };
    if (selectedUploadId) params.upload_id = selectedUploadId;
    if (q.trim()) params.q = q.trim();

    if (q) {
      searchTimeout.current = setTimeout(() => {
        fetchLogsFromServer({ useServerFiltering: serverFilteringSupported, params });
      }, 300);
    } else {
      fetchLogsFromServer({ useServerFiltering: serverFilteringSupported, params });
    }

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      if (inflightController.current) try { inflightController.current.abort(); } catch {}
    };
    // note: serverFilteringSupported is intentionally included — when it flips,
    // the effect will re-run and fetch without server filtering.
  }, [limit, selectedUploadId, q, serverFilteringSupported]);

  /* Delete upload — improved version */
  const handleDeleteUpload = async (uploadId) => {
    if (!window.confirm("Delete this upload and all its logs?")) return;

    const token = getAuthToken();
    const headers = token
      ? { Authorization: `Bearer ${token}`, Accept: "application/json" }
      : { Accept: "application/json" };

    try {
      // optimistic UI update for snappy UX
      setUploads((u) => u.filter((x) => x.id !== uploadId));
      setLogs((l) => l.filter((x) => String(x.upload_id) !== String(uploadId)));
      if (selectedUploadId === String(uploadId)) setSelectedUploadId("");

      console.info("Deleting upload:", uploadId, "URL:", `${API_BASE}/uploads/${uploadId}`);

      const resp = await fetch(`${API_BASE}/uploads/${uploadId}`, {
        method: "DELETE",
        headers,
        mode: "cors",
        // credentials: "include", // uncomment if you use cookie-based auth
      });

      // If not OK, read body for a useful error message
      if (!resp.ok) {
        let bodyText = `${resp.status} ${resp.statusText}`;
        try {
          const txt = await resp.text();
          if (txt) {
            try {
              const parsed = JSON.parse(txt);
              bodyText = parsed?.detail || JSON.stringify(parsed) || txt;
            } catch {
              bodyText = txt;
            }
          }
        } catch (e) {
          /* ignore */
        }
        console.error("Delete failed", resp.status, bodyText);
        // Revert optimistic UI changes by re-fetching uploads/logs
        await refreshUploadsAndLogs();
        throw new Error(bodyText);
      }

      // Successful deletion — re-sync with server to ensure counts are correct
      await refreshUploadsAndLogs();

      alert("Upload deleted.");
    } catch (err) {
      console.error("handleDeleteUpload error:", err);
      alert(`Failed to delete upload. ${err?.message ? err.message : ""}`);
    }
  };

  /* helper: refresh uploads and logs to keep UI consistent after changes */
  async function refreshUploadsAndLogs() {
    try {
      const token = getAuthToken();
      const hdrs = token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : { Accept: "application/json" };

      // refresh uploads
      try {
        const upResp = await fetch(`${API_BASE}/uploads`, { headers: hdrs });
        if (upResp.ok) {
          const ups = await upResp.json().catch(() => []);
          setUploads(Array.isArray(ups) ? ups : []);
        } else {
          console.warn("refreshUploadsAndLogs: failed to fetch uploads", upResp.status);
        }
      } catch (e) {
        console.warn("refreshUploadsAndLogs: uploads fetch error", e);
      }

      // refresh logs (use existing fetch function in component)
      try {
        const params = { limit };
        if (selectedUploadId) params.upload_id = selectedUploadId;
        await fetchLogsFromServer({ useServerFiltering: serverFilteringSupported, params });
      } catch (e) {
        console.warn("refreshUploadsAndLogs: failed to re-fetch logs", e);
      }
    } catch (e) {
      console.error("refreshUploadsAndLogs error:", e);
    }
  }

  /* Client filtering */
  const filtered = useMemo(() => {
    const qlow = q.toLowerCase();

    return logs.filter((r) => {
      const uploadVal = String(
        r.upload_id ?? r.uploadId ?? r.file_id ?? r.fileId ?? ""
      );

      if (selectedUploadId && selectedUploadId !== uploadVal) return false;
      if (levelFilter && !levelMatchesAnyFields(r, levelFilter)) return false;

      if (!qlow) return true;

      const hay = [
        r.message,
        r.raw,
        r.level,
        r.service,
      ]
        .join(" ")
        .toLowerCase();

      return hay.includes(qlow);
    });
  }, [logs, q, levelFilter, selectedUploadId]);

  /* Metrics */
  const metrics = useMemo(() => {
    const total = logs.length;
    const errors = logs.filter(
      (l) =>
        (l.level && String(l.level).toUpperCase().startsWith("ERR")) ||
        (l.message && /error|exception|traceback/i.test(l.message))
    ).length;

    const svcCounts = {};
    logs.forEach((l) => {
      svcCounts[l.service || "UNKNOWN"] = (svcCounts[l.service || "UNKNOWN"] || 0) + 1;
    });

    const topServices = Object.entries(svcCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([service, count]) => ({ service, count }));

    return { total, errors, topServices };
  }, [logs]);

  return (
    <div className="min-h-screen">
      <header className="flex justify-between p-4 border-b border-black/30">
        <div>
          <h1 className="text-lg font-semibold text-[#93c5fd]">Logs Explorer</h1>
          <div className="text-xs text-gray-400">Search, filter and inspect logs</div>
        </div>

        <div className="text-sm text-gray-300">
          Total: <strong>{metrics.total}</strong> • Errors:{" "}
          <strong className="text-red-400">{metrics.errors}</strong>
        </div>
      </header>

      <main className="p-6">
        <div className="grid lg:grid-cols-3 gap-4">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-4">

            {/* Search + Filters */}
            <Card title="Search & Filters">
              <div className="flex gap-3">
                <input
                  placeholder="Search logs..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-full bg-[#0b1220]"
                />

                <select
                  value={levelFilter}
                  onChange={(e) => setLevelFilter(e.target.value)}
                  className="px-3 py-2 rounded-full bg-[#0b1220]"
                >
                  <option value="">All levels</option>
                  <option value="ERROR">ERROR</option>
                  <option value="WARN">WARN</option>
                  <option value="INFO">INFO</option>
                  <option value="DEBUG">DEBUG</option>
                </select>

                <select
                  value={selectedUploadId}
                  onChange={(e) => setSelectedUploadId(e.target.value)}
                  className="px-3 py-2 rounded-full bg-[#0b1220]"
                >
                  <option value="">All uploads</option>
                  {uploads.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name || `upload-${u.id}`} ({u.parsed_count || 0})
                    </option>
                  ))}
                </select>

                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value))}
                  className="px-3 py-2 rounded-full bg-[#0b1220]"
                >
                  <option value={100}>Latest 100</option>
                  <option value={500}>Latest 500</option>
                  <option value={1000}>Latest 1000</option>
                  <option value={5000}>Latest 5000</option>
                </select>
              </div>

              <div className="text-xs text-gray-400 mt-2">
                Showing {filtered.length} of {logs.length}
              </div>
            </Card>

            {/* Results */}
            <Card title="Results">
              <div className="bg-[#071021] rounded p-3">
                {loadingLogs ? (
                  <div className="text-sm text-gray-400">Loading logs…</div>
                ) : error ? (
                  <div className="text-sm text-red-400">{error}</div>
                ) : filtered.length === 0 ? (
                  <div className="text-sm text-gray-400">No logs match filters.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="text-xs text-gray-400 border-b border-black/30">
                        <tr>
                          <th className="py-2">Time</th>
                          <th>Level</th>
                          <th>Service</th>
                          <th>Message</th>
                          <th>Upload</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((r, idx) => {
                          const uploadVal = String(
                            r.upload_id ?? r.uploadId ?? r.file_id ?? r.fileId ?? ""
                          );

                          const u = uploads.find((x) => String(x.id) === uploadVal);

                          return (
                            <tr key={r.id ?? idx} className="odd:bg-black/10 hover:bg-black/20">
                              <td className="py-2 text-xs text-gray-300">
                                {r.timestamp ? new Date(r.timestamp).toLocaleString() : "-"}
                              </td>

                              <td className={`text-sm ${levelColor(r.level)}`}>
                                {r.level || "N/A"}
                              </td>

                              <td className="text-sm text-gray-300">
                                {r.service || "-"}
                              </td>

                              <td className="text-sm text-gray-200">
                                {r.message || r.raw || "-"}
                              </td>

                              <td className="text-sm text-gray-400">
                                {u ? u.name : uploadVal ? `upload-${uploadVal}` : "-"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-4">

            {/* Recent uploads */}
            <Card title="Recent uploads">
              {loadingUploads ? (
                <div className="text-sm text-gray-400">Loading uploads…</div>
              ) : uploads.length === 0 ? (
                <div className="text-sm text-gray-400">No uploads yet.</div>
              ) : (
                <div className="space-y-2 text-sm">
                  {uploads.slice(0, 6).map((u) => (
                    <div key={u.id} className="flex justify-between items-center">
                      <div>
                        <div className="font-medium text-gray-200">
                          {u.name || `upload-${u.id}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          {u.created_at ? new Date(u.created_at).toLocaleString() : ""}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-xs text-gray-300">{u.parsed_count }</div>

                        <button
                          className="text-red-400 text-xs hover:text-red-200"
                          onClick={() => handleDeleteUpload(u.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))} 
                </div>
              )}
            </Card>

            {/* Quick insights */}
            <Card title="Quick insights">
              <div className="text-sm space-y-2">
                <div>
                  Total logs: <strong>{metrics.total}</strong>
                </div>
                <div>
                  Errors:{" "}
                  <strong className="text-red-400">{metrics.errors}</strong>
                </div>

                <div>
                  <div className="text-xs text-gray-400 mt-2">Top services</div>
                  <ul className="mt-1">
                    {metrics.topServices.length === 0 ? (
                      <li className="text-xs text-gray-400">No service data</li>
                    ) : (
                      metrics.topServices.map((s) => (
                        <li key={s.service} className="text-sm text-gray-200">
                          {s.service}{" "}
                          <span className="text-xs text-gray-400">
                            ({s.count})
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              </div>
            </Card>

          </div>
        </div>
      </main>
    </div>
  );
}

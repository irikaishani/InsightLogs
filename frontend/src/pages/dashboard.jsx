// src/pages/dashboard.jsx
import React, { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../shared/card";
import { API_BASE } from "../firebasework/firebaseconfig";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from "recharts";

/* ----------------- Helpers (unchanged) ----------------- */
const CACHE_KEY = "dashboard_logs_cache_v1";
const POLL_INTERVAL_MS = 30 * 1000; // 30s

function getAuthToken() {
  return sessionStorage.getItem("access_token") || localStorage.getItem("token") || null;
}
async function handleJsonResponse(resp) {
  if (resp.ok) {
    try { return await resp.json(); } catch { return null; }
  }
  let bodyText = `${resp.status} ${resp.statusText}`;
  try {
    const txt = await resp.text();
    try {
      const parsed = JSON.parse(txt);
      if (parsed && parsed.detail) bodyText = parsed.detail;
      else if (txt) bodyText = txt;
    } catch {
      if (txt) bodyText = txt;
    }
  } catch (e) { }
  const err = new Error(bodyText);
  err.status = resp.status;
  throw err;
}
function toInt(v, fallback = 0) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : fallback;
}
function getTimestampFromLog(log) {
  if (!log) return null;
  const candidates = [
    log.timestamp, log.created_at, log.ts, log.time, log._time, log.date, log.when,
  ];
  if (log.meta) candidates.push(log.meta.time, log.meta.timestamp, log.meta._time, log.meta.ts);
  if (log.payload) candidates.push(log.payload.timestamp, log.payload.time);
  for (const c of candidates) {
    if (c == null) continue;
    if (typeof c === "number") {
      if (c > 1e12) {
        const d = new Date(c); if (!isNaN(d.getTime())) return d;
      } else if (c > 1e9) {
        const d = new Date(c * 1000); if (!isNaN(d.getTime())) return d;
      } else {
        const d = new Date(c); if (!isNaN(d.getTime())) return d;
      }
    }
    if (typeof c === "string") {
      const s = c.trim();
      if (/^\d+$/.test(s)) {
        try {
          const n = Number(s);
          if (s.length === 10) {
            const d = new Date(n * 1000); if (!isNaN(d.getTime())) return d;
          } else {
            const d = new Date(n); if (!isNaN(d.getTime())) return d;
          }
        } catch { }
      }
      const d = new Date(s);
      if (!isNaN(d.getTime())) return d;
    }
    if (c instanceof Date) {
      if (!isNaN(c.getTime())) return c;
    }
  }
  return null;
}
function isErrorRow(r) {
  const lvl = (r.level || r.l || "").toString().trim().toLowerCase();
  const msg = (r.message || r.msg || r.m || "").toString().toLowerCase();
  if (lvl && lvl.startsWith("err")) return true;
  if (msg.includes("error") || msg.includes("exception") || msg.includes("traceback")) return true;
  return false;
}
function stableLogKey(l) {
  if (!l) return null;
  if (l.id) return String(l.id);
  if (l._id) return String(l._id);
  if (l.uuid) return String(l.uuid);
  const ts = getTimestampFromLog(l);
  const msg = (l.message || l.msg || l.m || "").toString().slice(0, 240);
  if (ts) return `${ts.getTime()}::${msg}`;
  try { return JSON.stringify(l).slice(0, 500); } catch { return JSON.stringify({}); }
}
function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch { return []; }
}
function writeCache(arr) {
  try {
    const capped = Array.isArray(arr) ? arr.slice(-5000) : [];
    localStorage.setItem(CACHE_KEY, JSON.stringify(capped));
  } catch (e) { console.warn("Failed to write cache", e); }
}

/* ----------------- Component ----------------- */
export default function Dashboard() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [dashboard, setDashboard] = useState(null);
  const [logs, setLogs] = useState(() => readCache());
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState({ profile: true, dashboard: true, logs: false, uploads: true });
  const pollRef = useRef(null);
  const token = getAuthToken();

  async function fetchLogsFromApi(limit = 1000) {
    try {
      const res = await fetch(`${API_BASE}/logs?limit=${limit}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const j = await handleJsonResponse(res);
      if (!j) return [];
      if (Array.isArray(j)) return j;
      if (j.items && Array.isArray(j.items)) return j.items;
      for (const k of Object.keys(j)) if (Array.isArray(j[k])) return j[k];
      return [];
    } catch (e) {
      console.warn("logs fetch error:", e);
      return [];
    }
  }

  // ---- profile ----
  useEffect(() => {
    if (!token) { setProfile(null); setLoading((s) => ({ ...s, profile: false })); return; }
    setLoading((s) => ({ ...s, profile: true }));
    fetch(`${API_BASE}/profile`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } })
      .then(handleJsonResponse)
      .then((d) => setProfile(d))
      .catch((e) => { console.warn("Profile fetch failed", e); setProfile(null); })
      .finally(() => setLoading((s) => ({ ...s, profile: false })));
  }, [token]);

  // ---- dashboard ----
  useEffect(() => {
    if (!token) { setDashboard(null); setLoading((s) => ({ ...s, dashboard: false })); return; }
    setLoading((s) => ({ ...s, dashboard: true }));
    fetch(`${API_BASE}/dashboard`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } })
      .then(handleJsonResponse)
      .then(async (data) => {
        const patched = data && typeof data === "object" ? { ...data } : {};
        patched.errors = toInt(patched.errors, 0);
        patched.active_uploads = toInt(patched.active_uploads, 0);
        patched.total_logs = toInt(patched.total_logs, 0);
        setDashboard(patched);
      })
      .catch((err) => { console.warn("Failed to load dashboard:", err); setDashboard({ total_logs: 0, errors: 0, active_uploads: 0, recent_reports: [], last_upload: null }); })
      .finally(() => setLoading((s) => ({ ...s, dashboard: false })));
  }, [token]);

  // ---- uploads ----
  useEffect(() => {
    if (!token) { setUploads([]); setLoading((s) => ({ ...s, uploads: false })); return; }
    setLoading((s) => ({ ...s, uploads: true }));
    fetch(`${API_BASE}/uploads`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` } })
      .then(handleJsonResponse)
      .then((data) => { if (Array.isArray(data)) setUploads(data); else if (data && Array.isArray(data.items)) setUploads(data.items); else setUploads([]); })
      .catch((e) => { console.warn("Failed to load uploads:", e); setUploads([]); })
      .finally(() => setLoading((s) => ({ ...s, uploads: false })));
  }, [token]);

  // ---- logs: initial load + merge + cache + polling ----
  useEffect(() => {
    let isMounted = true;
    async function initialLoadAndStartPolling() {
      if (!token) {
        if (isMounted) { setLogs(readCache()); setLoading((s) => ({ ...s, logs: false })); }
        return;
      }
      if (isMounted) setLoading((s) => ({ ...s, logs: true }));

      const initial = await fetchLogsFromApi(1000);
      let combined = initial;
      if ((Array.isArray(initial) && initial.length === 0) && dashboard && dashboard.total_logs && dashboard.total_logs > 0) {
        const retry = await fetchLogsFromApi(5000);
        combined = retry;
      }

      const existing = readCache();
      const map = new Map();
      for (const e of existing) { const k = stableLogKey(e); if (k) map.set(k, e); }
      for (const f of combined) { const k = stableLogKey(f); if (k) map.set(k, f); }

      const merged = Array.from(map.values()).sort((a, b) => {
        const ta = getTimestampFromLog(a)?.getTime() || 0;
        const tb = getTimestampFromLog(b)?.getTime() || 0;
        return ta - tb;
      });

      writeCache(merged);
      if (isMounted) { setLogs(merged); setLoading((s) => ({ ...s, logs: false })); }

      if (isMounted) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = setInterval(async () => {
          try {
            const newest = await fetchLogsFromApi(1000);
            if (!Array.isArray(newest)) return;
            const cur = readCache();
            const m = new Map();
            for (const c of cur) m.set(stableLogKey(c), c);
            for (const n of newest) m.set(stableLogKey(n), n);
            const merged2 = Array.from(m.values()).sort((a, b) => {
              const ta = getTimestampFromLog(a)?.getTime() || 0;
              const tb = getTimestampFromLog(b)?.getTime() || 0;
              return ta - tb;
            });
            writeCache(merged2);
            setLogs(merged2);
          } catch (e) { console.warn("poll logs error", e); }
        }, POLL_INTERVAL_MS);
      }
    }

    initialLoadAndStartPolling();

    return () => { isMounted = false; if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, dashboard?.total_logs]);

  /* ----------------- Chart building ----------------- */
  const CHART_DAYS = 30;
  const chartData = useMemo(() => {
    const now = new Date();
    const days = [];
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    const counts = days.map((d) => ({ dateObj: d, total: 0, errors: 0 }));
    function dateKey(dt) { return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`; }
    const map = {};
    counts.forEach((c, i) => (map[dateKey(c.dateObj)] = i));

    for (const l of Array.isArray(logs) ? logs : []) {
      const ts = getTimestampFromLog(l);
      if (!ts) continue;
      const local = new Date(ts.getFullYear(), ts.getMonth(), ts.getDate());
      const idx = map[dateKey(local)];
      if (idx === undefined) continue;
      counts[idx].total += 1;
      if (isErrorRow(l)) counts[idx].errors += 1;
    }

    const totalFromLogs = counts.reduce((a, b) => a + (b.total || 0), 0);
    if (totalFromLogs === 0 && dashboard && dashboard.total_logs > 0) {
      const today = new Date();
      const label = today.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return [{ date: label, iso: today.toISOString().slice(0, 10), total: dashboard.total_logs, errors: dashboard.errors || 0 }];
    }

    return counts.map((c) => ({
      date: c.dateObj.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      iso: c.dateObj.toISOString().slice(0, 10),
      total: c.total,
      errors: c.errors,
    }));
  }, [logs, dashboard]);

  const totalSampled = useMemo(() => (chartData ? chartData.reduce((a, b) => a + (b.total || 0), 0) : 0), [chartData]);

  const goUpload = () => navigate("/uploads");
  const goAiAnalysis = () => {
    if (dashboard && dashboard.last_upload && dashboard.last_upload.file_id) navigate(`/ai-analysis?file_id=${dashboard.last_upload.file_id}`);
    else navigate("/ai-analysis");
  };

  /* ----------------- UI helpers ----------------- */
  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const pTotal = payload.find((p) => p.dataKey === "total");
    const pErr = payload.find((p) => p.dataKey === "errors");
    return (
      <div style={{ background: "rgba(10,11,13,0.95)", color: "#fff", padding: 8, borderRadius: 6, fontSize: 12 }}>
        <div style={{ fontWeight: 700 }}>{label}</div>
        <div style={{ fontSize: 12 }}>Total events: {pTotal ? pTotal.value : 0}</div>
        <div style={{ fontSize: 12, color: "#ff6b6b" }}>Errors: {pErr ? pErr.value : 0}</div>
      </div>
    );
  };

  const barSummary = useMemo(() => {
    const t = dashboard ? dashboard.total_logs || 0 : 0;
    const e = dashboard ? dashboard.errors || 0 : 0;
    const a = dashboard ? dashboard.active_uploads || 0 : 0;
    return [
      { key: "Total Logs", value: t, id: "total" },
      { key: "Errors", value: e, id: "errors" },
      { key: "Active Uploads", value: a, id: "active" },
    ];
  }, [dashboard]);

  const barColors = ["#3b82f6", "#ef4444", "#10b981"]; // vivid blue, red, green

  /* ----------------- Render ----------------- */
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-850 to-slate-900 text-slate-100">
      <header className="flex items-center justify-between p-6 border-b border-white/6">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-sky-300 to-indigo-400">Dashboard</h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">Overview — upload files and view statistics</p>
        </div>

        <div className="flex gap-3">
          <button onClick={goUpload} className="px-3 py-1.5 rounded-xl bg-white/6 backdrop-blur hover:bg-white/10 transition shadow-sm text-sm">Upload</button>
          <button onClick={goAiAnalysis} className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-900 font-semibold shadow-md transform hover:scale-[1.02] transition text-sm">AI Analysis</button>
        </div>
      </header>

      <main className="p-6 max-w-7xl mx-auto">
        {/* compact top stats: fixed small height to avoid overflow */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Card className="p-2 h-20" title="Total Logs">
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold leading-none truncate">
                  {loading.dashboard ? "…" : dashboard ? (dashboard.total_logs ?? 0) : 0}
                </div>
                <div className="text-[10px] text-slate-400">events</div>
              </div>
              <div className="mt-1 text-[10px] text-slate-400 truncate">All ingested log lines</div>
            </div>
          </Card>

          <Card className="p-2 h-20" title="Errors">
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-rose-300 leading-none truncate">
                  {loading.dashboard ? "…" : dashboard ? (dashboard.errors ?? 0) : 0}
                </div>
                <div className="text-[10px] text-slate-400">critical</div>
              </div>
              <div className="mt-1 text-[10px] text-slate-400 truncate">Detected error-level events</div>
            </div>
          </Card>

          <Card className="p-2 h-20" title="Active Uploads">
            <div className="flex flex-col h-full justify-between">
              <div className="flex items-center justify-between">
                <div className="text-lg font-semibold text-emerald-300 leading-none truncate">
                  {loading.dashboard ? "…" : dashboard ? (dashboard.active_uploads ?? 0) : 0}
                </div>
                <div className="text-[10px] text-slate-400">jobs</div>
              </div>
              <div className="mt-1 text-[10px] text-slate-400 truncate">Queued / running processing</div>
            </div>
          </Card>

          <Card className="p-2 h-20" title="Recent Reports">
            <div className="flex flex-col h-full justify-between">
              <div className="text-xs text-slate-400">
                {loading.dashboard ? "Loading…" : dashboard && dashboard.recent_reports && dashboard.recent_reports.length ? (
                  <div className="space-y-1">
                    {dashboard.recent_reports.slice(0, 2).map((r) => (
                      <div key={r.id} className="truncate">
                        <div className="font-medium text-sm truncate">{r.title}</div>
                        <div className="text-[10px] text-slate-400 truncate">{r.created_at ? new Date(r.created_at).toLocaleString() : "—"}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="truncate">No recent reports</div>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* chart area: larger height and more room */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3 space-y-6">
            <Card title="Logs over time" className="p-4">
              {/* Make the card a vertical flex so chart can flex properly */}
              <div className="flex flex-col h-[420px] w-full px-2 pb-2 pt-2 bg-gradient-to-b from-white/2 to-transparent rounded-md">
                {/* Flexible chart area that can shrink (min-h-0 is important) */}
                <div className="flex-1 min-h-0 relative">
                  {loading.logs ? (
                    <div className="flex items-center justify-center h-full text-slate-400">Loading logs…</div>
                  ) : chartData && chartData.length ? (
                    <div className="h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 6, bottom: 6 }}>
                          <defs>
                            <linearGradient id="totalArea" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopOpacity={0.28} stopColor="#3b82f6" />
                              <stop offset="100%" stopOpacity={0.04} stopColor="#0369a1" />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip content={<ChartTooltip />} />
                          <Legend wrapperStyle={{ color: "#e6eef8" }} />
                          <Area type="monotone" dataKey="total" stroke="#3b82f6" strokeWidth={2.6} fill="url(#totalArea)" name="Total events" />
                          <Line type="monotone" dataKey="errors" stroke="#ef4444" strokeWidth={2.6} dot={{ r: 3 }} name="Errors" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-400 p-4">
                      <div className="mb-2">{dashboard && dashboard.total_logs > 0 ? "No per-day logs available — showing dashboard totals below." : "No recent logs to show"}</div>
                      {dashboard && dashboard.total_logs > 0 && <div className="text-xs text-slate-500">Totals: {dashboard.total_logs} events • {dashboard.errors} errors • {dashboard.active_uploads} active uploads</div>}
                    </div>
                  )}
                </div>

                {/* colored bar summary — fixed height but safe */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-slate-300 mb-2">
                    <div className="text-sm">Summary</div>
                    <div className="text-xs text-slate-400">Source: dashboard</div>
                  </div>

                  <div style={{ height: 84 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={barSummary} layout="vertical" margin={{ top: 0, right: 8, left: 8, bottom: 0 }}>
                        <XAxis type="number" hide />
                        <YAxis dataKey="key" type="category" width={140} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(v) => v} />
                        <Bar dataKey="value" radius={[6, 6, 6, 6]}>
                          {barSummary.map((entry, idx) => (
                            <Cell key={`cell-${entry.id}`} fill={barColors[idx % barColors.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="mt-3 text-sm flex items-center justify-between text-slate-300">
                  <div><strong className="text-slate-100">{totalSampled}</strong> total events sampled (last {CHART_DAYS} days)</div>
                  <div className="text-xs text-slate-400 flex items-center gap-3">
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: "#3b82f6" }} /> Total</span>
                    <span className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm" style={{ background: "#ef4444" }} /> Errors ({chartData.reduce((a, b) => a + b.errors, 0)})</span>
                    <span className="text-xs text-slate-400">bucket: day</span>
                  </div>
                </div>
              </div>
            </Card>

          </div>

          {/* right column: profile + last upload (compact) */}
          <div className="space-y-6">
            <Card title="User profile" className="p-4">
              {loading.profile ? <div className="text-sm text-slate-400">Loading…</div> : profile ? (
                <div className="text-sm">
                  <div className="font-medium text-slate-100 truncate">{profile.name || profile.email}</div>
                  <div className="text-xs text-slate-400 truncate">{profile.email}</div>
                  {profile.org && <div className="mt-2 text-xs text-slate-400 truncate">Organization: {profile.org}</div>}
                </div>
              ) : <div className="text-sm text-slate-400">Not signed in</div>}
            </Card>

            <Card title="Last upload" className="p-4">
              {loading.dashboard ? <div className="text-sm text-slate-400">Loading…</div> : dashboard && dashboard.last_upload ? (
                <div className="text-sm space-y-2 text-slate-200">
                  <div className="font-medium truncate">{dashboard.last_upload.name}</div>
                  <div className="text-xs text-slate-400 truncate">Uploaded: {dashboard.last_upload.created_at ? new Date(dashboard.last_upload.created_at).toLocaleString() : "—"}</div>
                  <div className="text-xs text-slate-400 truncate">Size: {dashboard.last_upload.size ?? "—"}</div>
                  <div className="text-xs text-slate-400 truncate">Parsed: {dashboard.last_upload.parsed_count ?? "—"}</div>
                  <div className="mt-3 flex gap-3">
                    <button onClick={goAiAnalysis} className="px-3 py-1 rounded bg-gradient-to-r from-sky-400 to-emerald-400 text-slate-900 font-semibold">Analyze</button>
                    <button onClick={goUpload} className="px-3 py-1 rounded bg-white/6 hover:bg-white/10">Upload New</button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-slate-400">
                  No uploaded files yet.
                  <div className="mt-3"><button onClick={goUpload} className="px-3 py-1 rounded bg-white/6 hover:bg-white/10">Upload</button></div>
                </div>
              )}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

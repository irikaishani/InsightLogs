// src/pages/profile.jsx
import React, { useEffect, useState } from "react";
import Card from "../shared/Card";
import { API_BASE } from "../firebasework/firebaseconfig";

/**
 * Profile page — cleaned per request + enhanced visibility
 *  - Inputs and boxes made more visible: stronger borders, subtle shadows, clearer labels
 *  - Avatar emphasised with ring and larger size
 *  - Responsive layout retained (mobile-first, two-column on md+)
 *  - Email remains read-only; permitted fields editable and PATCHed
 */

function getToken() {
  return (
    localStorage.getItem("token") ||
    sessionStorage.getItem("access_token") ||
    null
  );
}

const SENSITIVE_KEYS = [
  "password",
  "hashed_password",
  "passwd",
  "secret",
  "api_key",
  "apiKey",
  "authorization",
  "token",
  "access_token",
  "refresh_token",
  "firebase_uid",
  "private_key",
];

const PRIORITY_FIELDS = [
  "name",
  "email",
  "role",
  "organization",
  "tech_stack",
  "username",
  "phone",
  "created_at",
  "last_login",
];

function isPlainValue(v) {
  const t = typeof v;
  return v === null || t === "string" || t === "number" || t === "boolean";
}

function sanitizeKey(k = "") {
  return String(k).toLowerCase();
}

function isSensitiveKey(k) {
  const kk = sanitizeKey(k);
  return SENSITIVE_KEYS.some((s) => kk.includes(s.toLowerCase()));
}

const ALLOWED_PATCH_FIELDS = new Set([
  "name",
  "role",
  "organization",
  "tech_stack",
  "username",
  "phone",
]);

export default function Profile() {
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    const token = getToken();
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/profile`, {
      headers: token ? { Authorization: `Bearer ${token}`, Accept: "application/json" } : { Accept: "application/json" },
    })
      .then(async (r) => {
        if (!r.ok) {
          const txt = await r.text().catch(() => null);
          throw new Error(txt || `Failed to fetch profile (${r.status})`);
        }
        return r.json();
      })
      .then((j) => {
        if (!mounted) return;
        const safe = {};
        Object.keys(j || {}).forEach((k) => {
          if (!isSensitiveKey(k)) safe[k] = j[k];
        });
        setProfile(safe);
        const init = {};
        Object.keys(safe).forEach((k) => (init[k] = safe[k]));
        setEditing(init);
      })
      .catch((err) => {
        console.error("Profile load error:", err);
        if (!mounted) return;
        setError(err.message || "Failed to load profile");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const changeField = (key, value) => {
    setEditing((s) => ({ ...s, [key]: value }));
  };

  const getChangedFields = () => {
    if (!profile) return {};
    const out = {};
    Object.keys(editing).forEach((k) => {
      if (k === "email") return; // never change email here
      if (isSensitiveKey(k)) return;
      const orig = profile[k];
      const cur = editing[k];
      const plainOrig = isPlainValue(orig) ? String(orig) : JSON.stringify(orig || "");
      const plainCur = isPlainValue(cur) ? String(cur) : JSON.stringify(cur || "");
      if (plainOrig !== plainCur && ALLOWED_PATCH_FIELDS.has(k)) {
        out[k] = cur;
      }
    });
    return out;
  };

  const handleSave = async () => {
    setError(null);
    setStatusMsg(null);
    const changed = getChangedFields();
    if (!changed || Object.keys(changed).length === 0) {
      setStatusMsg("No permitted changes to save.");
      setTimeout(() => setStatusMsg(null), 2500);
      return;
    }

    if ("name" in changed && (!changed.name || String(changed.name).trim() === "")) {
      setError("Name cannot be empty.");
      setTimeout(() => setError(null), 3000);
      return;
    }

    setSaving(true);
    try {
      const token = getToken();
      const res = await fetch(`${API_BASE}/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(changed),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => null);
        throw new Error(txt || `Save failed (${res.status})`);
      }

      const body = await res.json().catch(() => null);
      if (body && typeof body === "object") {
        const safe = {};
        Object.keys(body).forEach((k) => {
          if (!isSensitiveKey(k)) safe[k] = body[k];
        });
        setProfile((p) => ({ ...(p || {}), ...(safe || {}) }));
        setEditing((e) => ({ ...(e || {}), ...(safe || {}) }));
        setStatusMsg("Profile updated");
        setTimeout(() => setStatusMsg(null), 3000);
      } else {
        setProfile((p) => ({ ...(p || {}), ...changed }));
        setEditing((e) => ({ ...(e || {}), ...changed }));
        setStatusMsg("Profile updated");
        setTimeout(() => setStatusMsg(null), 3000);
      }
    } catch (err) {
      console.error("Profile save error:", err);
      setError(err.message || "Failed to save profile.");
      setTimeout(() => setError(null), 4000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#010815]">
        <header className="flex items-center justify-between p-4 border-b border-black/30">
          <h1 className="text-2xl font-semibold text-[#93c5fd]">Profile</h1>
        </header>
        <main className="p-6 max-w-4xl mx-auto">
          <Card title="Loading profile...">
            <div className="text-sm text-gray-400">Fetching your details…</div>
          </Card>
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#010815]">
        <header className="flex items-center justify-between p-4 border-b border-black/30">
          <h1 className="text-2xl font-semibold text-[#93c5fd]">Profile</h1>
        </header>
        <main className="p-6 max-w-4xl mx-auto">
          <Card title="Profile">
            <div className="text-sm text-red-400">{error || "No profile available."}</div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#010815]">
      <header className="flex items-center justify-between p-4 border-b border-black/30">
        <div>
          <h1 className="text-2xl font-semibold text-[#93c5fd]">Profile</h1>
          <p className="text-xs text-gray-400">Edit permitted fields below</p>
        </div>
      </header>

      <main className="p-6 max-w-4xl mx-auto">
        <Card title="Account">
          {/* card inner wrapper to give clearer surface */}
          <div className="p-4 bg-[#041229] rounded-lg shadow-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              {/* Avatar / basic */}
              <div className="md:col-span-1 flex flex-col items-center gap-4">
                <div className="w-32 h-32 md:w-36 md:h-36 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white text-3xl font-bold ring-4 ring-indigo-700/40">
                  {(profile.name || profile.email || "U").charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-gray-100">{profile.name || profile.email}</div>
                  <div className="text-xs text-gray-300">{profile.email}</div>
                </div>
              </div>

              {/* Form fields */}
              <div className="md:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-300 font-medium">Full name</label>
                    <input
                      type="text"
                      value={editing.name ?? ""}
                      onChange={(e) => changeField("name", e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-md bg-[#071a2b] border border-gray-600 placeholder-gray-400 outline-none text-sm text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-300 font-medium">Role</label>
                    <input
                      type="text"
                      value={editing.role ?? ""}
                      onChange={(e) => changeField("role", e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-md bg-[#071a2b] border border-gray-600 placeholder-gray-400 outline-none text-sm text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-300 font-medium">Organization</label>
                    <input
                      type="text"
                      value={editing.organization ?? ""}
                      onChange={(e) => changeField("organization", e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-md bg-[#071a2b] border border-gray-600 placeholder-gray-400 outline-none text-sm text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent shadow-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-300 font-medium">Tech stack</label>
                    <input
                      type="text"
                      value={editing.tech_stack ?? ""}
                      onChange={(e) => changeField("tech_stack", e.target.value)}
                      placeholder="e.g. react, python"
                      className="mt-1 w-full px-3 py-2 rounded-md bg-[#071a2b] border border-gray-600 placeholder-gray-400 outline-none text-sm text-gray-100 focus:ring-2 focus:ring-sky-500 focus:border-transparent shadow-sm"
                    />
                  </div>

                  

                  {/* Email - read only full-width */}
                  <div className="sm:col-span-2">
                    <label className="text-xs text-gray-300 font-medium">Email (read-only)</label>
                    <input
                      type="text"
                      value={profile.email || ""}
                      readOnly
                      className="mt-1 w-full px-3 py-2 rounded-md bg-[#061427] border border-gray-700 opacity-95 cursor-not-allowed text-sm text-gray-200"
                    />
                  </div>

                  {/* Meta info */}
                  <div className="sm:col-span-2 flex flex-wrap gap-4 text-xs text-gray-300 mt-1">
                    {profile.created_at && (
                      <div className="px-2 py-1 bg-[#061427] rounded-md border border-gray-700">Member since: <span className="text-gray-200 ml-1">{new Date(profile.created_at).toLocaleDateString()}</span></div>
                    )}
                    {profile.last_login && (
                      <div className="px-2 py-1 bg-[#061427] rounded-md border border-gray-700">Last login: <span className="text-gray-200 ml-1">{new Date(profile.last_login).toLocaleString()}</span></div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="px-4 py-2 rounded-full bg-[#3b82f6] text-black font-semibold disabled:opacity-60 shadow"
                  >
                    {saving ? "Saving..." : "Save changes"}
                  </button>

                  <button
                    onClick={() => {
                      const init = {};
                      Object.keys(profile || {}).forEach((k) => (init[k] = profile[k]));
                      setEditing(init);
                      setStatusMsg("Changes discarded");
                      setTimeout(() => setStatusMsg(null), 2000);
                    }}
                    className="px-4 py-2 rounded-full border border-gray-700 text-gray-200"
                  >
                    Reset
                  </button>

                  {statusMsg && <div className="text-sm text-green-400">{statusMsg}</div>}
                  {error && <div className="text-sm text-red-400">{error}</div>}
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}

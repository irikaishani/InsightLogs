// src/pages/uploads.jsx
import React, { useRef, useState } from "react";
import Card from "../shared/Card";
import { API_BASE } from "../firebasework/firebaseconfig";
import { useNavigate } from "react-router-dom";

export default function Uploads() {
  const fileRef = useRef();
  const navigate = useNavigate();

  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [serverIds, setServerIds] = useState({ upload_id: null, job_id: null });
  const [startErr, setStartErr] = useState("");

  const pick = (f) => {
    setFile(f);
    setPreview(null);
    setStatus("");
    setProgress(0);
    setServerIds({ upload_id: null, job_id: null });
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pick(f);
  };

  const getToken = () =>
    localStorage.getItem("token") || sessionStorage.getItem("access_token") || null;

  const previewFileLocally = (file, maxLines = 200) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || "");
      const lines = text.split(/\r\n|\n/).slice(0, maxLines);
      setPreview({ name: file.name, size: file.size, lines });
    };
    reader.readAsText(file);
  };

  const startUpload = async () => {
    if (!file) {
      setStartErr("Please choose a file first");
      setTimeout(() => setStartErr(""), 3000);
      return;
    }

    setUploading(true);
    setStatus("Uploading...");
    setProgress(0);

    const token = getToken();

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", `${API_BASE}/upload`, true);
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (e) => {
          if (!e.lengthComputable) return;
          const pct = Math.round((e.loaded / e.total) * 100);
          setProgress(pct);
          setStatus(`Uploading... ${pct}%`);
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            let json = {};
            try {
              json = JSON.parse(xhr.responseText || "{}");
            } catch {}

            setProgress(100);
            setStatus("Upload complete");
            previewFileLocally(file);

            setServerIds({
              upload_id: json.upload_id || json.id || null,
              job_id: json.job_id || null,
            });

            resolve(json);
          } else {
            reject(new Error("Upload failed"));
          }
        };

        xhr.onerror = () => reject(new Error("Network error"));

        const form = new FormData();
        form.append("file", file);
        xhr.send(form);
      });
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleStartAnalysis = () =>
    serverIds.upload_id || serverIds.job_id
      ? navigate("/app/ai-analysis")
      : (setStartErr("Please upload a file first"),
        setTimeout(() => setStartErr(""), 3500));

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <header className="flex items-center justify-between p-4 border-b border-black/30">
        <div>
          <h1 className="text-2xl font-semibold text-[#93c5fd]">Uploads</h1>
          <p className="text-xs text-gray-400">
            Upload log files (.jsonl / .log / .txt) for AI analysis
          </p>
        </div>
      </header>

      {/* Main Content — centered & spaced nicely */}
      <main className="p-6 flex flex-col gap-8 max-w-5xl mx-auto">

        {/* Upload Section (Bigger + Cleaner) */}
        <Card title="Upload Logs">
          <div
            onDrop={onDrop}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            className={`relative p-10 rounded-xl transition-all ${
              drag ? "border-2 border-[#3b82f6]/60" : "border border-[#1f2937]"
            } bg-[#0b1320]`}
          >
            {/* Overlay During Upload */}
            {uploading && (
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center rounded-xl">
                <div className="flex flex-col items-center gap-4">
                  <div className="animate-spin h-8 w-8 border-4 border-[#93c5fd] border-t-transparent rounded-full"></div>
                  <p className="text-white text-sm font-medium">
                    Uploading… {progress}%
                  </p>
                  <div className="w-64 h-2 bg-black/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#3b82f6]"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )}

            {/* Upload UI */}
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-gray-300">Drop your file here or</p>

              <button
                onClick={() => fileRef.current.click()}
                disabled={uploading}
                className="px-5 py-2 rounded-full bg-[#3b82f6] text-black font-semibold hover:bg-[#60a5fa] transition disabled:opacity-50"
              >
                Choose File
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".log,.txt,.json,.jsonl,.csv"
                className="hidden"
                onChange={(e) => pick(e.target.files?.[0])}
                disabled={uploading}
              />

              <p className="text-xs text-gray-400">
                {file?.name || "No file selected"}
              </p>

              <button
                onClick={startUpload}
                disabled={uploading || !file}
                className="mt-3 px-5 py-2 rounded-full bg-[#3b82f6] text-black font-semibold disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Start Upload"}
              </button>

              <p className="text-xs text-gray-400 mt-2">{status}</p>

              {/* Inline Progress Bar */}
              {!uploading && progress > 0 && progress < 100 && (
                <div className="w-full max-w-lg h-2 bg-black/30 rounded-full overflow-hidden mt-3">
                  <div
                    className="h-full bg-[#3b82f6]"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* File Preview Section */}
        {preview && (
          <Card title="File Preview">
            <div className="max-h-64 overflow-auto bg-[#020617] p-4 rounded-lg text-xs text-gray-200 space-y-1">
              {preview.lines.map((ln, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-500">{i + 1}.</span>
                  <span className="whitespace-pre-wrap">{ln}</span>
                </div>
              ))}
            </div>

            {serverIds.upload_id && (
              <div className="mt-3 text-xs text-gray-400">
                Upload ID:{" "}
                <span className="text-gray-200">{serverIds.upload_id}</span>
              </div>
            )}
            {serverIds.job_id && (
              <div className="mt-1 text-xs text-gray-400">
                Job ID: <span className="text-gray-200">{serverIds.job_id}</span>
              </div>
            )}
          </Card>
        )}

        {/* Start Analysis Button */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleStartAnalysis}
              className="px-6 py-2 rounded-full bg-green-500 text-black font-semibold hover:bg-green-400 transition"
            >
              Start Analyzing
            </button>
            {startErr && <p className="text-sm text-red-400">{startErr}</p>}
          </div>
        </div>
      </main>
    </div>
  );
}

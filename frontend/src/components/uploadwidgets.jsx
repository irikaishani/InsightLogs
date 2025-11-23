// src/components/UploadWidget.jsx
import React, { useRef, useState } from "react";

export default function UploadWidget() {
  const fileRef = useRef();
  const [file, setFile] = useState(null);

  const pick = (f) => setFile(f);
  return (
    <div>
      <div className="p-4 rounded-lg bg-[#071021] border border-black/20">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-sm text-gray-300">Drop .jsonl or .log file or</div>
            <div className="mt-2">
              <button onClick={() => fileRef.current.click()} className="px-3 py-2 rounded-full bg-[#3b82f6] text-black">Choose file</button>
              <input ref={fileRef} className="sr-only" type="file" onChange={(e) => pick(e.target.files?.[0])} />
            </div>
            <div className="text-xs text-gray-400 mt-2">{file?.name || "No file selected"}</div>
          </div>
          <div>
            <button disabled={!file} onClick={async () => {
              if(!file) return;
              const fd = new FormData(); fd.append("file", file);
              const token = sessionStorage.getItem("access_token");
              const res = await fetch("/api/upload", { method: "POST", body: fd, headers: { Authorization: `Bearer ${token}` } });
              if(!res.ok) return alert("Upload failed");
              const j = await res.json();
              alert(`Upload queued — job ${j.job_id}`);
            }} className="px-3 py-2 rounded-full bg-[#3b82f6]">Start Upload</button>
          </div>
        </div>
      </div>
    </div>
  );
}

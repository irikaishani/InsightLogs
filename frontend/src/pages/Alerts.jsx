// src/pages/logs.jsx
import React, { useState } from "react";
import Card from "../shared/Card";

const mockLogs = [
  { id: 1, timestamp: "2025-11-15 10:15", level: "ERROR", service: "api", message: "DB connection timeout" },
  { id: 2, timestamp: "2025-11-15 10:16", level: "WARN", service: "worker", message: "Retrying job: payment-sync" },
  { id: 3, timestamp: "2025-11-15 10:17", level: "INFO", service: "auth", message: "User login succeeded" },
];

export default function Logs() {
  const [q, setQ] = useState("");
  const results = mockLogs.filter((r) => [r.message, r.service, r.level].join(" ").toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-4 border-b border-black/30">
        <h1 className="text-lg font-semibold text-[#93c5fd]">Logs Explorer</h1>
        <div className="text-sm text-gray-400">Search & filter parsed logs</div>
      </header>

      <main className="p-6">
        <div className="mb-4 flex gap-3">
          <input placeholder="Search logs, service, message..." value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 px-3 py-2 rounded-full bg-[#0b1220] text-sm" />
          <select className="px-3 py-2 rounded-full bg-[#0b1220] text-sm">
            <option value="">All levels</option>
            <option>ERROR</option>
            <option>WARN</option>
            <option>INFO</option>
          </select>
        </div>

        <Card title="Results">
          <div className="bg-[#071021] rounded p-3">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-gray-400 border-b border-black/30">
                <tr><th className="py-2">Time</th><th>Level</th><th>Service</th><th>Message</th></tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className="odd:bg-black/20 hover:bg-black/30">
                    <td className="py-2 text-xs text-gray-300">{r.timestamp}</td>
                    <td className={`text-sm ${r.level === "ERROR" ? "text-red-400" : "text-gray-300"}`}>{r.level}</td>
                    <td className="text-sm text-gray-300">{r.service}</td>
                    <td className="text-sm text-gray-200">{r.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}

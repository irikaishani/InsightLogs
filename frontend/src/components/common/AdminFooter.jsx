// src/components/common/AdminFooter.jsx
import React from "react";

export default function AdminFooter() {
  return (
    <footer className="border-t border-black/30 bg-[#021016] text-gray-300 p-4 mt-6">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="text-sm">InsightLogs — personal dashboard for log analysis</div>
        <div className="flex items-center gap-4 text-sm">
          <a href="https://github.com/" target="_blank" rel="noreferrer" className="hover:text-white">GitHub</a>
          <a href="https://www.linkedin.com/" target="_blank" rel="noreferrer" className="hover:text-white">LinkedIn</a>
          <a href="mailto:you@example.com" className="hover:text-white">you@example.com</a>
        </div>
      </div>
    </footer>
  );
}

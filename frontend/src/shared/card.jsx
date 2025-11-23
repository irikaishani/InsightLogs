// src/shared/Card.jsx
import React from "react";

export default function Card({ title, children }) {
  return (
    <div className="p-4 rounded-2xl bg-[#071021] border border-black/40 shadow-[0_6px_20px_rgba(0,0,0,0.6)]">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200">{title}</h3>
        <div className="text-xs text-gray-400">view</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

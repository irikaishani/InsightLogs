// src/components/common/sidebar.jsx
import React from "react";
import { NavLink, useNavigate } from "react-router-dom";

function Item({ to, label, emoji, onClick }) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
          isActive ? "bg-black/40 ring-1 ring-[#3b82f6]/30" : "hover:bg-black/20"
        }`
      }
    >
      <div className="w-8 h-8 rounded-md bg-[#111827] flex items-center justify-center">
        {emoji}
      </div>
      <div className="text-sm text-gray-200">{label}</div>
    </NavLink>
  );
}

export default function Sidebar({ onNavigate, showBranding = true }) {
  const navigate = useNavigate();

  const maybeNavigate = () => {
    if (typeof onNavigate === "function") onNavigate();
  };

  function handleLogout() {
    // Clear auth data (matches LoginPage and ProtectedRoute)
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("access_token");

    maybeNavigate();
    // redirect to login
    navigate("/login", { replace: true });
  }

  return (
    <div>
      {showBranding && (
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#7dd3fc] flex items-center justify-center">
            <span className="font-bold text-black">IL</span>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#93c5fd]">InsightLogs</h2>
            <p className="text-xs text-gray-400">Your dashboard</p>
          </div>
        </div>
      )}

      <nav className="flex flex-col gap-2">
        <Item to="/app/dashboard" label="Dashboard" emoji="📊" onClick={maybeNavigate} />
        <Item to="/app/uploads" label="Upload" emoji="📁" onClick={maybeNavigate} />
        <Item to="/app/logs" label="Logs Explorer" emoji="🧾" onClick={maybeNavigate} />
        <Item to="/app/profile" label="Profile" emoji="👤" onClick={maybeNavigate} />
        <Item to="/app/ai-analysis" label="AI Analysis" emoji="🤖" onClick={maybeNavigate} />
      </nav>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="mt-6 w-full flex items-center gap-3 px-3 py-2 rounded-md bg-red-600/80 hover:bg-red-700 text-white transition-all"
      >
        <div className="w-8 h-8 rounded-md bg-[#111827] flex items-center justify-center">🚪</div>
        <span className="text-sm font-medium">Logout</span>
      </button>
    </div>
  );
}

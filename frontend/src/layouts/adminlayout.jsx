// src/components/common/AdminLayout.jsx
import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/common/sidebar";
import CursorGlow from "../components/common/cursorglow";
import AdminFooter from "../components/common/AdminFooter";
import { useState } from "react";

export default function AdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleNavigate = () => {
    setDrawerOpen(false);
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <CursorGlow />

      {/* Mobile header */}
      <div className="lg:hidden bg-[#071021] border-b border-black/20 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setDrawerOpen(true)} aria-label="Open menu" className="p-2 rounded-md bg-black/40">
              <svg className="w-5 h-5 text-gray-200" viewBox="0 0 24 24" fill="none">
                <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className="text-sm font-semibold text-[#93c5fd]">InsightLogs</div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#111827] flex items-center justify-center text-sm">I</div>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="w-64 hidden lg:block border-r border-black/30 bg-[#061021] p-5">
          <Sidebar onNavigate={() => {}} />
        </aside>

        {/* Mobile drawer (pass showBranding={false} so branding isn't duplicated) */}
        {drawerOpen && (
          <>
            <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setDrawerOpen(false)} />
            <div className="fixed left-0 top-0 z-50 w-64 h-full bg-[#061021] p-5 overflow-auto lg:hidden transform transition-transform">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#3b82f6] to-[#7dd3fc] flex items-center justify-center">
                    <span className="font-bold text-black">IL</span>
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#93c5fd]">InsightLogs</h2>
                    <p className="text-xs text-gray-400">Your dashboard</p>
                  </div>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-md text-gray-300">✕</button>
              </div>

              {/* Sidebar here hides its branding (we already show it above in the drawer header) */}
              <Sidebar onNavigate={handleNavigate} showBranding={false} />
            </div>
          </>
        )}

        <div className="flex-1">
          <main>
            <Outlet />
          </main>
          <AdminFooter />
        </div>
      </div>
    </div>
  );
}
// src/App.jsx
import React from "react";
import { Routes, Route, useLocation, Navigate } from "react-router-dom";

import Header from "./components/common/header";
import Footer from "./components/common/footer";
import Mainsection from "./components/landing/mainsection";
import Features from "./components/landing/features";
import LoginPage from "./authenticationpages/login";
import SignupPage from "./authenticationpages/signup";

// Admin pages
import AdminLayout from "./layouts/adminlayout";
import Dashboard from "./pages/dashboard";
import Uploads from "./pages/Uploads";
import Logs from "./pages/logs";
import Profile from "./pages/profile";
import AiAnalysis from "./pages/AiAnalysis";

// Protect routes
import ProtectedRoute from "./auth/ProtectedRoute";

/**
 * App root:
 * - Public pages show Header + Footer
 * - Admin pages hide Header/Footer
 *
 * NOTE: Do NOT wrap App with another <BrowserRouter>.
 */
export default function App() {
  const location = useLocation();

  // treat only /app/* as admin area (AdminLayout area)
  const isAdmin = location.pathname.startsWith("/app");

  return (
    <>
      {!isAdmin && <Header />}

      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Mainsection />} />
        <Route path="/features" element={<Features />} />
        
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* Protected admin area */}
        <Route element={<ProtectedRoute />}>
          <Route path="/app" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="uploads" element={<Uploads />} />
            <Route path="logs" element={<Logs />} />
            <Route path="profile" element={<Profile />} />
            {/* use lowercase path to match sidebar -> /app/ai-analysis */}
            <Route path="ai-analysis" element={<AiAnalysis />} />
          </Route>
        </Route>

        {/* Legacy/shortcut routes — redirect to the /app equivalents
            This prevents "random" pages when user clicks old links like /logs or /dashboard
        */}
        <Route path="/dashboard" element={<Navigate to="/app/dashboard" replace />} />
        <Route path="/uploads" element={<Navigate to="/app/uploads" replace />} />
        <Route path="/logs" element={<Navigate to="/app/logs" replace />} />
        <Route path="/profile" element={<Navigate to="/app/profile" replace />} />
        <Route path="/ai-analysis" element={<Navigate to="/app/ai-analysis" replace />} />

        {/* fallback to public home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {!isAdmin && <Footer />}
    </>
  );
}

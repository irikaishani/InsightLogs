// src/authenticationpages/LoginPage.jsx
import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { signInWithGooglePopup } from "../firebasework/auth";
import { API_BASE } from "../firebasework/firebaseconfig";

const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // <-- added

  // default to the canonical dashboard route (so URL becomes /dashboard)
  const from = location.state?.from?.pathname || "/dashboard";


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Please enter both email and password.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        let msg = "Login failed";
        try {
          const j = await res.json();
          msg = j.detail || j.error || JSON.stringify(j);
        } catch (err) {
          const t = await res.text().catch(() => null);
          if (t) msg = t;
        }
        throw new Error(msg);
      }

      const data = await res.json();

      if (!data || !data.access_token) {
        throw new Error("No access token returned from server.");
      }

      sessionStorage.setItem("access_token", data.access_token);
      if (data.user) {
        try { sessionStorage.setItem("user", JSON.stringify(data.user)); } catch (e) { }
      }


      navigate(from, { replace: true });
    } catch (err) {
      console.error("Login error:", err);
      alert(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const cred = await signInWithGooglePopup();
      const idToken = await cred.user.getIdToken(true);

      const res = await fetch(`${API_BASE}/api/auth/google-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ email: cred.user.email }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "Server error");
        console.error("google-login failed:", txt);
        alert("Server login failed.");
        return;
      }

      const data = await res.json();

      if (!data || !data.access_token) {
        throw new Error("No access token returned from server (google-login).");
      }

      // keep token in sessionStorage under the unified key "access_token"
      sessionStorage.setItem("access_token", data.access_token);


      if (data.user) {
        try {
          localStorage.setItem("user", JSON.stringify(data.user));
        } catch (e) { }
      }

      navigate(from, { replace: true });
    } catch (err) {
      console.error("Google sign-in error:", err);
      alert("Google sign-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen items-center justify-center px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-950 via-gray-900 to-black">
      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg bg-black/60 rounded-2xl shadow-[0_0_25px_rgba(100,150,255,0.2)] p-6 sm:p-8 md:p-10 backdrop-blur-sm mt-20 md:mt-24">

        <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold text-center mb-6 sm:mb-8 text-[#7dd3fc] drop-shadow-[0_0_12px_rgba(125,211,252,0.6)]">
          Welcome Back
        </h1>

        <form className="flex flex-col gap-4 sm:gap-5" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Enter your registered Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-full bg-[#1a1a1a]/70 border border-transparent focus:border-[#7dd3fc] outline-none text-white placeholder-gray-400 transition-all duration-300 text-sm sm:text-base"
            autoComplete="email"
            name="email"
          />

          {/* password field with view toggle (only this block changed) */}
          <div className="relative w-full">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 sm:px-5 py-3 sm:py-4 rounded-full bg-[#1a1a1a]/70 border border-transparent focus:border-[#7dd3fc] outline-none text-white placeholder-gray-400 transition-all duration-300 text-sm sm:text-base pr-12"
              autoComplete="current-password"
              name="password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-transparent text-gray-300 hover:text-white focus:outline-none"
            >
              {/* simple eye / eye-off SVGs */}
              {showPassword ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M10.47 10.47a3 3 0 104.24 4.24M9.88 5.03A10.97 10.97 0 0121 12c-1.2 2.09-3.02 3.86-5.14 4.95M6.18 6.18A10.97 10.97 0 003 12c1.2 2.09 3.02 3.86 5.14 4.95" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-4 sm:mt-6 w-full py-3 sm:py-4 rounded-full font-semibold tracking-wide bg-[#3b82f6] border-b-4 border-[#2563eb] text-white hover:bg-[#60a5fa] hover:border-[#93c5fd] hover:drop-shadow-[0_0_14px_rgba(125,211,252,0.6)] transition-all duration-300 cursor-pointer text-sm sm:text-base disabled:opacity-60"
          >
            {loading ? "Logging in..." : "LOG IN"}
          </button>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="mt-3 w-full flex items-center justify-center gap-3 py-3 rounded-full border border-[#7dd3fc]/50 bg-[#1a1a1a]/60 hover:bg-[#1a1a1a]/80 text-white font-medium transition-all duration-300 hover:drop-shadow-[0_0_10px_rgba(125,211,252,0.5)] text-sm sm:text-base disabled:opacity-60"
          >
            <img src="https://www.svgrepo.com/show/475656/google-color.svg" alt="Google" className="w-5 h-5" />
            Continue with Google
          </button>
        </form>

        {/* Removed Forgot Password Section */}
        <div className="flex flex-col sm:flex-row justify-center items_center mt-4 sm:mt-6 gap-2 text-sm text-center flex-wrap">
          <span className="text-gray-400">Don't have an account? </span>
          <Link to="/signup" className="text-[#7dd3fc] hover:text-[#b7aaff] transition-colors duration-300">
            Sign Up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;

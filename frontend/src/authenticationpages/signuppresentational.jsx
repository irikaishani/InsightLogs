// src/SignupPagePresentational.js
import React, { useState, useEffect } from "react";

/**
 * Props:
 * - onContinue(profilePayload) -> Promise
 * - onGoogleSignIn()
 * - externalVerified: boolean (ignored, kept for compatibility)
 * - initialTimer: number
 * - initialEmail: string (optional)
 * - verifyError: boolean (ignored)
 */
export default function SignupPagePresentational({
  onContinue = () => {},
  onGoogleSignIn = () => {},
  externalVerified = true, // verification disabled; keep default true for compatibility
  initialTimer = 0,
  initialEmail = "",
  verifyError = false,
}) {
  const [timer] = useState(initialTimer);
  const [emailVerified] = useState(true); // keep true so UI doesn't block
  const [checking] = useState(false);
  const [sending] = useState(false);

  // Controlled form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  // username removed per request
  const [role, setRole] = useState("");
  const [org, setOrg] = useState("");
  const [techStack, setTechStack] = useState("");
  const [agreed, setAgreed] = useState(false);

  // inline submit error message (red)
  const [submitErrorMsg, setSubmitErrorMsg] = useState("");

  // populate email from initialEmail on first real value
  useEffect(() => {
    if (initialEmail && !email) {
      setEmail(initialEmail);
    }
  }, [initialEmail, email]);

  // we intentionally do NOT use any verification UI/state (verification removed)

  const handleSubmit = (e) => {
    e.preventDefault();

    // Basic required checks (no email verification)
    if (!email) {
      setSubmitErrorMsg("❌ Please enter your email.");
      const el = document.querySelector('input[type="email"]');
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    // clear any previous submit error
    setSubmitErrorMsg("");

    if (!agreed) {
      alert("Please agree to the Terms & Conditions.");
      return;
    }
    // username removed: do not require username
    if (!password) {
      alert("Please enter a password.");
      return;
    }
    if (password !== confirmPassword) {
      alert("Passwords do not match.");
      return;
    }
    const payload = {
      name: fullName || "",
      email,
      password,
      role,
      organization: org || "",
      tech_stack: techStack || "",
    };

    onContinue(payload);
  };

  return (
    <div className="relative min-h-screen w-full bg-black flex items-center justify-center overflow-hidden px-5 sm:px-6 lg:px-8 lg:py-40 py-30 sm:py-20">
      {/* Card wrapper - keep same spacing from top/bottom as requested */}
      <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl relative">
        {/* Soft glowing gradient behind the card for a stronger glow effect */}
        <div
          aria-hidden="true"
          className="absolute -inset-1 rounded-2xl blur-3xl opacity-60 transform-gpu scale-105 pointer-events-none
                     bg-gradient-to-r from-[#06b6d4]/40 via-[#7c3aed]/30 to-[#60a5fa]/40 animate-pulse"
        />

        <div className="relative bg-black/60 rounded-2xl p-6 sm:p-8 md:p-10
                        shadow-[0_10px_40px_rgba(59,130,246,0.12),0_0_50px_rgba(99,102,241,0.06)]
                        ring-1 ring-[#60a5fa]/10 backdrop-blur-sm">
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-center mb-6 sm:mb-8 text-[#93c5fd] drop-shadow-[0_0_10px_rgba(147,197,253,0.9)]">
            Create Your Account
          </h1>

          {/* submit error */}
          {submitErrorMsg && (
            <p className="text-center text-sm text-red-400 mb-2 font-medium">
              {submitErrorMsg}
            </p>
          )}

          <form className="flex flex-col gap-3 sm:gap-4" onSubmit={handleSubmit}>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              type="text"
              placeholder="Full Name"
              className="w-full px-4 py-3 rounded-full bg-[#111111]/70 border border-transparent focus:border-[#7dd3fc] text-white placeholder-gray-400 outline-none transition-all duration-300 text-sm sm:text-base"
            />

            {/* Email area (no verification controls) */}
            <div className="relative">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                placeholder="Email"
                className={`w-full px-4 py-3 rounded-full bg-[#111111]/70 border border-transparent focus:border-[#7dd3fc] text-white placeholder-gray-400 outline-none transition-all duration-300 text-sm sm:text-base`}
              />
            </div>

            {/* small helper text kept for spacing/UX */}
            <p className="text-center text-xs sm:text-sm text-gray-400 mt-1">
              Enter your email and choose a password to create an account.
            </p>

            {/* Password fields */}
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="Password"
              className="w-full px-4 py-3 rounded-full bg-[#111111]/70 border border-transparent focus:border-[#7dd3fc] text-white placeholder-gray-400 outline-none transition-all duration-300 text-sm sm:text-base"
            />
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              placeholder="Confirm Password"
              className="w-full px-4 py-3 rounded-full bg-[#111111]/70 border border-transparent focus:border-[#7dd3fc] text-white placeholder-gray-400 outline-none transition-all duration-300 text-sm sm:text-base"
            />

            {/* Role */}
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-4 py-3 rounded-full bg-[#111111]/70 border border-transparent focus:border-[#b7aaff] text-white outline-none transition-all duration-300 text-sm sm:text-base"
            >
              <option value="">Select Role / Position</option>
              <option value="developer">Developer</option>
              <option value="qa">QA Engineer</option>
              <option value="devops">DevOps</option>
              <option value="data">Data Analyst</option>
            </select>

            <input
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              type="text"
              placeholder="Organization / Team Name (Optional)"
              className="w-full px-4 py-3 rounded-full bg-[#111111]/70 border border-transparent focus:border-[#b7aaff] text-white placeholder-gray-400 outline-none transition-all duration-300 text-sm sm:text-base"
            />

            <input
              value={techStack}
              onChange={(e) => setTechStack(e.target.value)}
              type="text"
              placeholder="Primary Tech Stack (e.g. React, FastAPI)"
              className="w-full px-4 py-3 rounded-full bg-[#111111]/70 border border-transparent focus:border-[#b7aaff] text-white placeholder-gray-400 outline-none transition-all duration-300 text-sm sm:text-base"
            />

            {/* Terms */}
            <div className="flex items-start gap-2 mt-3 text-xs sm:text-sm flex-wrap">
              <input
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                type="checkbox"
                id="terms"
                className="w-4 h-4 accent-[#7dd3fc]"
              />
              <label htmlFor="terms" className="text-gray-400">
                I agree to the{" "}
                <a href="#" className="text-[#7dd3fc] hover:text-[#b7aaff]">
                  Terms & Conditions
                </a>
              </label>
            </div>

            {/* SIGN UP (primary) */}
            <button
              type="submit"
              className="mt-5 w-full py-3 rounded-full font-semibold tracking-wide
                         bg-gradient-to-r from-[#3b82f6] to-[#60a5fa] border-b-4 border-[#2563eb]
                         text-white hover:from-[#60a5fa] hover:to-[#93c5fd] hover:border-[#93c5fd]
                         hover:drop-shadow-[0_0_18px_rgba(99,102,241,0.35)] transition-all duration-300 cursor-pointer text-sm sm:text-base"
            >
              SIGN UP
            </button>

            {/* Continue with Google */}
            <button
              type="button"
              onClick={() => onGoogleSignIn()}
              className="mt-3 w-full flex items-center justify-center gap-3 py-3 rounded-full border border-[#7dd3fc]/50 bg-[#111111]/60 hover:bg-[#111111]/80 text-white font-medium transition-all duration-300 hover:drop-shadow-[0_0_12px_rgba(125,211,252,0.45)] text-sm sm:text-base"
            >
              <img
                src="https://www.svgrepo.com/show/475656/google-color.svg"
                alt="Google"
                className="w-5 h-5"
              />
              Continue with Google
            </button>
          </form>

          <div className="text-center mt-5 sm:mt-6 text-sm text-gray-400">
            Already have an account?{" "}
            <a
              href="/login"
              className="text-[#7dd3fc] hover:text-[#b7aaff] transition-colors duration-300"
            >
              Log In
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

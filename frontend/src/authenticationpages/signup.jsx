// src/authenticationpages/signup.jsx
import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SignupPagePresentational from "./signuppresentational";
import { signInWithGooglePopup } from "../firebasework/auth";
import { API_BASE } from "../firebasework/firebaseconfig.js";

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();

  // optionally prefill email if passed via navigation state
  const [initialEmail] = useState(location.state?.email || "");

  const [loading, setLoading] = useState(false);

  // Called by presentational when the user clicks SIGN UP
  const handleContinue = async (profilePayload) => {
    try {
      // ensure email present (presentational also checks, but double-check here)
      if (!profilePayload.email) {
        if (initialEmail) profilePayload.email = initialEmail;
      }
      if (!profilePayload.email) {
        alert("Please enter an email.");
        return;
      }

      // basic client-side check for password presence (presentational already checks)
      if (!profilePayload.password) {
        alert("Please enter a password.");
        return;
      }

      setLoading(true);
      // inside handleContinue before fetch(...)
      console.log("signup payload (JS object):", profilePayload);
      console.log("signup payload (JSON):", JSON.stringify(profilePayload));

      


      const res = await fetch(`${API_BASE}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profilePayload),
      });

      if (!res.ok) {
        // try to parse server error message
        let errMsg = "Signup failed. Try again.";
        try {
          const j = await res.json();
          errMsg = j.detail || JSON.stringify(j) || errMsg;
        } catch (e) {
          const txt = await res.text().catch(() => null);
          if (txt) errMsg = txt;
        }
        console.error("signup failed:", errMsg);
        alert(errMsg);
        return;
      }

      // success
      alert("Account created — please log in.");
      navigate("/login");
    } catch (err) {
      console.error("handleContinue error:", err);
      alert("Error creating account.");
    } finally {
      setLoading(false);
    }
  };

  // Google sign-in: keep the popup flow and exchange token with backend
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const cred = await signInWithGooglePopup();
      const idToken = await cred.user.getIdToken(true);

      const res = await fetch(`${API_BASE}/api/auth/google-login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
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
      sessionStorage.setItem("access_token", data.access_token);
      navigate("/dashboard");
    } catch (err) {
      console.error("Google sign-in error:", err);
      alert("Google sign-in failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SignupPagePresentational
      onContinue={handleContinue}
      onGoogleSignIn={handleGoogleSignIn}
      externalVerified={true} // verification disabled — keep presentational accepting submits
      initialTimer={0}
      initialEmail={initialEmail}
      verifyError={false}
    />
  );
}

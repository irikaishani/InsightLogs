// src/auth/ProtectedRoute.jsx
import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

/** 
 * Find token in BOTH storages (localStorage + sessionStorage).
 * This makes login always work regardless of where you store the token.
 */
function getStoredToken() {
  try {
    const possibleKeys = [
      "token",
      "access_token",
      "authToken",
      "idToken"
    ];

    for (let key of possibleKeys) {
      let t =
        localStorage.getItem(key) ||
        sessionStorage.getItem(key);

      if (t && t !== "undefined" && t !== "null" && t.trim() !== "") {
        return t;
      }
    }

    return null;
  } catch (err) {
    console.error("ProtectedRoute: error reading token:", err);
    return null;
  }
}

/** Basic check: if token looks like a JWT and is expired */
function isTokenExpired(token) {
  if (!token || typeof token !== "string") return true;

  const parts = token.split(".");
  if (parts.length !== 3) return false; // not a JWT → skip check

  try {
    const payload = JSON.parse(atob(parts[1]));
    if (!payload.exp) return false; // no exp claim → assume valid
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now;
  } catch (err) {
    console.warn("ProtectedRoute: JWT decode failed", err);
    // if decode fails treat token as invalid
    return true;
  }
}

export default function ProtectedRoute() {
  const location = useLocation();
  const token = getStoredToken();

  // console.log("ProtectedRoute token:", token);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isTokenExpired(token)) {
    // clear expired token
    try {
      ["token", "access_token", "authToken", "idToken"].forEach((k) => {
        localStorage.removeItem(k);
        sessionStorage.removeItem(k);
      });
    } catch {}

    return <Navigate to="/login" replace state={{ from: location, expired: true }} />;
  }

  return <Outlet />;
}

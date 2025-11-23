// src/firebase/auth.js
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  confirmPasswordReset as fbConfirmPasswordReset,
} from "firebase/auth";

import { auth } from "./firebaseconfig";

/**
 * Google popup sign-in
 * returns the credential (user) on success
 */
export async function signInWithGooglePopup() {
  const provider = new GoogleAuthProvider();
  const cred = await signInWithPopup(auth, provider);
  return cred;
}

/**
 * Password reset (sends reset email via Firebase)
 * keep this if you want users to be able to reset password via email
 */
export async function sendPasswordReset(email, redirectUrl) {
  const actionCodeSettings = {
    url: redirectUrl || `${window.location.origin}/resetpassword`,
    handleCodeInApp: true,
  };
  return fbSendPasswordResetEmail(auth, email, actionCodeSettings);
}

/**
 * Confirm password reset with oobCode and new password
 */
export async function confirmPasswordReset(oobCode, newPassword) {
  return fbConfirmPasswordReset(auth, oobCode, newPassword);
}

/**
 * Sign out
 */
export async function signOut() {
  return firebaseSignOut(auth);
}

/**
 * Helper to get idToken of current user
 */
export async function getIdToken(force = false) {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(force);
}

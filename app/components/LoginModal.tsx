"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/app/providers";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { EyeIcon, EyeSlashIcon, ExclamationCircleIcon, CheckCircleIcon, EnvelopeIcon, UserCircleIcon, KeyIcon, ArrowPathIcon, XMarkIcon } from "@heroicons/react/24/outline";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  redirectTo?: string;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, redirectTo = "/" }) => {
  const router = useRouter();
  const { user, loading } = useAuth();

  // Form states
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Feedback states
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Display name validation regex (aligned with isValidString in Firestore rules)
  const displayNameRegex = /^[a-zA-Z0-9\s\-_.,:;!?()@#]{1,50}$/;

  // Add loading state
  const [loadingAction, setLoadingAction] = useState(false);

  // Add password strength state
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordStrengthLabel, setPasswordStrengthLabel] = useState("");

  // Password strength logic
  useEffect(() => {
    if (mode === "signup") {
      let score = 0;
      if (password.length >= 6) score++;
      if (/[A-Z]/.test(password)) score++;
      if (/[0-9]/.test(password)) score++;
      if (/[^A-Za-z0-9]/.test(password)) score++;
      setPasswordStrength(score);
      setPasswordStrengthLabel([
        "Too weak",
        "Weak",
        "Medium",
        "Strong",
        "Very strong",
      ][score]);
    } else {
      setPasswordStrength(0);
      setPasswordStrengthLabel("");
    }
  }, [password, mode]);

  // Store current page in localStorage before opening modal
  useEffect(() => {
    if (isOpen && !user && !loading) {
      const currentPath = window.location.pathname;
      if (currentPath !== "/login") {
        localStorage.setItem("lastPath", currentPath);
      }
    }
  }, [isOpen, user, loading]);

  // Close modal and redirect if user logs in
  useEffect(() => {
    if (!loading && user && isOpen) {
      const lastPath = localStorage.getItem("lastPath") || redirectTo;
      const finalRedirect = lastPath !== "/login" && lastPath !== "" ? lastPath : redirectTo;
      if (finalRedirect === "/account") {
        router.push("/");
      } else {
        router.push(finalRedirect);
      }
      onClose();
    }
  }, [user, loading, isOpen, redirectTo, router, onClose]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setMode("login");
      setEmail("");
      setPassword("");
      setDisplayName("");
      setErrorMsg(null);
      setSuccessMsg(null);
      setShowPassword(false);
    }
  }, [isOpen]);

  // Handler for Google sign-in
  async function handleGoogleSignIn() {
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingAction(true);

    if (!auth || !db) {
      setErrorMsg("Authentication or database service not initialized.");
      console.error("Auth or db object is null. Check firebase.ts initialization.");
      setLoadingAction(false);
      return;
    }

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" }); // Force account selection
      console.log("Initiating Google sign-in...");
      const result = await signInWithPopup(auth, provider);
      console.log("Google sign-in result:", result);
      if (result.user) {
        console.log("Authenticated user:", result.user.uid, "Email:", result.user.email);
        const userDocRef = doc(db, "users", result.user.uid);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) {
          const googleDisplayName = (
            result.user.displayName?.replace(/[^a-zA-Z0-9\s\-_.,:;!?()@#]/g, "") ||
            `user_${result.user.uid.slice(0, 8)}`
          ).slice(0, 50);
          if (!displayNameRegex.test(googleDisplayName)) {
            throw new Error("Generated Google display name is invalid.");
          }
          const userData = {
            email: result.user.email || "",
            displayName: googleDisplayName,
            photoURL: result.user.photoURL || "",
            createdAt: new Date().toISOString(),
            hasSeenTutorial: false,
            uid: result.user.uid,
            roles: {},
          };
          console.log("Writing Google user data:", userData);
          // Retry setDoc with exponential backoff
          let attempts = 0;
          const maxAttempts = 3;
          while (attempts < maxAttempts) {
            try {
              await setDoc(userDocRef, userData);
              console.log("Created user document for Google user:", result.user.uid);
              break;
            } catch (setDocError: unknown) {
              attempts++;
              const errorMessage = setDocError instanceof Error ? setDocError.message : "Unknown error";
              const errorCode = (setDocError as { code?: string })?.code || "unknown";
              const errorStack = setDocError instanceof Error ? setDocError.stack : "No stack trace";
              console.error(`Attempt ${attempts} failed to write user document:`, {
                message: errorMessage,
                code: errorCode,
                stack: errorStack,
                userId: result.user.uid,
              });
              if (attempts === maxAttempts) {
                throw new Error("Failed to create user document after multiple attempts.");
              }
              await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempts)));
            }
          }
        } else {
          console.log("User document already exists:", result.user.uid);
        }
        // Success - modal will close automatically via useEffect
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      const errorCode = (err as { code?: string })?.code || "unknown";
      const errorStack = err instanceof Error ? err.stack : "No stack trace";
      console.error("Google sign-in error:", {
        message: errorMessage,
        code: errorCode,
        stack: errorStack,
      });
      setErrorMsg(
        errorCode === "auth/popup-blocked"
          ? "Google sign-in popup was blocked. Please allow popups and try again."
          : errorCode === "auth/invalid-credential"
          ? "Invalid Google credentials. Please try again."
          : errorCode === "auth/popup-closed-by-user"
          ? "Google sign-in was canceled. Please try again."
          : errorCode === "firestore/permission-denied"
          ? "Permission denied to create user document. Check input or contact support."
          : errorMessage || "Failed to sign in with Google."
      );
    } finally {
      setLoadingAction(false);
    }
  }

  // Handler for form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoadingAction(true);

    if (!auth || !db) {
      setErrorMsg("Authentication or database service not initialized.");
      console.error("Auth or db object is null. Check firebase.ts initialization.");
      setLoadingAction(false);
      return;
    }

    try {
      if (mode === "login") {
        await signInWithEmailAndPassword(auth, email, password);
        // Success - modal will close automatically via useEffect
      } else if (mode === "signup") {
        if (!displayName) {
          setErrorMsg("Please enter a display name.");
          setLoadingAction(false);
          return;
        }
        if (!displayNameRegex.test(displayName)) {
          setErrorMsg("Invalid display name format (1-50 characters, letters, numbers, or allowed symbols).");
          setLoadingAction(false);
          return;
        }
        if (password.length < 6) {
          setErrorMsg("Password must be at least 6 characters.");
          setLoadingAction(false);
          return;
        }
        const result = await createUserWithEmailAndPassword(auth, email, password);
        if (result.user) {
          const userDocRef = doc(db, "users", result.user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) {
            const userData = {
              email,
              displayName,
              photoURL: "",
              createdAt: new Date().toISOString(),
              hasSeenTutorial: false,
              uid: result.user.uid,
              roles: {},
            };
            try {
              await setDoc(userDocRef, userData);
            } catch {
              setErrorMsg("Failed to create user profile. Please try again or contact support.");
              setLoadingAction(false);
              return;
            }
          }
          // Success - modal will close automatically via useEffect
        }
      } else if (mode === "forgot") {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg("Password reset email sent (if email is registered).");
        setMode("login");
      }
    } catch (err: unknown) {
      // Robust error handling for login/signup/forgot
      console.error(`${mode} error:`, err);
      let userMessage = "An error occurred.";
      if (err && typeof err === "object") {
        const errorCode = (err as { code?: string })?.code;
        const errorMessage = (err as { message?: string })?.message;
        if (errorCode === "auth/invalid-credential") userMessage = "Invalid email or password.";
        else if (errorCode === "auth/user-not-found") userMessage = "No account found with this email.";
        else if (errorCode === "auth/email-already-in-use") userMessage = "This email is already registered.";
        else if (typeof errorMessage === "string" && errorMessage.trim() !== "") userMessage = errorMessage;
      }
      setErrorMsg(userMessage);
    } finally {
      setLoadingAction(false);
    }
  }

  if (loading) {
    return null;
  }

  if (user) {
    return null;
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed inset-0 z-50 sm:flex sm:items-center sm:justify-center sm:p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-full sm:h-auto sm:max-w-md sm:mx-auto">
              <div className="relative flex w-full h-full sm:h-auto flex-col items-center sm:rounded-2xl sm:border sm:border-blue-500/15 bg-[#070b17] px-4 py-6 sm:px-10 sm:py-10">
                {/* Close Button */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg bg-gray-900/50 hover:bg-gray-900 border border-gray-800 hover:border-gray-700 text-gray-300 hover:text-white transition-all duration-200"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                {/* Logo/Brand */}
                <div className="mb-8 flex flex-col items-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center">
                    <Image
                      src="https://i.imgur.com/d2OCO6H.png"
                      alt="CypherX"
                      width={40}
                      height={40}
                      className="h-10 w-10 object-contain"
                      priority
                    />
                  </div>
                  <h1
                    className="text-xl font-bold uppercase tracking-[0.16em] text-blue-100 sm:text-2xl"
                    style={{ fontFamily: "'Poppins', sans-serif" }}
                  >
                    CYPHERX
                  </h1>
                </div>

                {/* Tab Navigation */}
                <div className="mb-6 grid w-full grid-cols-3 overflow-hidden rounded-xl border border-blue-600/20 bg-[#11182d] sm:mb-8">
                  {[{ key: "login", label: "Login" }, { key: "signup", label: "Sign Up" }, { key: "forgot", label: "Forgot" }].map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setMode(tab.key as typeof mode)}
                      className={`flex-1 py-2 font-sans text-xs font-medium transition-all duration-200 focus:outline-none sm:text-sm ${
                        mode === tab.key
                          ? "bg-blue-500/25 text-blue-100 shadow-[inset_0_0_10px_rgba(59,130,246,0.25)]"
                          : "text-gray-400 hover:text-blue-200"
                      } ${mode !== tab.key ? "border-blue-500/10" : ""}`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Animated Form Content */}
                <div className="w-full transition-all duration-300">
                  <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                    {(mode === "login" || mode === "signup" || mode === "forgot") && (
                      <div className="relative">
                        <EnvelopeIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-500" />
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email"
                          className={`w-full rounded-xl border bg-[#10172b] py-2 pl-11 pr-3 font-sans text-sm text-white placeholder-gray-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/60 ${
                            email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? "border-red-500/60" : "border-blue-500/10"
                          }`}
                        />
                        {email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && (
                          <ExclamationCircleIcon className="absolute right-3 top-3 h-5 w-5 text-red-400" />
                        )}
                      </div>
                    )}

                    {(mode === "login" || mode === "signup") && (
                      <div className="relative">
                        <KeyIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-500" />
                        <input
                          type={showPassword ? "text" : "password"}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Password"
                          className={`w-full rounded-xl border bg-[#10172b] py-2 pl-11 pr-11 font-sans text-sm text-white placeholder-gray-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/60 ${
                            mode === "signup" && password.length > 0 && password.length < 6 ? "border-red-500/60" : "border-blue-500/10"
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute right-3 top-2.5 text-gray-400 transition-colors duration-200 hover:text-gray-200"
                        >
                          {showPassword ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                        </button>
                      </div>
                    )}

                    {mode === "signup" && (
                       <>
                         <div className="relative">
                          <UserCircleIcon className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                          <input
                            type="text"
                            required
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder="Display Name"
                            className={`w-full rounded-xl border bg-[#10172b] py-2 pl-11 pr-3 font-sans text-sm text-white placeholder-gray-500 shadow-inner focus:outline-none focus:ring-2 focus:ring-blue-500/60 ${
                              displayName && !displayNameRegex.test(displayName) ? "border-red-500/60" : "border-blue-500/10"
                            }`}
                          />
                          {displayName && !displayNameRegex.test(displayName) && (
                            <ExclamationCircleIcon className="absolute right-3 top-3 h-5 w-5 text-red-400" />
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full ${passwordStrength < 2 ? "bg-red-500" : passwordStrength < 3 ? "bg-yellow-400" : "bg-green-500"}`}></div>
                          <span className="font-sans text-xs text-gray-400">{passwordStrengthLabel}</span>
                          <span className="ml-auto font-sans text-[10px] uppercase tracking-[0.24em] text-gray-600">Min 6 chars • Mix types</span>
                        </div>
                      </>
                    )}

                    {errorMsg && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/15 p-2 font-sans text-xs text-red-400 sm:text-sm">
                        <ExclamationCircleIcon className="w-5 h-5" />
                        {errorMsg}
                      </div>
                    )}

                    {successMsg && (
                      <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/15 p-2 font-sans text-xs text-green-400 sm:text-sm">
                        <CheckCircleIcon className="w-5 h-5" />
                        {successMsg}
                      </div>
                    )}

                    {(mode === "login" || mode === "signup") && (
                      <button
                        type="submit"
                        disabled={loadingAction}
                        className="w-full rounded-xl bg-blue-600 py-2.5 font-sans text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {loadingAction ? (
                          <span className="flex items-center justify-center gap-2 uppercase">
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                            Processing
                          </span>
                        ) : mode === "login" ? (
                          "Login"
                        ) : (
                          "Create Account"
                        )}
                      </button>
                    )}

                    {mode === "forgot" && (
                      <button
                        type="submit"
                        disabled={loadingAction}
                        className="w-full rounded-xl bg-blue-600 py-2.5 font-sans text-sm font-semibold text-white transition-all duration-200 hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {loadingAction ? (
                          <span className="flex items-center justify-center gap-2 uppercase">
                            <ArrowPathIcon className="h-5 w-5 animate-spin" />
                            Sending
                          </span>
                        ) : (
                          "Send Reset Link"
                        )}
                      </button>
                    )}

                    {mode === "signup" && passwordStrengthLabel && (
                      <div className="flex items-center justify-between text-xs font-sans">
                        <span className="text-gray-400">Password strength:</span>
                        <span className="text-gray-300">{passwordStrengthLabel}</span>
                      </div>
                    )}
                  </form>
                </div>

                {(mode === "login" || mode === "signup") && (
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loadingAction}
                    className="mt-5 flex w-full items-center justify-center gap-3 rounded-xl border border-blue-500/20 bg-white/95 py-2.5 font-sans text-sm font-semibold text-gray-900 transition-all duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 sm:mt-6"
                  >
                    {loadingAction ? (
                      <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    ) : (
                      <Image src="https://i.imgur.com/LnrHkBv.png" alt="Google icon" width={18} height={18} className="h-4 w-4 object-contain" />
                    )}
                    <span className="text-xs">Google</span>
                  </button>
                )}
              </div>

              {/* Footer helper text */}
              {mode !== "forgot" && (
                <p className="mt-6 text-center font-sans text-xs text-gray-500">
                  Haven't connected your wallet yet?&nbsp;
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      router.push("/account");
                    }}
                    className="text-blue-400 hover:underline"
                  >
                    Connect Wallet
                  </button>
                </p>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default LoginModal;

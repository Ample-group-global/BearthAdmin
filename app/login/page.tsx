"use client";

import { useState, FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const sessionNotice =
    reason === "service_unavailable" ? "Server temporarily unavailable — please try again in a moment." :
    reason === "session_expired"     ? "Your session has expired. Please sign in again." :
    reason === "network_error"       ? "Connection lost. Please check your network and try again." :
    null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 503 || data.cause === "db_connection_timeout") {
          setError("Service temporarily unavailable — the database is unreachable. Please try again in a moment.");
        } else if (res.status === 401) {
          setError("Incorrect email or password. Please try again.");
        } else if (res.status === 403) {
          setError("Your account does not have admin access.");
        } else {
          setError(data.error || "Login failed. Please try again.");
        }
        return;
      }
      router.push(data.role === "tech" ? "/dashboard" : "/");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-bg">
      <div className="w-full max-w-[360px] sm:max-w-md">

        {/* ── Logo ── */}
        <div className="flex flex-col items-center mb-5 sm:mb-7">
          <div
            className="mb-3 rounded-[18px] shadow-xl"
            style={{ boxShadow: "0 0 0 4px rgba(65,175,235,0.18), 0 12px 32px rgba(0,0,0,0.35)" }}
          >
            <Image src="/icon.png" alt="Bearth" width={56} height={56} className="rounded-[18px] sm:w-[64px] sm:h-[64px]" />
          </div>
          <h1 className="text-[22px] sm:text-2xl font-bold text-white tracking-tight leading-tight">
            Bearth Admin
          </h1>
          <p className="text-[13px] sm:text-sm mt-1 font-medium tracking-wide" style={{ color: "rgba(255,255,255,0.78)" }}>
            Sign in to access the dashboard
          </p>
        </div>

        {/* ── Card ── */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "#ffffff",
            boxShadow: "0 24px 60px rgba(0,0,0,0.4), 0 4px 16px rgba(0,0,0,0.2)",
          }}
        >
          {/* Accent bar */}
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#24315f 0%,#41afeb 50%,#24315f 100%)" }} />

          <div className="px-6 py-6 sm:px-8 sm:py-7">

            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Session notice (redirected from dashboard) */}
              {sessionNotice && (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs font-medium"
                  style={{ background: "#fffbeb", border: "1px solid #fbbf24", color: "#92400e" }}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0 mt-px" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {sessionNotice}
                </div>
              )}

              {/* Error */}
              {error && (
                <div
                  className="flex items-start gap-2 px-3 py-2.5 rounded-lg text-xs font-medium"
                  style={{ background: "#fff1f1", border: "1px solid #fca5a5", color: "#dc2626" }}
                >
                  <svg className="w-3.5 h-3.5 flex-shrink-0 mt-px" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "#24315f" }}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  autoComplete="email"
                  className="login-input"
                />
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold" style={{ color: "#24315f" }}>
                    Password
                  </label>
                  <Link href="/forgot-password" className="login-link">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="login-input login-input-pw"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="login-toggle-pw"
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? (
                      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="login-btn"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in…
                  </span>
                ) : "Sign In"}
              </button>
            </form>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-5">
          <span className="login-divider" />
          <p className="login-footer">Bearth Admin Console · Secure Access</p>
          <span className="login-divider" />
        </div>

      </div>
    </div>
  );
}

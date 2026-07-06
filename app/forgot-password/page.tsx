"use client";

import { useState, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to send reset email."); return; }
      setSent(true);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-screen overflow-hidden flex items-center justify-center px-4 pb-10"
      style={{
        background: "linear-gradient(145deg,#131d3b 0%,#24315f 55%,#1e3a70 100%)",
        fontFamily: "'hoss-round','Figtree',ui-sans-serif,system-ui,sans-serif",
      }}
    >
      <div className="w-full max-w-[360px] sm:max-w-md">

        {/* ── Logo ── */}
        <div className="flex flex-col items-center mt-8 sm:mt-10 mb-5 sm:mb-7">
          <div
            className="mb-3 rounded-[18px] shadow-xl"
            style={{ boxShadow: "0 0 0 4px rgba(65,175,235,0.18), 0 12px 32px rgba(0,0,0,0.35)" }}
          >
            <Image src="/icon.png" alt="Bearth" width={56} height={56} className="rounded-[18px] sm:w-[64px] sm:h-[64px]" />
          </div>
          <h1 className="text-[22px] sm:text-2xl font-bold text-white tracking-tight leading-tight">
            Bearth Admin
          </h1>
          <p className="text-[11px] sm:text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
            Reset your account password
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
          <div className="h-[3px]" style={{ background: "linear-gradient(90deg,#24315f 0%,#41afeb 50%,#24315f 100%)" }} />

          <div className="px-6 py-6 sm:px-8 sm:py-7">

            {sent ? (
              /* ── Success state ── */
              <div className="flex flex-col items-center text-center py-2">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "rgba(65,175,235,0.1)", border: "2px solid rgba(65,175,235,0.25)" }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="#41afeb" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold mb-1.5" style={{ color: "#24315f" }}>Check your email</h2>
                <p className="text-xs leading-relaxed mb-4" style={{ color: "#64748b" }}>
                  If an account with <span className="font-semibold" style={{ color: "#24315f" }}>{email}</span> exists, we&apos;ve sent a password reset link. It expires in 1 hour.
                </p>
                <p className="text-xs mb-5" style={{ color: "#94a3b8" }}>
                  Didn&apos;t receive it? Check your spam folder or try again.
                </p>
                <div className="flex flex-col gap-2 w-full">
                  <button
                    onClick={() => { setSent(false); setEmail(""); }}
                    className="w-full text-sm font-semibold rounded-lg transition-all"
                    style={{
                      padding: "10px 16px",
                      background: "#f1f5f9",
                      color: "#24315f",
                      border: "1.5px solid #e2e8f0",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "#e2e8f0"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "#f1f5f9"; }}
                  >
                    Send again
                  </button>
                  <Link
                    href="/login"
                    className="w-full text-white text-sm font-bold rounded-lg text-center transition-all block"
                    style={{
                      padding: "10px 16px",
                      background: "#41afeb",
                      boxShadow: "0 4px 14px rgba(65,175,235,0.35)",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#2b9fd5"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#41afeb"; }}
                  >
                    Back to Sign In
                  </Link>
                </div>
              </div>
            ) : (
              /* ── Form state ── */
              <>
                <div className="mb-4">
                  <h2 className="text-sm font-bold mb-1" style={{ color: "#24315f" }}>Forgot your password?</h2>
                  <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
                    Enter the email address associated with your account. We&apos;ll send you a secure link to reset your password.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">

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
                      autoFocus
                      className="w-full rounded-lg text-sm outline-none transition-all"
                      style={{
                        padding: "10px 14px",
                        border: "1.5px solid #e5e7eb",
                        color: "#111827",
                        background: "#f9fafb",
                      }}
                      onFocus={e => { e.currentTarget.style.borderColor = "#41afeb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(65,175,235,0.14)"; e.currentTarget.style.background = "#fff"; }}
                      onBlur={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "#f9fafb"; }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full text-white text-sm font-bold rounded-lg transition-all"
                    style={{
                      padding: "11px 16px",
                      background: loading ? "#9bafc5" : "#41afeb",
                      cursor: loading ? "not-allowed" : "pointer",
                      boxShadow: loading ? "none" : "0 4px 14px rgba(65,175,235,0.35)",
                    }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#2b9fd5"; }}
                    onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#41afeb"; }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Sending…
                      </span>
                    ) : "Send Reset Link"}
                  </button>

                  <div className="text-center pt-1">
                    <Link
                      href="/login"
                      className="text-[11px] font-medium transition-colors"
                      style={{ color: "#94a3b8" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#41afeb"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#94a3b8"; }}
                    >
                      ← Back to Sign In
                    </Link>
                  </div>
                </form>
              </>
            )}

          </div>
        </div>

        <p className="text-center mt-4" style={{ fontSize: "10px", color: "rgba(255,255,255,0.22)" }}>
          Bearth Admin Console · Secure Access
        </p>
      </div>
    </div>
  );
}

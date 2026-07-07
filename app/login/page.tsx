"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
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
      if (!res.ok) { setError(data.error || "Login failed. Please try again."); return; }
      router.push(data.role === "tech" ? "/dashboard" : "/presale");
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

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[11px] font-semibold" style={{ color: "#24315f" }}>
                    Password
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-[11px] font-medium transition-colors"
                    style={{ color: "#41afeb" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#2b9fd5"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "#41afeb"; }}
                  >
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
                    className="w-full rounded-lg text-sm outline-none transition-all"
                    style={{
                      padding: "10px 44px 10px 14px",
                      border: "1.5px solid #e5e7eb",
                      color: "#111827",
                      background: "#f9fafb",
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = "#41afeb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(65,175,235,0.14)"; e.currentTarget.style.background = "#fff"; }}
                    onBlur={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "#f9fafb"; }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
                    style={{ color: "#b0c0ce" }}
                    onMouseEnter={e => { e.currentTarget.style.color = "#41afeb"; }}
                    onMouseLeave={e => { e.currentTarget.style.color = "#b0c0ce"; }}
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
                className="w-full text-white text-sm font-bold rounded-lg transition-all"
                style={{
                  padding: "11px 16px",
                  background: loading ? "#9bafc5" : "#41afeb",
                  cursor: loading ? "not-allowed" : "pointer",
                  letterSpacing: "0.025em",
                  boxShadow: loading ? "none" : "0 4px 14px rgba(65,175,235,0.35)",
                  marginTop: "8px",
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
                    Signing in…
                  </span>
                ) : "Sign In"}
              </button>
            </form>

          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-5">
          <span style={{ width: 32, height: 1, background: "rgba(255,255,255,0.18)", display: "inline-block" }} />
          <p className="text-center" style={{ fontSize: "11px", color: "rgba(255,255,255,0.55)", letterSpacing: "0.06em", fontWeight: 500 }}>
            Bearth Admin Console · Secure Access
          </p>
          <span style={{ width: 32, height: 1, background: "rgba(255,255,255,0.18)", display: "inline-block" }} />
        </div>

      </div>
    </div>
  );
}

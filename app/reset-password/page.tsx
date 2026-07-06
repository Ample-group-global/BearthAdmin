"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenErr, setTokenErr] = useState(false);

  useEffect(() => {
    if (!token) setTokenErr(true);
  }, [token]);

  const strength = (() => {
    if (!password) return 0;
    let s = 0;
    if (password.length >= 8) s++;
    if (/[A-Z]/.test(password)) s++;
    if (/[0-9]/.test(password)) s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ["", "Weak", "Fair", "Good", "Strong"][strength];
  const strengthColor = ["", "#ef4444", "#f59e0b", "#22c55e", "#16a34a"][strength];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to reset password."); return; }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const EyeBtn = ({ show, onToggle, label }: { show: boolean; onToggle: () => void; label: string }) => (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
      style={{ color: "#b0c0ce" }}
      onMouseEnter={e => { e.currentTarget.style.color = "#41afeb"; }}
      onMouseLeave={e => { e.currentTarget.style.color = "#b0c0ce"; }}
      aria-label={label}
    >
      {show ? (
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
  );

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
            Beart Admin
          </h1>
          <p className="text-[11px] sm:text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
            Create a new secure password
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

            {/* Invalid / missing token */}
            {tokenErr ? (
              <div className="flex flex-col items-center text-center py-2">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "rgba(220,38,38,0.08)", border: "2px solid rgba(220,38,38,0.2)" }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="#dc2626" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                  </svg>
                </div>
                <h2 className="text-base font-bold mb-1.5" style={{ color: "#24315f" }}>Invalid reset link</h2>
                <p className="text-xs leading-relaxed mb-5" style={{ color: "#64748b" }}>
                  This password reset link is missing or has expired. Please request a new one.
                </p>
                <Link
                  href="/forgot-password"
                  className="w-full text-white text-sm font-bold rounded-lg text-center transition-all block"
                  style={{ padding: "10px 16px", background: "#41afeb", boxShadow: "0 4px 14px rgba(65,175,235,0.35)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#2b9fd5"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#41afeb"; }}
                >
                  Request New Link
                </Link>
              </div>
            ) : success ? (
              /* ── Success state ── */
              <div className="flex flex-col items-center text-center py-2">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
                  style={{ background: "rgba(34,197,94,0.1)", border: "2px solid rgba(34,197,94,0.25)" }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="#22c55e" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-base font-bold mb-1.5" style={{ color: "#24315f" }}>Password updated</h2>
                <p className="text-xs leading-relaxed mb-1" style={{ color: "#64748b" }}>
                  Your password has been changed successfully.
                </p>
                <p className="text-xs" style={{ color: "#94a3b8" }}>Redirecting to sign in…</p>
              </div>
            ) : (
              /* ── Form ── */
              <>
                <div className="mb-4">
                  <h2 className="text-sm font-bold mb-1" style={{ color: "#24315f" }}>Set new password</h2>
                  <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
                    Choose a strong password of at least 8 characters.
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

                  {/* New password */}
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "#24315f" }}>
                      New Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Min. 8 characters"
                        required
                        autoFocus
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
                      <EyeBtn show={showPw} onToggle={() => setShowPw(v => !v)} label={showPw ? "Hide password" : "Show password"} />
                    </div>
                    {/* Strength bar */}
                    {password && (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map(i => (
                            <div
                              key={i}
                              className="h-1 flex-1 rounded-full transition-all"
                              style={{ background: i <= strength ? strengthColor : "#e5e7eb" }}
                            />
                          ))}
                        </div>
                        <p className="text-[10px] font-medium" style={{ color: strengthColor }}>{strengthLabel}</p>
                      </div>
                    )}
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="block text-[11px] font-semibold mb-1.5" style={{ color: "#24315f" }}>
                      Confirm Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCf ? "text" : "password"}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="Re-enter your password"
                        required
                        className="w-full rounded-lg text-sm outline-none transition-all"
                        style={{
                          padding: "10px 44px 10px 14px",
                          border: confirm && confirm !== password ? "1.5px solid #fca5a5" : "1.5px solid #e5e7eb",
                          color: "#111827",
                          background: "#f9fafb",
                        }}
                        onFocus={e => { e.currentTarget.style.borderColor = "#41afeb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(65,175,235,0.14)"; e.currentTarget.style.background = "#fff"; }}
                        onBlur={e => { e.currentTarget.style.borderColor = confirm && confirm !== password ? "#fca5a5" : "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.background = "#f9fafb"; }}
                      />
                      <EyeBtn show={showCf} onToggle={() => setShowCf(v => !v)} label={showCf ? "Hide password" : "Show password"} />
                    </div>
                    {confirm && confirm !== password && (
                      <p className="text-[10px] mt-1 font-medium" style={{ color: "#ef4444" }}>Passwords do not match</p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || (!!confirm && confirm !== password)}
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
                        Updating…
                      </span>
                    ) : "Reset Password"}
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

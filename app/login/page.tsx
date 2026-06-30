"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed. Please try again.");
        return;
      }

      if (data.role === "tech") router.push("/dashboard");
      else if (data.role === "ops") router.push("/ops");
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: "#24315f", fontFamily: "'hoss-round', 'Figtree', sans-serif" }}
    >
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Image src="/icon.png" alt="Bearth" width={64} height={64} className="rounded-2xl shadow-lg" />
          </div>
          <h1 className="text-2xl font-bold text-white">Bearth NFT Admin</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.5)" }}>Sign in to access the dashboard</p>
        </div>

        {/* Login form */}
        <div className="rounded-2xl p-8 shadow-xl" style={{ background: "#fff" }}>
          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Error */}
            {error && (
              <div className="flex items-center gap-3 p-3 rounded-lg text-sm" style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            )}

            {/* Username */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#24315f" }}>
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
                autoComplete="username"
                className="w-full px-3.5 py-2.5 rounded-lg text-sm transition-colors outline-none"
                style={{ border: "1px solid #e5e7eb", color: "#111827" }}
                onFocus={e => { e.currentTarget.style.borderColor = "#41afeb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(65,175,235,0.15)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold mb-1.5" style={{ color: "#24315f" }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pr-10 rounded-lg text-sm transition-colors outline-none"
                  style={{ border: "1px solid #e5e7eb", color: "#111827" }}
                  onFocus={e => { e.currentTarget.style.borderColor = "#41afeb"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(65,175,235,0.15)"; }}
                  onBlur={e => { e.currentTarget.style.borderColor = "#e5e7eb"; e.currentTarget.style.boxShadow = "none"; }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: "#9bafc5" }}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-white text-sm font-bold rounded-lg transition-all"
              style={{ background: loading ? "#9bafc5" : "#41afeb", cursor: loading ? "not-allowed" : "pointer" }}
              onMouseEnter={e => { if (!loading) e.currentTarget.style.background = "#2e9fd8"; }}
              onMouseLeave={e => { if (!loading) e.currentTarget.style.background = "#41afeb"; }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Signing in...
                </span>
              ) : "Sign In"}
            </button>
          </form>

          {/* Role info */}
          <div className="mt-6 pt-6 grid grid-cols-2 gap-3" style={{ borderTop: "1px solid #f3f4f6" }}>
            <div className="p-3 rounded-lg" style={{ background: "rgba(65,175,235,0.08)", border: "1px solid rgba(65,175,235,0.2)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#41afeb" }} />
                <span className="text-xs font-bold" style={{ color: "#24315f" }}>Technical Admin</span>
              </div>
              <p className="text-xs" style={{ color: "#6b7280" }}>Contract ops, whitelist management, NFT explorer</p>
            </div>
            <div className="p-3 rounded-lg" style={{ background: "rgba(36,49,95,0.06)", border: "1px solid rgba(36,49,95,0.15)" }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full inline-block" style={{ background: "#24315f" }} />
                <span className="text-xs font-bold" style={{ color: "#24315f" }}>Operations Staff</span>
              </div>
              <p className="text-xs" style={{ color: "#6b7280" }}>NFT gallery, whitelist view, basic stats</p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: "rgba(255,255,255,0.3)" }}>
          Bearth NFT Admin Console · Secure Access
        </p>
      </div>
    </div>
  );
}

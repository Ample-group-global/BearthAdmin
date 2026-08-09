"use client";

// Pulsing live-indicator + dismissable alert banner used by both waves and records pages.
// variant="warn"  → amber (waves: new reveals ready)
// variant="info"  → blue  (records: new mints detected)

interface WatchdogBannerProps {
  alert: string | null;
  updatedAt: Date | null;
  onDismiss: () => void;
  variant?: "warn" | "info";
  icon?: string;
}

export default function WatchdogBanner({
  alert,
  updatedAt,
  onDismiss,
  variant = "warn",
  icon,
}: WatchdogBannerProps) {
  const isWarn = variant === "warn";
  const alertBg     = isWarn ? "rgba(217,119,6,0.08)"  : "rgba(65,175,235,0.08)";
  const alertBorder = isWarn ? "rgba(217,119,6,0.25)"  : "rgba(65,175,235,0.25)";
  const alertColor  = isWarn ? "#d97706"               : "#2e9fd8";
  const defaultIcon = isWarn ? "⚡"                    : "⟳";

  return (
    <>
      {alert && (
        <div
          className="flex items-center justify-between px-4 py-2 rounded-xl text-sm"
          style={{ background: alertBg, border: `1px solid ${alertBorder}`, color: alertColor }}
        >
          <span>{icon ?? defaultIcon} {alert}</span>
          <button
            onClick={onDismiss}
            className="ml-4 text-xs opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}
      {updatedAt && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#9bafc5" }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
          Live · last checked {updatedAt.toLocaleTimeString()}
        </div>
      )}
    </>
  );
}

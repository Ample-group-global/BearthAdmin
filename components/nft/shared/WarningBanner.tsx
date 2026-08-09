"use client";

// Amber/red/blue warning banner with triangle SVG icon.
// Appears in RevealModal, TreasuryMoveModal, Manage Modal on-chain section, and Reset Confirm dialog.

type WarningVariant = "warn" | "error" | "info";

const VARIANT_STYLES: Record<WarningVariant, { bg: string; border: string; color: string; iconColor: string }> = {
  warn:  { bg: "rgba(217,119,6,0.07)",   border: "rgba(217,119,6,0.2)",   color: "#92400e", iconColor: "#d97706" },
  error: { bg: "rgba(239,68,68,0.06)",   border: "rgba(239,68,68,0.2)",   color: "#dc2626", iconColor: "#dc2626" },
  info:  { bg: "rgba(65,175,235,0.06)",  border: "rgba(65,175,235,0.2)",  color: "#1e7ea1", iconColor: "#41afeb" },
};

interface WarningBannerProps {
  children: React.ReactNode;
  variant?: WarningVariant;
  className?: string;
}

export default function WarningBanner({ children, variant = "warn", className }: WarningBannerProps) {
  const s = VARIANT_STYLES[variant];
  return (
    <div
      className={`flex items-start gap-2 px-3 py-2.5 rounded-xl text-xs ${className ?? ""}`}
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}
    >
      <svg
        className="w-3.5 h-3.5 flex-shrink-0 mt-0.5"
        style={{ color: s.iconColor }}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
        />
      </svg>
      <div>{children}</div>
    </div>
  );
}

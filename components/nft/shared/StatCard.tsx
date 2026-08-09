"use client";

// Shared stat/metric card used in both waves and records pages.
// Simple mode  (waves): label + value, no icon/progress.
// Rich mode (records): icon + subtitle + progress bar + percentage + onClick filter.

interface StatCardProps {
  label: string;
  value: string | number;
  color?: string;
  small?: boolean;
  // Rich mode (records-style)
  icon?: React.ReactNode;
  subtitle?: string;
  bgColor?: string;
  progress?: number;   // 0–100
  percentage?: number; // shown as "X% of collection"
  onClick?: () => void;
}

export default function StatCard({
  label,
  value,
  color = "#24315f",
  small = false,
  icon,
  subtitle,
  bgColor,
  progress,
  percentage,
  onClick,
}: StatCardProps) {
  const isRich = !!(icon || subtitle || progress !== undefined);

  if (isRich) {
    return (
      <button
        onClick={onClick}
        className="text-left bg-white rounded-2xl transition-all duration-150"
        style={{ border: "1px solid #e5e7eb", padding: "16px", boxShadow: "0 1px 3px rgba(0,0,0,0.06)", cursor: onClick ? "pointer" : "default" }}
        onMouseEnter={e => {
          if (!onClick) return;
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)";
          e.currentTarget.style.borderColor = color + "60";
        }}
        onMouseLeave={e => {
          if (!onClick) return;
          e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06)";
          e.currentTarget.style.borderColor = "#e5e7eb";
        }}
      >
        {/* Icon + label row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#94a3b8" }}>
            {label}
          </p>
          {icon && (
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: bgColor ?? "#f3f4f6", color }}
            >
              {icon}
            </div>
          )}
        </div>

        {/* Number */}
        <p className="text-2xl font-extrabold leading-none mb-1" style={{ color }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>

        {/* Subtitle */}
        {subtitle && (
          <p className="text-[10px] mb-3" style={{ color: "#94a3b8" }}>{subtitle}</p>
        )}

        {/* Progress bar */}
        {progress !== undefined && (
          <>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, background: color, opacity: 0.7 }}
              />
            </div>
            {percentage !== undefined && (
              <p className="text-[10px] mt-1 font-semibold" style={{ color: color + "99" }}>
                {percentage}% of collection
              </p>
            )}
          </>
        )}
      </button>
    );
  }

  // Simple mode (waves-style)
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm" style={{ border: "1px solid #e5e7eb" }}>
      <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "#9bafc5" }}>
        {label}
      </p>
      <p
        className={`font-bold ${small ? "text-sm" : "text-2xl"}`}
        style={{ color }}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  );
}

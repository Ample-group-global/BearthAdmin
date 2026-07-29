"use client";

export type StatusColorCfg = { bg: string; color: string; label?: string };

export function StatusBadge({
  status,
  colorMap,
  fallback = { bg: "rgba(156,163,175,0.12)", color: "#9ca3af" },
  dot,
  capitalize,
}: {
  status: string | null | undefined;
  colorMap: Record<string, StatusColorCfg>;
  fallback?: StatusColorCfg;
  dot?: boolean;
  capitalize?: boolean;
}) {
  const s = status ?? "";
  const cfg = colorMap[s] ?? fallback;
  const label = cfg.label ?? s;
  return (
    <span
      className={`${dot ? "inline-flex items-center gap-1 " : ""}px-2 py-0.5 rounded-full text-xs font-semibold${capitalize ? " capitalize" : ""}`}
      style={{ background: cfg.bg, color: cfg.color }}
    >
      {dot && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: cfg.color }} />}
      {label}
    </span>
  );
}

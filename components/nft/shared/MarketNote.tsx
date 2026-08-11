type Market = "primary" | "secondary" | "both";

const STYLES: Record<Market, { bg: string; color: string; label: string }> = {
  primary:   { bg: "rgba(65,175,235,0.12)",  color: "#41afeb", label: "Primary Market" },
  secondary: { bg: "rgba(22,163,74,0.1)",    color: "#16a34a", label: "Secondary Market" },
  both:      { bg: "rgba(156,163,175,0.15)", color: "#6b7280", label: "Primary & Secondary" },
};

export default function MarketNote({ market }: { market: Market }) {
  const s = STYLES[market];
  return (
    <span
      title={`This feature applies to the ${s.label.toLowerCase()}`}
      style={{ background: s.bg, color: s.color, fontSize: "9px", fontWeight: 700, letterSpacing: "0.04em", padding: "1px 6px", borderRadius: "999px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
      {s.label}
    </span>
  );
}

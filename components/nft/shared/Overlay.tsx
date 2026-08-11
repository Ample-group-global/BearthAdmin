"use client";

interface OverlayProps {
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export default function Overlay({ children, size = "lg" }: OverlayProps) {
  const maxW = size === "sm" ? "max-w-sm" : size === "md" ? "max-w-md" : "max-w-lg";
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.45)" }}>
      <div className={`bg-white rounded-2xl shadow-xl p-6 w-full ${maxW} max-h-[90vh] overflow-y-auto`}>
        {children}
      </div>
    </div>
  );
}

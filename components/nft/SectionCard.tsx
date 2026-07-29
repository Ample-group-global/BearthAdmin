"use client";

import React from "react";

export function SectionCard({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="bg-white rounded-2xl shadow-sm"
      style={{
        border: `1px solid ${accent ?? "#e5e7eb"}`,
        background: accent ? `${accent}08` : "white",
      }}
    >
      <div className="px-6 py-4" style={{ borderBottom: "1px solid #f3f4f6" }}>
        <h2 className="text-sm font-bold" style={{ color: accent ?? "#24315f" }}>
          {title}
        </h2>
        {subtitle && (
          <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

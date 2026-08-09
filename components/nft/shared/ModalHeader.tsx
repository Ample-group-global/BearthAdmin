"use client";

// Reusable modal header with title, optional maximize toggle, and close button.
// Used by WaveManageModal and NftHistoryModal.

interface ModalHeaderProps {
  title: string;
  subtitle?: string;
  maximized: boolean;
  onMaximize: () => void;
  onClose: () => void;
  icon?: React.ReactNode;
}

export default function ModalHeader({
  title,
  subtitle,
  maximized,
  onMaximize,
  onClose,
  icon,
}: ModalHeaderProps) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4 flex-shrink-0"
      style={{ borderBottom: "1px solid #e5e7eb" }}
    >
      <div className="flex items-center gap-3">
        {icon && icon}
        <div>
          <h2 className="text-sm font-bold" style={{ color: "#24315f" }}>{title}</h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "#9bafc5" }}>{subtitle}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Maximize / restore */}
        <button
          onClick={onMaximize}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "#9bafc5", border: "1px solid #e5e7eb" }}
          title={maximized ? "Restore" : "Maximize"}
        >
          {maximized ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>

        {/* Close */}
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
          style={{ color: "#9bafc5", border: "1px solid #e5e7eb" }}
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

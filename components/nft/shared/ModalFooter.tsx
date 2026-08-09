"use client";

// Cancel + primary-action button pair used in every modal footer.
// confirmVariant="danger" turns the confirm button red (used in irreversible actions).

type ConfirmVariant = "primary" | "danger" | "success";

const CONFIRM_COLORS: Record<ConfirmVariant, { active: string; disabled: string }> = {
  primary: { active: "#24315f",  disabled: "#9bafc5" },
  danger:  { active: "#dc2626",  disabled: "#9bafc5" },
  success: { active: "#16a34a",  disabled: "#9bafc5" },
};

interface ModalFooterProps {
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  busy?: boolean;
  disabled?: boolean;
  confirmVariant?: ConfirmVariant;
  cancelLabel?: string;
}

export default function ModalFooter({
  onCancel,
  onConfirm,
  confirmLabel,
  busy = false,
  disabled = false,
  confirmVariant = "primary",
  cancelLabel = "Cancel",
}: ModalFooterProps) {
  const isDisabled = busy || disabled;
  const colors = CONFIRM_COLORS[confirmVariant];

  return (
    <div
      className="flex items-center gap-3 px-6 py-4 flex-shrink-0"
      style={{ borderTop: "1px solid #e5e7eb" }}
    >
      <button
        onClick={onCancel}
        disabled={busy}
        className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
        style={{ border: "1px solid #e5e7eb", color: "#6b7280", background: "white" }}
      >
        {cancelLabel}
      </button>

      <button
        onClick={onConfirm}
        disabled={isDisabled}
        className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2"
        style={{
          background: isDisabled ? colors.disabled : colors.active,
          cursor: isDisabled ? "not-allowed" : "pointer",
        }}
      >
        {busy ? (
          <>
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            {confirmLabel}
          </>
        ) : (
          confirmLabel
        )}
      </button>
    </div>
  );
}

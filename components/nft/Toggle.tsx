"use client";

export function Toggle({
  value,
  onChange,
  disabled,
}: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!value)}
      disabled={disabled}
      className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 focus:outline-none"
      style={{ background: value ? "#16a34a" : "#d1d5db", opacity: disabled ? 0.6 : 1 }}
    >
      <span
        className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 mt-0.5"
        style={{ marginLeft: value ? "22px" : "2px" }}
      />
    </button>
  );
}

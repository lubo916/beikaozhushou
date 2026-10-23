import type { ReactNode } from "react";

export const fieldClass =
  "w-full min-w-[0] rounded-sm border border-line-strong bg-bg-surface px-3 py-2 text-body text-ink-primary focus-visible:outline-2 focus-visible:outline-brand-primary";
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex min-w-[0] flex-col gap-1 text-small font-medium text-ink-secondary">
      {label}
      {children}
    </label>
  );
}

import type { ReactNode } from "react";
import type { S32PrivacyCenter } from "@exam-prep/contract";
export interface ViewProps {
  readonly data: S32PrivacyCenter;
  readonly confirm: (kind: string, values?: Record<string, string | number>) => void;
  readonly soon: () => void;
  readonly exportData: () => void;
}
export function Rows({ children }: { children: ReactNode }) {
  return <div className="flex flex-col divide-y divide-line-soft">{children}</div>;
}
export function Row({ children, actions }: { children: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="min-w-0 flex-1 break-words">{children}</div>
      {actions !== undefined && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
export const secondary = "text-small text-ink-secondary";

// 外壳的轻提示：还没有后端的按钮点了先说“即将上线”（页面验收约定），几秒后自动消失；读屏会念出来。
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

const TOAST_MS = 4000;

export const ToastContext = createContext<(message: string) => void>(() => undefined);

export function useToast(): (message: string) => void {
  return useContext(ToastContext);
}

export function useToastState(): { readonly message: string | null; readonly show: (message: string) => void } {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((next: string) => {
    if (timer.current !== null) clearTimeout(timer.current);
    setMessage(next);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );
  return { message, show };
}

export function Toast({ message }: { message: string | null }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none absolute inset-x-[0] bottom-4 z-30 flex justify-center px-4">
      {message !== null && <p className="rounded-md bg-ink-primary px-4 py-2 text-small text-bg-surface">{message}</p>}
    </div>
  );
}

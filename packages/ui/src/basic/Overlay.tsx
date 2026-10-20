import { useEffect, useId, useRef, type MouseEvent, type ReactNode } from "react";
import { COPY } from "../lib/copy.ts";
import { cx } from "../lib/cx.ts";
import { IconButton } from "./Button.tsx";

/** 用原生 <dialog> 的模态能力：打开时焦点进入、背景不可操作，关闭后焦点回到打开它的按钮；Esc 交给 onClose。 */
function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      closeRef.current();
    };
    dialog.addEventListener("cancel", onCancel);
    return () => dialog.removeEventListener("cancel", onCancel);
  }, []);
  return ref;
}

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  /** 底部按钮。 */
  actions?: ReactNode;
  /** 需要明确回答的确认框用 alertdialog：点遮罩不关闭。 */
  role?: "dialog" | "alertdialog" | undefined;
  closeLabel?: string | undefined;
  className?: string | undefined;
}

/** 对话框。 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  role = "dialog",
  closeLabel = COPY.action.close,
  className,
}: DialogProps) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  const descriptionId = useId();
  const onBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (role === "dialog" && event.target === event.currentTarget) onClose();
  };
  return (
    <dialog
      ref={ref}
      className={cx("ui-modal ui-dialog", className)}
      role={role === "alertdialog" ? "alertdialog" : undefined}
      aria-labelledby={titleId}
      aria-describedby={description !== undefined ? descriptionId : undefined}
      onClick={onBackdrop}
    >
      <div className="ui-dialog__panel">
        <header className="ui-dialog__head">
          <h2 id={titleId} className="ui-dialog__title">
            {title}
          </h2>
          <IconButton label={closeLabel} icon="close" onClick={onClose} />
        </header>
        {description !== undefined && (
          <p id={descriptionId} className="ui-dialog__desc">
            {description}
          </p>
        )}
        {children !== undefined && <div className="ui-dialog__body">{children}</div>}
        {actions !== undefined && <footer className="ui-dialog__actions">{actions}</footer>}
      </div>
    </dialog>
  );
}

export type SheetSide = "right" | "left" | "bottom";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  side?: SheetSide | undefined;
  children?: ReactNode;
  footer?: ReactNode;
  closeLabel?: string | undefined;
  className?: string | undefined;
}

/** 抽屉（左右）与底部面板（手机上的导师、分组导航等）。 */
export function Sheet({ open, onClose, title, side = "right", children, footer, closeLabel = COPY.action.close, className }: SheetProps) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  const onBackdrop = (event: MouseEvent<HTMLDialogElement>) => {
    if (event.target === event.currentTarget) onClose();
  };
  return (
    <dialog ref={ref} className={cx("ui-modal ui-sheet", `ui-sheet--${side}`, className)} aria-labelledby={titleId} onClick={onBackdrop}>
      <div className="ui-sheet__panel">
        {side === "bottom" && <span className="ui-sheet__grip" aria-hidden="true" />}
        <header className="ui-sheet__head">
          <h2 id={titleId} className="ui-sheet__title">
            {title}
          </h2>
          <IconButton label={closeLabel} icon="close" onClick={onClose} />
        </header>
        <div className="ui-sheet__body">{children}</div>
        {footer !== undefined && <footer className="ui-sheet__foot">{footer}</footer>}
      </div>
    </dialog>
  );
}

export type DrawerProps = Omit<SheetProps, "side"> & { side?: "right" | "left" | undefined };

export function Drawer({ side = "right", ...rest }: DrawerProps) {
  return <Sheet {...rest} side={side} />;
}

export function BottomSheet(props: Omit<SheetProps, "side">) {
  return <Sheet {...props} side="bottom" />;
}

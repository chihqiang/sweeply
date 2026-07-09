import { useEffect, useRef, useCallback, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/utils/cn";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  children?: ReactNode;
}

export function Dialog({ open, onClose, onConfirm, title, description, confirmLabel = "确认", cancelLabel = "取消", danger, loading, children }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  // closing 是派生值：open 为 false 但 visible 仍为 true 时处于关闭动画中
  const closing = !open && visible;

  // 打开/关闭动画控制
  useEffect(() => {
    if (open) {
      // 延迟一帧挂载以触发 CSS 过渡
      const timer = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timer);
    } else if (visible) {
      // 等 200ms 关闭动画结束后卸载
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [open, visible]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape" && !loading) onClose();
    if (e.key === "Enter" && !loading) onConfirm();
    if (e.key === "Tab" && panelRef.current) {
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  }, [onClose, onConfirm, loading]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => panelRef.current?.querySelector<HTMLElement>('button:not([disabled])')?.focus(), 50);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, handleKeyDown]);

  if (!visible) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9998] flex items-center justify-center">
      <div
        className={cn(
          "absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200",
          closing ? "opacity-0" : "opacity-100",
        )}
        onClick={() => { if (!loading) onClose(); }}
      />
      <div
        ref={panelRef}
        className={cn(
          "relative w-full max-w-md rounded-2xl border border-gray-100 bg-white p-6 shadow-2xl dark:border-gray-700 dark:bg-gray-800 transition-all duration-200",
          closing ? "scale-95 opacity-0" : "scale-100 opacity-100",
        )}
      >
        <div className="flex items-start gap-4">
          {danger && (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20">
              <svg className="h-5 w-5 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            {description && <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-gray-400">{description}</p>}
            {children}
          </div>
        </div>
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-9 items-center rounded-xl px-4 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              "inline-flex h-9 items-center rounded-xl px-4 text-sm font-medium text-white shadow-md transition-all hover:brightness-110 active:scale-[0.98]",
              danger
                ? "bg-red-500 shadow-red-500/25 hover:bg-red-600"
                : "bg-indigo-500 shadow-indigo-500/25 hover:bg-indigo-600",
              "disabled:opacity-50",
            )}
          >
            {loading && (
              <svg className="mr-1.5 h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

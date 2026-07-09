import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/utils/cn";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const STYLES: Record<ToastType, string> = {
  success: "text-green-500",
  error: "text-red-500",
  info: "text-indigo-500",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    const id = `toast-${++counterRef.current}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => removeToast(id), 3500);
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {createPortal(
        <div className="fixed right-6 top-6 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
          {toasts.map((toast) => {
            const Icon = ICONS[toast.type];
            return (
              <div
                key={toast.id}
                className={cn(
                  "pointer-events-auto flex items-center gap-2.5 rounded-xl border border-gray-100 bg-white/95 px-4 py-3 text-sm shadow-lg backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/95 animate-slide-in-right",
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", STYLES[toast.type])} />
                <span className="font-medium text-gray-700 dark:text-gray-200">{toast.message}</span>
                <button onClick={() => removeToast(toast.id)} className="ml-1.5 text-gray-300 transition-colors hover:text-gray-500 dark:text-gray-600 dark:hover:text-gray-400" aria-label="关闭通知">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

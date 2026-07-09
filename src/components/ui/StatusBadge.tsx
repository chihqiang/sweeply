import { memo, type HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export type StatusType = "idle" | "scanning" | "success" | "warning" | "error";

export interface StatusBadgeProps extends HTMLAttributes<HTMLDivElement> {
  status: StatusType;
  label?: string;
}

const DOT: Record<StatusType, string> = {
  idle: "bg-gray-400",
  scanning: "bg-indigo-400 animate-pulse",
  success: "bg-green-500",
  warning: "bg-amber-400",
  error: "bg-red-500",
};

const TEXT: Record<StatusType, string> = {
  idle: "text-gray-400",
  scanning: "text-indigo-600 dark:text-indigo-400",
  success: "text-green-600 dark:text-green-400",
  warning: "text-amber-600 dark:text-amber-400",
  error: "text-red-600 dark:text-red-400",
};

const BG: Record<StatusType, string> = {
  idle: "bg-gray-50 dark:bg-gray-800/50",
  scanning: "bg-indigo-50 dark:bg-indigo-900/20",
  success: "bg-green-50 dark:bg-green-900/20",
  warning: "bg-amber-50 dark:bg-amber-900/20",
  error: "bg-red-50 dark:bg-red-900/20",
};

export const StatusBadge = memo(function StatusBadge({ status, label, className, ...props }: StatusBadgeProps) {
  return (
    <div className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", TEXT[status], BG[status], className)} {...props}>
      <span className={cn("h-1.5 w-1.5 rounded-full", DOT[status])} />
      <span>{label || status}</span>
    </div>
  );
});

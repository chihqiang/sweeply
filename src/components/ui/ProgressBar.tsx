import { memo } from "react";
import { cn } from "@/utils/cn";

export interface ProgressBarProps {
  value: number;
  className?: string;
  gradient?: boolean;
}

export const ProgressBar = memo(function ProgressBar({ value, className, gradient = true }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700/50", className)}>
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out",
          gradient
            ? "bg-gradient-to-r from-indigo-500 to-purple-500"
            : "bg-indigo-500",
        )}
        style={{ width: `${Math.round(clamped * 100)}%` }}
      />
    </div>
  );
});

import { memo, useId } from "react";
import { cn } from "@/utils/cn";

export interface CircularProgressProps {
  /** 0 ~ 1 */
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
  trackClassName?: string;
  barClassName?: string;
}

export const CircularProgress = memo(function CircularProgress({
  value,
  size = 160,
  strokeWidth = 10,
  className,
  children,
  trackClassName,
  barClassName,
}: CircularProgressProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);
  const center = size / 2;
  const gradientId = useId();

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={`circular-progress-gradient-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
          </linearGradient>
        </defs>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className={cn("stroke-gray-100 dark:stroke-gray-700/50", trackClassName)}
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          stroke={`url(#circular-progress-gradient-${gradientId})`}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={cn("transition-[stroke-dashoffset] duration-500 ease-out", barClassName)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
});

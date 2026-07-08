/**
 * 状态徽章组件
 */
import type { ReactNode } from "react";
import { cn } from "@/utils/cn";

/** 徽章颜色类型 */
export type BadgeColor = "blue" | "green" | "red" | "yellow" | "gray";

/** 徽章属性 */
export interface StatusBadgeProps {
  /** 颜色 */
  color?: BadgeColor;
  /** 内容 */
  children: ReactNode;
  /** 自定义类名 */
  className?: string;
}

/** 颜色样式映射 */
const COLOR_STYLES: Record<BadgeColor, string> = {
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  green:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  yellow:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  gray: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
};

/** 状态徽章组件 */
export function StatusBadge({
  color = "gray",
  children,
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        COLOR_STYLES[color],
        className,
      )}
    >
      {children}
    </span>
  );
}

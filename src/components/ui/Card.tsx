/**
 * 卡片容器组件
 */
import type { HTMLAttributes } from "react";
import { cn } from "@/utils/cn";

/** 卡片属性 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 是否有内边距 */
  padded?: boolean;
}

/** 卡片组件 */
export function Card({
  padded = true,
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-gray-200 bg-white shadow-sm",
        "dark:border-gray-700 dark:bg-gray-800",
        padded && "p-4",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** 卡片标题 */
export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-base font-semibold text-gray-800 dark:text-gray-100",
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

/** 卡片内容区域 */
export function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mt-3", className)} {...props}>
      {children}
    </div>
  );
}

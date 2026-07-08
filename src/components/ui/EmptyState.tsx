/**
 * 空状态组件
 */
import type { LucideIcon } from "lucide-react";
import { Inbox } from "lucide-react";
import { cn } from "@/utils/cn";

/** 空状态属性 */
export interface EmptyStateProps {
  /** 图标 */
  icon?: LucideIcon;
  /** 标题 */
  title: string;
  /** 描述 */
  description?: string;
  /** 自定义类名 */
  className?: string;
}

/** 空状态组件 */
export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className,
      )}
    >
      <Icon className="mb-3 h-12 w-12 text-gray-300 dark:text-gray-600" />
      <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
        {title}
      </p>
      {description && (
        <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
          {description}
        </p>
      )}
    </div>
  );
}

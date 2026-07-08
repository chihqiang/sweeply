/**
 * 进度条组件
 */
import { cn } from "@/utils/cn";

/** 进度条属性 */
export interface ProgressBarProps {
  /** 当前值 0~1 */
  value: number;
  /** 是否显示百分比文本 */
  showLabel?: boolean;
  /** 自定义颜色类名 */
  colorClassName?: string;
  /** 容器类名 */
  className?: string;
}

/** 进度条组件 */
export function ProgressBar({
  value,
  showLabel = false,
  colorClassName,
  className,
}: ProgressBarProps) {
  const clampedValue = Math.max(0, Math.min(1, value));
  const percent = Math.round(clampedValue * 100);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            colorClassName ?? "bg-blue-500",
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      {showLabel && (
        <span className="min-w-[3rem] text-right text-xs font-medium text-gray-500 dark:text-gray-400">
          {percent}%
        </span>
      )}
    </div>
  );
}

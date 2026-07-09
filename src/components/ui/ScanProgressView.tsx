import { memo, type ReactNode } from "react";
import { StopCircle } from "lucide-react";
import { Button } from "./Button";
import { CircularProgress } from "./CircularProgress";
import { ErrorAlert } from "./PageContainer";

/**
 * 扫描类页面 — 扫描中 / 处理中状态通用视图
 *
 * 用于垃圾清理、大文件查找、重复文件查找、磁盘分析等页面的扫描/处理过程。
 * 包含圆形进度环、中央内容、描述、进度详情和停止按钮。
 */
export interface ScanProgressViewProps {
  /** 进度值 0~1，若无法计算可传估算值或 0 */
  progress: number;
  /** 进度环中央显示的主内容（如百分比、数量） */
  centerContent: ReactNode;
  /** 中央内容下方的小标签，如"扫描中"、"清理中" */
  centerLabel?: string;
  /** 主描述文字，如"正在扫描..." */
  description?: string;
  /** 副详情，如"已扫描 1234 个文件"或当前路径 */
  detail?: string;
  /** 预计剩余时间，如"约 30 秒" */
  eta?: string;
  /** 是否可停止（默认 true） */
  canStop?: boolean;
  /** 停止回调 */
  onStop?: () => void;
  /** 停止按钮文案，默认"停止扫描" */
  stopLabel?: string;
  /** 错误信息 */
  error?: string | null;
}

export const ScanProgressView = memo(function ScanProgressView({
  progress,
  centerContent,
  centerLabel,
  description,
  detail,
  eta,
  canStop = true,
  onStop,
  stopLabel = "停止扫描",
  error,
}: ScanProgressViewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      <CircularProgress value={progress} size={160} strokeWidth={10}>
        <div className="flex flex-col items-center">
          {centerContent}
          {centerLabel && (
            <span className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {centerLabel}
            </span>
          )}
        </div>
      </CircularProgress>

      {/* 主描述 */}
      {description && (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}

      {/* 副详情 */}
      {detail && (
        <p
          className="mt-1.5 max-w-md truncate text-xs text-gray-400 dark:text-gray-500"
          title={detail}
        >
          {detail}
        </p>
      )}

      {/* ETA */}
      {eta && (
        <p className="mt-1.5 text-xs text-indigo-500 dark:text-indigo-400">
          预计剩余 {eta}
        </p>
      )}

      {/* 停止按钮 */}
      {canStop && onStop && (
        <Button variant="outline" size="md" className="mt-8" onClick={onStop}>
          <StopCircle className="h-4 w-4" />
          {stopLabel}
        </Button>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mt-6 max-w-md">
          <ErrorAlert message={error} />
        </div>
      )}
    </div>
  );
});

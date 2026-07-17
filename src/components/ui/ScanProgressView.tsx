import { memo, type ReactNode } from "react";
import { StopCircle, Zap, FileSearch, Clock } from "lucide-react";
import { Button } from "./Button";
import { CircularProgress } from "./CircularProgress";
import { ErrorAlert } from "./PageContainer";
import { cn } from "@/utils/cn";

/**
 * 扫描类页面 — 扫描中 / 处理中状态通用视图
 *
 * 用于垃圾清理、大文件查找、重复文件查找、磁盘分析等页面的扫描/处理过程。
 * 包含圆形进度环、中央内容、描述、进度详情、扫描统计和停止按钮。
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
  /** 已扫描文件数（增强信息） */
  scannedCount?: number;
  /** 已找到的结果数（增强信息） */
  foundCount?: number;
  /** 扫描速度（文件/秒）（增强信息） */
  scanSpeed?: number;
  /** 步骤列表（如 ["扫描文件", "计算哈希", "汇总结果"]） */
  steps?: string[];
  /** 当前步骤索引（0-based） */
  currentStep?: number;
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
  scannedCount,
  foundCount,
  scanSpeed,
  steps,
  currentStep,
}: ScanProgressViewProps) {
  const hasStats = scannedCount !== undefined || foundCount !== undefined || scanSpeed !== undefined;
  const hasSteps = steps && steps.length > 0 && currentStep !== undefined;

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
        <p className="mt-1.5 flex items-center gap-1 text-xs text-indigo-500 dark:text-indigo-400">
          <Clock className="h-3 w-3" />
          预计剩余 {eta}
        </p>
      )}

      {/* 步骤指示器 */}
      {hasSteps && (
        <div className="mt-4 flex items-center gap-2">
          {steps!.map((step, idx) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-5 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium transition-colors",
                  idx < currentStep! && "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
                  idx === currentStep && "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400",
                  idx > currentStep! && "bg-gray-50 text-gray-400 dark:bg-gray-800/50 dark:text-gray-500",
                )}
              >
                {idx < currentStep! && <span>✓</span>}
                {step}
              </div>
              {idx < steps!.length - 1 && (
                <div
                  className={cn(
                    "h-px w-4 transition-colors",
                    idx < currentStep! ? "bg-green-300 dark:bg-green-700" : "bg-gray-200 dark:bg-gray-700",
                  )}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* 扫描统计 */}
      {hasStats && (
        <div className="mt-4 flex items-center gap-6 rounded-xl border border-gray-100 bg-white/60 px-5 py-2.5 text-xs dark:border-gray-700/40 dark:bg-gray-800/40">
          {scannedCount !== undefined && (
            <div className="flex items-center gap-1.5">
              <FileSearch className="h-3.5 w-3.5 text-gray-400" />
              <span className="text-gray-500 dark:text-gray-400">已扫描</span>
              <strong className="tabular-nums text-gray-700 dark:text-gray-200">
                {scannedCount.toLocaleString()}
              </strong>
            </div>
          )}
          {foundCount !== undefined && foundCount > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
              <span className="text-gray-500 dark:text-gray-400">已发现</span>
              <strong className="tabular-nums text-indigo-600 dark:text-indigo-400">
                {foundCount.toLocaleString()}
              </strong>
            </div>
          )}
          {scanSpeed !== undefined && scanSpeed > 0 && (
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-gray-500 dark:text-gray-400">速度</span>
              <strong className="tabular-nums text-gray-700 dark:text-gray-200">
                {Math.round(scanSpeed)}/s
              </strong>
            </div>
          )}
        </div>
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

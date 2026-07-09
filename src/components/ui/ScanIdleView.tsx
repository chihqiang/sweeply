import { memo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Search } from "lucide-react";
import { Button } from "./Button";
import { ErrorAlert } from "./PageContainer";

/**
 * 扫描类页面 — 初始（空闲）状态通用视图
 *
 * 用于垃圾清理、大文件查找、重复文件查找、磁盘分析等页面的未扫描状态。
 * 包含装饰性圆形图标、标题、描述、配置区域和开始扫描按钮。
 */
export interface ScanIdleViewProps {
  /** 主图标（显示在渐变圆形内） */
  icon: LucideIcon;
  /** 页面标题，如"垃圾清理" */
  title: string;
  /** 页面描述 */
  description: string;
  /** 点击"开始扫描"按钮时的回调 */
  onScan: () => void;
  /** 扫描按钮文案，默认"开始扫描" */
  scanLabel?: string;
  /** 扫描按钮图标，默认 Search */
  scanIcon?: LucideIcon;
  /** 扫描按钮是否禁用 */
  scanDisabled?: boolean;
  /** 扫描按钮是否加载中 */
  scanLoading?: boolean;
  /** 配置区域内容（目录选择、阈值选择等），渲染在描述和按钮之间 */
  children?: ReactNode;
  /** 成功/信息横幅，渲染在按钮下方 */
  banner?: ReactNode;
  /** 错误信息，渲染在最底部 */
  error?: string | null;
  /** 按钮额外 className */
  buttonClassName?: string;
}

export const ScanIdleView = memo(function ScanIdleView({
  icon: Icon,
  title,
  description,
  onScan,
  scanLabel = "开始扫描",
  scanIcon: ScanIcon = Search,
  scanDisabled = false,
  scanLoading = false,
  children,
  banner,
  error,
  buttonClassName,
}: ScanIdleViewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6">
      {/* 装饰性圆形图形 */}
      <div className="relative mb-8 flex h-32 w-32 items-center justify-center">
        {/* 外圈光晕 */}
        <div className="absolute inset-0 rounded-full bg-indigo-100/40 blur-2xl dark:bg-indigo-900/20" />
        {/* 主圆 */}
        <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 shadow-xl shadow-indigo-500/30">
          <Icon className="h-12 w-12 text-white" />
        </div>
        {/* 装饰弧线 */}
        <svg
          className="absolute inset-0 -rotate-90"
          width="128"
          height="128"
          viewBox="0 0 128 128"
        >
          <circle
            cx="64"
            cy="64"
            r="62"
            fill="none"
            stroke="rgba(99,102,241,0.15)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        </svg>
      </div>

      <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
        {title}
      </h1>
      <p className="mt-2 max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>

      {/* 配置区域 */}
      {children && (
        <div className="mt-8 flex flex-col items-center gap-4">{children}</div>
      )}

      <Button
        onClick={onScan}
        size="lg"
        className={`mt-8 min-w-[200px] ${buttonClassName ?? ""}`}
        disabled={scanDisabled}
        loading={scanLoading}
      >
        <ScanIcon className="h-4 w-4" />
        {scanLabel}
      </Button>

      {/* 横幅提示 */}
      {banner && <div className="mt-6 max-w-md">{banner}</div>}

      {/* 错误提示 */}
      {error && (
        <div className="mt-6 max-w-md">
          <ErrorAlert message={error} />
        </div>
      )}
    </div>
  );
});

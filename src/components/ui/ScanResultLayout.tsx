import { memo, type ReactNode } from "react";
import { RotateCcw, Search } from "lucide-react";
import { Button } from "./Button";
import { PageContainer, ErrorAlert } from "./PageContainer";

/**
 * 扫描类页面 — 结果状态通用布局
 *
 * 用于垃圾清理、大文件查找、重复文件查找、磁盘分析等页面的扫描结果展示。
 * 提供统一的标题栏、错误提示、横幅、统计栏、工具栏、列表区域和底部操作栏。
 */
export interface ScanResultLayoutProps {
  /** 结果标题，如"扫描结果" */
  title: string;
  /** 副标题，如"共 12 项可清理文件" */
  subtitle: string;
  /** 重新扫描回调 */
  onRescan: () => void;
  /** 重置回调（可选，显示"重置"按钮） */
  onReset?: () => void;
  /** 重新扫描按钮文案，默认"重新扫描" */
  rescanLabel?: string;
  /** 重新扫描按钮图标，默认 Search */
  /** 错误信息 */
  error?: string | null;
  /** 顶部横幅（如清理成功提示），渲染在标题栏下方 */
  banner?: ReactNode;
  /** 统计栏行，渲染在横幅下方 */
  statsBar?: ReactNode;
  /** 工具栏行（搜索/排序等），渲染在统计栏下方 */
  toolbar?: ReactNode;
  /** 结果列表内容 */
  children: ReactNode;
  /** 底部粘性操作栏 */
  footer?: ReactNode;
  /** 内容最大宽度，默认 4xl */
  maxWidth?: "3xl" | "4xl";
}

export const ScanResultLayout = memo(function ScanResultLayout({
  title,
  subtitle,
  onRescan,
  onReset,
  rescanLabel = "重新扫描",
  error,
  banner,
  statsBar,
  toolbar,
  children,
  footer,
  maxWidth = "4xl",
}: ScanResultLayoutProps) {
  return (
    <PageContainer maxWidth={maxWidth}>
      {/* 标题栏 */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {title}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset}>
              <RotateCcw className="h-3.5 w-3.5" />
              重置
            </Button>
          )}
          <Button onClick={onRescan} size="md">
            <Search className="h-4 w-4" />
            {rescanLabel}
          </Button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && <ErrorAlert message={error} />}

      {/* 横幅 */}
      {banner}

      {/* 统计栏 */}
      {statsBar}

      {/* 工具栏 */}
      {toolbar}

      {/* 结果内容 */}
      {children}

      {/* 底部操作栏 */}
      {footer}
    </PageContainer>
  );
});

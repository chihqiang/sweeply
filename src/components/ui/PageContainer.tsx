import { memo, type ReactNode } from "react";
import { cn } from "@/utils/cn";

/* ───────────────────────────── PageContainer ───────────────────────────── */

export interface PageContainerProps {
  /** 内容最大宽度，默认 4xl */
  maxWidth?: "3xl" | "4xl";
  children: ReactNode;
  className?: string;
}

/** 统一页面容器 — 标准化内边距、滚动行为、最大宽度 */
export const PageContainer = memo(function PageContainer({
  maxWidth = "4xl",
  children,
  className,
}: PageContainerProps) {
  return (
    <div className="h-full overflow-y-auto px-10 py-8">
      <div className={cn("mx-auto", maxWidth === "3xl" ? "max-w-3xl" : "max-w-4xl", className)}>
        {children}
      </div>
    </div>
  );
});

/* ───────────────────────────── PageHeader ───────────────────────────── */

export interface PageHeaderProps {
  title: string;
  description?: string;
  /** 标题右侧的自定义徽标等元素 */
  badge?: ReactNode;
  /** 右侧操作区 */
  actions?: ReactNode;
  className?: string;
}

/** 统一页面头部 — 标题 + 描述 + 操作区 */
export const PageHeader = memo(function PageHeader({
  title,
  description,
  badge,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("mb-6 flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">{title}</h1>
          {badge}
        </div>
        {description && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
});

/* ───────────────────────────── PageLoading ───────────────────────────── */

export interface PageLoadingProps {
  label?: string;
  className?: string;
}

/** 统一页面级加载态 — 居中 spinner + 文案 */
export const PageLoading = memo(function PageLoading({
  label = "加载中...",
  className,
}: PageLoadingProps) {
  return (
    <div className={cn("flex h-full flex-col items-center justify-center gap-3", className)}>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-500 dark:border-gray-700 dark:border-t-indigo-400" />
      <span className="text-xs text-gray-400 dark:text-gray-500">{label}</span>
    </div>
  );
});

/* ───────────────────────────── ErrorAlert ───────────────────────────── */

export interface ErrorAlertProps {
  message: string;
  hint?: string;
  className?: string;
}

/** 统一错误提示条 */
export const ErrorAlert = memo(function ErrorAlert({
  message,
  hint,
  className,
}: ErrorAlertProps) {
  return (
    <div
      className={cn(
        "mb-4 flex items-start gap-2.5 rounded-xl border border-red-200/60 bg-red-50/80 px-4 py-3 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-900/20 dark:text-red-400 animate-fade-in",
        className,
      )}
    >
      <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <div className="min-w-0 flex-1">
        <span>{message}</span>
        {hint && <span className="ml-2 text-xs opacity-80">{hint}</span>}
      </div>
    </div>
  );
});

/* ───────────────────────────── SearchInput ───────────────────────────── */

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** 最大宽度 class，默认 max-w-md */
  maxWidthClass?: string;
  /** 搜索中状态 — 显示旋转图标 */
  searching?: boolean;
  className?: string;
}

/** 统一搜索输入框 */
export const SearchInput = memo(function SearchInput({
  value,
  onChange,
  placeholder = "搜索...",
  maxWidthClass = "max-w-md",
  searching = false,
  className,
}: SearchInputProps) {
  return (
    <div className={cn("relative flex-1", maxWidthClass, className)}>
      {searching ? (
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : (
        <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      )}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-gray-200 bg-white/80 pl-9 pr-8 text-sm text-gray-700 placeholder-gray-400 transition-colors focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/20 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-200"
      />
      {value && !searching && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="清除搜索"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
});

/* ───────────────────────────── SortSelect ───────────────────────────── */

export interface SortSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}

/** 统一排序下拉框 */
export const SortSelect = memo(function SortSelect({
  value,
  onChange,
  options,
  className,
}: SortSelectProps) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <svg className="h-3.5 w-3.5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M7 12h10M11 18h2" />
      </svg>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-lg border border-gray-200 bg-white/80 px-2 text-xs text-gray-600 transition-colors focus:border-indigo-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-300"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
});

/* ───────────────────────────── StatCard ───────────────────────────── */

export interface StatCardProps {
  value: string | number;
  label: string;
  /** 值的颜色 class，如 text-emerald-600 */
  valueClassName?: string;
  className?: string;
}

/** 统一统计卡片 */
export const StatCard = memo(function StatCard({
  value,
  label,
  valueClassName,
  className,
}: StatCardProps) {
  return (
    <div className={cn("rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm dark:border-gray-700/30 dark:bg-gray-800/50", className)}>
      <p className={cn("text-2xl font-bold text-gray-900 dark:text-gray-100", valueClassName)}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
});

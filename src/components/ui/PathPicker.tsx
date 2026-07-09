import { memo } from "react";
import type { LucideIcon } from "lucide-react";
import { FolderPlus } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * 路径选择器 — 将图标 + 路径展示合为一体的可点击元素
 *
 * 替代传统的带边框按钮，更轻量、更直观：
 * - 未选择路径时显示占位提示
 * - 已选择路径时显示缩短后的路径
 * - 点击整体触发目录选择对话框
 */
export interface PathPickerProps {
  /** 当前路径，空字符串表示未选择 */
  path: string;
  /** 点击时回调（通常打开目录选择对话框） */
  onClick: () => void;
  /** 占位提示文本 */
  placeholder?: string;
  /** 图标，默认 FolderPlus */
  icon?: LucideIcon;
  /** 是否禁用 */
  disabled?: boolean;
  /** 额外 className */
  className?: string;
}

/** 缩短路径显示：/Users/xxx → ~ */
function shortenPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, "~");
}

export const PathPicker = memo(function PathPicker({
  path,
  onClick,
  placeholder = "选择扫描目录",
  icon: Icon = FolderPlus,
  disabled = false,
  className,
}: PathPickerProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={path || placeholder}
      className={cn(
        "group inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white/50 px-3 py-1.5 text-sm transition-all",
        "hover:border-indigo-400 hover:bg-indigo-50/40 dark:border-gray-600 dark:bg-gray-800/30",
        "dark:hover:border-indigo-600 dark:hover:bg-indigo-900/10",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-indigo-500" />
      {path ? (
        <span className="max-w-[280px] truncate text-gray-600 dark:text-gray-300">
          {shortenPath(path)}
        </span>
      ) : (
        <span className="text-gray-400">{placeholder}</span>
      )}
    </button>
  );
});

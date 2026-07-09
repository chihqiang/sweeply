import { memo, useState, useCallback } from "react";
import { formatFileSize } from "@/utils/format";
import { Checkbox } from "@/components/ui";
import type { AppFileGroup } from "@/types/uninstaller";
import { UninstallFileType } from "@/types/uninstaller";
import { FolderOpen, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

const LABELS: Record<string, string> = {
  [UninstallFileType.Bundle]: "应用本体",
  [UninstallFileType.Support]: "支持文件",
  [UninstallFileType.Cache]: "缓存",
  [UninstallFileType.Preference]: "偏好设置",
  [UninstallFileType.State]: "状态文件",
  [UninstallFileType.Reporter]: "报告文件",
  [UninstallFileType.Log]: "日志",
  [UninstallFileType.Sandbox]: "沙盒数据",
  [UninstallFileType.Daemon]: "守护进程",
  [UninstallFileType.LoginItem]: "登录项",
  [UninstallFileType.KextWithBundleId]: "内核扩展",
  [UninstallFileType.KextWithPath]: "内核扩展",
  [UninstallFileType.Signal]: "信号文件",
  [UninstallFileType.FileSystem]: "文件系统",
  [UninstallFileType.PreferencePane]: "偏好面板",
  [UninstallFileType.Other]: "其他",
};

const PREVIEW_COUNT = 3;

interface Props {
  group: AppFileGroup;
  onToggleFile: (fileId: string) => void;
  onToggleGroup: (fileType: string) => void;
}

export const AppFileGroupCard = memo(function AppFileGroupCard({ group, onToggleFile, onToggleGroup }: Props) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((p) => !p), []);
  const hasMore = group.files.length > PREVIEW_COUNT;
  const visibleFiles = expanded ? group.files : group.files.slice(0, PREVIEW_COUNT);

  const allSelected = group.files.length > 0 && group.files.every((f) => f.selected);
  const noneSelected = group.files.every((f) => !f.selected);
  const hasSelection = group.selectedCount > 0;

  return (
    <div className={cn(
      "overflow-hidden rounded-xl border bg-white shadow-sm transition-all hover:shadow-md dark:bg-gray-800/50",
      hasSelection ? "border-indigo-200/60 dark:border-indigo-800/40" : "border-gray-100 dark:border-gray-700",
    )}>
      <div className="flex cursor-pointer items-center justify-between px-4 py-3" onClick={() => onToggleGroup(group.fileType)}>
        <div className="flex items-center gap-2.5">
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={allSelected}
              indeterminate={!allSelected && !noneSelected && hasSelection}
              onChange={() => onToggleGroup(group.fileType)}
            />
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700/40">
            <FolderOpen className="h-3.5 w-3.5 text-gray-400" />
          </div>
          <span className={cn(
            "text-sm font-medium",
            hasSelection ? "text-indigo-600 dark:text-indigo-400" : "text-gray-800 dark:text-gray-200",
          )}>{LABELS[group.fileType] ?? "未知"}</span>
          <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">{group.files.length}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasSelection && (
            <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
              {formatFileSize(group.selectedSize)}
            </span>
          )}
          <span className="text-sm font-semibold text-gray-500 dark:text-gray-400">{formatFileSize(group.totalSize)}</span>
        </div>
      </div>
      {group.files.length > 0 && (
        <div className="border-t border-gray-100 dark:border-gray-700/30">
          <div className="divide-y divide-gray-50 px-4 dark:divide-gray-700/20">
            {visibleFiles.map((f) => (
              <div
                key={f.id}
                className={cn(
                  "flex cursor-pointer items-center justify-between py-2 text-sm transition-colors",
                  f.selected && "text-indigo-600 dark:text-indigo-400",
                )}
                onClick={() => onToggleFile(f.id)}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={f.selected} onChange={() => onToggleFile(f.id)} />
                  </div>
                  <span className="truncate text-gray-600 dark:text-gray-300" title={f.path}>{f.name}</span>
                </div>
                <span className="ml-3 shrink-0 text-xs text-gray-400">{formatFileSize(f.size)}</span>
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              onClick={toggle}
              className="flex w-full items-center justify-center gap-1 border-t border-gray-100 py-2 text-xs font-medium text-indigo-500 transition-colors hover:bg-indigo-50/50 dark:border-gray-700/30 dark:text-indigo-400 dark:hover:bg-indigo-900/10"
            >
              {expanded ? (
                <>收起 <ChevronDown className="h-3 w-3" /></>
              ) : (
                <>展开全部 ({group.files.length - PREVIEW_COUNT} 项) <ChevronRight className="h-3 w-3" /></>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
});

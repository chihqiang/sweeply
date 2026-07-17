import { memo, useState, useCallback } from "react";
import { ShieldAlert, X, Settings, ChevronDown, ChevronUp } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/utils/cn";
import type { PermissionStatus } from "@/hooks/usePermissionCheck";

/**
 * 权限提示横幅 — 当应用缺少必要权限时展示警告
 *
 * 提示用户前往"系统设置 > 隐私与安全性 > 完全磁盘访问权限"授权。
 */
export interface PermissionBannerProps {
  permission: PermissionStatus;
  /** 是否可关闭（默认 true） */
  dismissible?: boolean;
  className?: string;
}

export const PermissionBanner = memo(function PermissionBanner({
  permission,
  dismissible = true,
  className,
}: PermissionBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleDismiss = useCallback(() => setDismissed(true), []);

  const handleOpenSettings = useCallback(async () => {
    try {
      await invoke("open_system_settings");
    } catch (e) {
      console.error("[permission] 打开系统设置失败:", e);
    }
  }, []);

  if (dismissed || permission.missingPermissions.length === 0) {
    return null;
  }

  const missing = permission.missingPermissions;

  return (
    <div
      className={cn(
        "rounded-xl border border-amber-200/60 bg-amber-50/80 px-4 py-3 text-sm dark:border-amber-800/60 dark:bg-amber-900/20 animate-fade-in",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500 dark:text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-amber-700 dark:text-amber-300">
              缺少 {missing.length} 项权限
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex h-6 items-center gap-0.5 rounded-md px-1.5 text-xs text-amber-600 transition-colors hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-900/30"
              >
                {expanded ? "收起" : "详情"}
                {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              {dismissible && (
                <button
                  onClick={handleDismiss}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-amber-400 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/30"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
          <p className="mt-0.5 text-xs text-amber-600 dark:text-amber-400/80">
            部分功能可能无法正常使用，扫描结果可能不完整
          </p>
          {expanded && (
            <div className="mt-2 space-y-1.5 animate-fade-in">
              <ul className="space-y-0.5 text-xs text-amber-600 dark:text-amber-400/80">
                {missing.map((perm) => (
                  <li key={perm} className="flex items-center gap-1.5">
                    <span className="h-1 w-1 rounded-full bg-amber-400" />
                    {perm}
                  </li>
                ))}
              </ul>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleOpenSettings}
                  className="flex items-center gap-1.5 rounded-md bg-amber-500 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-amber-600"
                >
                  <Settings className="h-3 w-3" />
                  前往系统设置
                </button>
                <span className="text-[11px] text-amber-500/70 dark:text-amber-400/60">
                  在"隐私与安全性 &gt; 完全磁盘访问权限"中添加 Sweeply
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

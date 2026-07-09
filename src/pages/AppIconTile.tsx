import { memo, useCallback, useState } from "react";
import { formatFileSize } from "@/utils/format";
import { AppWindow, CheckCircle2 } from "lucide-react";
import type { InstalledApp } from "@/types/uninstaller";
import { cn } from "@/utils/cn";

interface Props {
  app: InstalledApp;
  selected: boolean;
  onClick: (app: InstalledApp) => void;
}

export const AppIconTile = memo(function AppIconTile({ app, selected, onClick }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const handleError = useCallback(() => setImgFailed(true), []);

  const hasResiduals = app.isScanComplete && app.fileGroups && app.fileGroups.length > 0;
  const residualCount = hasResiduals
    ? app.fileGroups.reduce((s, g) => s + g.files.length, 0)
    : 0;
  // #22: 0残留显示绿色对勾，有残留显示橙色数字
  const isClean = app.isScanComplete && residualCount === 0;

  return (
    <button
      onClick={() => onClick(app)}
      className={cn(
        "group flex w-full min-w-0 flex-col items-center gap-2 rounded-2xl p-3 transition-all duration-300",
        "hover:bg-white hover:shadow-lg dark:hover:bg-gray-800/60",
        selected && "bg-white shadow-md dark:bg-gray-800/60",
      )
      }
      style={{
        transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      {/* 图标容器 */}
      <div
        className={cn(
          "relative flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300",
          "group-hover:scale-110 group-hover:-translate-y-1",
          "group-active:scale-95",
        )}
        style={{
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <div className={cn(
          "absolute inset-0 rounded-2xl transition-opacity duration-300",
          "bg-indigo-50 dark:bg-indigo-900/20",
          app.iconPath && !imgFailed && "opacity-0",
        )} />

        {app.iconPath && !imgFailed ? (
          <img
            src={app.iconPath}
            alt=""
            className="relative h-14 w-14 rounded-xl object-contain"
            onError={handleError}
          />
        ) : (
          <AppWindow className="relative h-7 w-7 text-indigo-400" />
        )}

        {/* #22: 残留角标 — 0残留绿色对勾，有残留橙色数字 */}
        {app.isScanComplete && isClean && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 shadow-md">
            <CheckCircle2 className="h-3.5 w-3.5 text-white" />
          </span>
        )}
        {residualCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-white shadow-md">
            {residualCount}
          </span>
        )}

        {selected && (
          <div className="absolute -bottom-1 h-1 w-8 rounded-full bg-indigo-500 shadow-md" />
        )}
      </div>

      <p
        className="w-full min-w-0 line-clamp-2 text-center text-xs font-medium leading-tight text-gray-700 dark:text-gray-300"
        title={app.showName || app.appName || "未知"}
      >
        {app.showName || app.appName || "未知"}
      </p>

      <p className="shrink-0 text-xs text-gray-500 dark:text-gray-400">
        {formatFileSize(app.bundleSize || 0)}
      </p>
    </button>
  );
});

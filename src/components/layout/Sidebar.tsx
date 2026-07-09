import { useState, useEffect } from "react";
import { NavLink } from "react-router-dom";
import { getVersion } from "@tauri-apps/api/app";
import { Sparkles, Sun, Moon } from "lucide-react";
import { NAV_GROUPS } from "@/constants/navigation";
import { cn } from "@/utils/cn";
import { APP_NAME } from "@/constants/app";
import { useTheme } from "@/hooks/useTheme";
import { Tooltip } from "@/components/ui";

/** 侧边栏 — 固定宽度 200px，分组导航，紧凑设计 */
export function Sidebar({ width = 200 }: { width?: number }) {
  const [appVersion, setAppVersion] = useState<string>("...");
  const { toggle, isDark } = useTheme();

  useEffect(() => {
    void getVersion()
      .then((v) => setAppVersion(v))
      .catch(() => setAppVersion("unknown"));
  }, []);

  return (
    <aside
      style={{ width }}
      className="relative flex h-full shrink-0 flex-col border-r border-gray-200/60 bg-white/80 backdrop-blur-xl dark:border-gray-700/50 dark:bg-gray-900/80"
    >
      {/* Logo ：简洁图标 + 名称 */}
      <div className="flex h-14 items-center gap-2.5 border-b border-gray-100/80 px-4 dark:border-gray-700/50">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 shadow-md shadow-indigo-500/20">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <span className="text-sm font-bold tracking-tight text-gray-900 dark:text-gray-100">
          {APP_NAME}
        </span>
      </div>

      {/* 导航 — 分组展示，对齐柠檬清理工具箱 */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-3">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.title} className={gi > 0 ? "mt-4" : ""}>
            {/* 分组标题 */}
            <p className="mb-1 px-2.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              {group.title}
            </p>
            {/* 导航项 */}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-all duration-150",
                        isActive
                          ? "bg-indigo-50 font-medium text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400"
                          : "text-gray-600 hover:bg-gray-100/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800/50 dark:hover:text-gray-200",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-indigo-500" />
                        )}
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform duration-150",
                            !isActive && "group-hover:scale-110",
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* 底部 — 版本 + 主题切换 */}
      <div className="border-t border-gray-100/80 px-3 py-2.5 dark:border-gray-700/50">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-gray-400 dark:text-gray-500">
            v{appVersion}
          </span>
          <Tooltip content={isDark ? "浅色模式" : "深色模式"}>
            <button
              onClick={toggle}
              aria-label={isDark ? "切换到浅色模式" : "切换到深色模式"}
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            >
              {isDark ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
          </Tooltip>
        </div>
      </div>
    </aside>
  );
}

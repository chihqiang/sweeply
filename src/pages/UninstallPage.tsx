/**
 * 应用卸载页面
 */
import { useMemo, useState, useEffect } from "react";
import { useUninstall } from "@/hooks/useUninstall";
import {
  Button,
  Card,
  ProgressBar,
  EmptyState,
} from "@/components/ui";
import { formatFileSize } from "@/utils/format";
import { TaskStatus } from "@/types/common";
import { UninstallFileType } from "@/types/uninstaller";
import {
  AppWindow,
  Search,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";

/** 页面标题 */
const PAGE_TITLE = "应用卸载";
const PAGE_DESCRIPTION = "彻底卸载应用及其残留文件，释放磁盘空间";

/** 文件类型显示名称映射 */
const FILE_TYPE_LABELS: Record<UninstallFileType, string> = {
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

/** 应用卸载页面组件 */
export default function UninstallPage() {
  const {
    appList,
    selectedApp,
    uninstallResult,
    status,
    uninstallProgress,
    error,
    scanApps,
    scanFiles,
    executeUninstall,
    selectApp,
  } = useUninstall();

  const [searchQuery, setSearchQuery] = useState("");

  // 页面加载时自动扫描应用列表
  useEffect(() => {
    void scanApps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isScanning = status === TaskStatus.Scanning;
  const isProcessing = status === TaskStatus.Processing;

  /** 过滤后的应用列表 */
  const filteredApps = useMemo(() => {
    if (!searchQuery.trim()) return appList;
    const query = searchQuery.toLowerCase();
    return appList.filter(
      (app) =>
        app.appName.toLowerCase().includes(query) ||
        app.bundleId.toLowerCase().includes(query),
    );
  }, [appList, searchQuery]);

  /** 选中的文件 ID 列表（空值保护） */
  const selectedFileIds = useMemo(() => {
    if (!selectedApp?.fileGroups) return [];
    return selectedApp.fileGroups
      .flatMap((g) => g.files)
      .filter((f) => f.selected)
      .map((f) => f.id);
  }, [selectedApp]);

  /** 处理应用点击 */
  const handleAppClick = (app: typeof appList[number]) => {
    selectApp(app);
    void scanFiles(app.id);
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* 页头 */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <AppWindow className="h-6 w-6 text-blue-500" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {PAGE_TITLE}
          </h1>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {PAGE_DESCRIPTION}
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        </Card>
      )}

      {/* 卸载结果 */}
      {uninstallResult && (
        <Card className="mb-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">
              卸载完成：已释放 {formatFileSize(uninstallResult.freedSize)}，
              删除 {uninstallResult.deletedFileCount} 个文件
              {uninstallResult.failedFileCount > 0 &&
                `，${uninstallResult.failedFileCount} 个失败`}
            </span>
          </div>
        </Card>
      )}

      {/* 卸载进度 */}
      {isProcessing && uninstallProgress && (
        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              正在卸载... ({uninstallProgress.deletedCount}/
              {uninstallProgress.totalCount})
            </span>
          </div>
          <ProgressBar
            value={
              uninstallProgress.totalCount > 0
                ? uninstallProgress.deletedCount /
                  uninstallProgress.totalCount
                : 0
            }
            className="mt-2"
            showLabel
          />
        </Card>
      )}

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* 左侧：应用列表 */}
        <div className="flex w-1/2 flex-col">
          {/* 搜索框 */}
          <div className="mb-3 flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索应用..."
                className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-700 placeholder-gray-400 focus:border-blue-400 focus:outline-none dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void scanApps()}
              loading={isScanning}
            >
              <RefreshCw className="h-4 w-4" />
              刷新
            </Button>
          </div>

          {/* 应用列表 */}
          <div className="flex-1 overflow-y-auto space-y-1">
            {filteredApps.length === 0 && !isScanning && (
              <EmptyState
                icon={AppWindow}
                title="未找到应用"
                description={searchQuery ? "尝试更换搜索关键词" : "点击「刷新」按钮扫描已安装应用"}
              />
            )}
            {filteredApps.map((app) => (
              <button
                key={app.id}
                onClick={() => handleAppClick(app)}
                className={[
                  "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                  selectedApp?.id === app.id
                    ? "border-blue-400 bg-blue-50 dark:border-blue-600 dark:bg-blue-900/20"
                    : "border-transparent hover:bg-gray-100 dark:hover:bg-gray-700/50",
                ].join(" ")}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700">
                  {app.iconPath ? (
                    <img
                      src={app.iconPath}
                      alt={app.appName}
                      className="h-8 w-8 rounded"
                    />
                  ) : (
                    <AppWindow className="h-5 w-5 text-gray-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                    {app.showName || app.appName || "未知应用"}
                  </p>
                  <p className="truncate text-xs text-gray-400">
                    {app.version || "未知版本"} · {formatFileSize(app.bundleSize || 0)}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </button>
            ))}
          </div>
        </div>

        {/* 右侧：应用详情 / 残留文件 */}
        <div className="flex w-1/2 flex-col">
          {!selectedApp ? (
            <EmptyState
              icon={AppWindow}
              title="选择一个应用"
              description="从左侧列表选择应用以查看残留文件"
              className="flex-1"
            />
          ) : (
            <>
              {/* 应用信息 */}
              <Card className="mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-200 dark:bg-gray-700">
                    {selectedApp.iconPath ? (
                      <img
                        src={selectedApp.iconPath}
                        alt={selectedApp.appName}
                        className="h-10 w-10 rounded"
                      />
                    ) : (
                      <AppWindow className="h-6 w-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800 dark:text-gray-100">
                      {selectedApp.showName || selectedApp.appName || "未知应用"}
                    </p>
                    <p className="text-xs text-gray-400">
                      {selectedApp.version || "未知版本"} · {formatFileSize(selectedApp.totalSize || 0)}
                    </p>
                  </div>
                  <Button
                    variant="danger"
                    size="sm"
                    loading={isProcessing}
                    disabled={selectedFileIds.length === 0}
                    onClick={() =>
                      void executeUninstall(
                        selectedApp.id,
                        selectedFileIds,
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                    卸载 ({selectedFileIds.length})
                  </Button>
                </div>
              </Card>

              {/* 残留文件分组 */}
              <div className="flex-1 overflow-y-auto space-y-2">
                {(!selectedApp.fileGroups || selectedApp.fileGroups.length === 0) &&
                  !selectedApp.isScanComplete && (
                    <EmptyState
                      icon={Search}
                      title="正在扫描残留文件..."
                      description="请稍候"
                    />
                  )}
                {(selectedApp.fileGroups ?? []).map((group) => (
                  <Card key={group.fileType} className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                        {FILE_TYPE_LABELS[group.fileType] ?? "未知"}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {formatFileSize(group.totalSize)}
                        <span className="ml-1 text-gray-400">
                          ({group.files.length} 项)
                        </span>
                      </span>
                    </div>
                    {group.files.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {group.files.slice(0, 5).map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400"
                          >
                            <span className="truncate" title={file.path}>
                              {file.name}
                            </span>
                            <span className="ml-2 shrink-0">
                              {formatFileSize(file.size)}
                            </span>
                          </div>
                        ))}
                        {group.files.length > 5 && (
                          <p className="text-xs text-gray-400">
                            ...还有 {group.files.length - 5} 项
                          </p>
                        )}
                      </div>
                    )}
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

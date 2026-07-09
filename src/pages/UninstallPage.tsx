import { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useUninstall } from "@/hooks/useUninstall";
import { useDebounce } from "@/hooks/useDebounce";
import { Button, ProgressBar, EmptyState, Dialog, useToast, Skeleton, PageContainer, PageHeader, ErrorAlert, SearchInput, SortSelect } from "@/components/ui";
import { formatFileSize } from "@/utils/format";
import { TaskStatus } from "@/types/common";
import { AppWindow, Trash2, RefreshCw, CheckCircle2, ChevronLeft, FileWarning } from "lucide-react";
import { AppIconTile } from "./AppIconTile";
import { AppFileGroupCard } from "./AppFileGroupCard";
import type { InstalledApp } from "@/types/uninstaller";
import { cn } from "@/utils/cn";

type SortBy = "name" | "size-desc" | "last-used";

export default function UninstallPage() {
  const { appList, selectedApp, uninstallResult, status, loading, scanProgress, uninstallProgress, error, scanApps, scanFiles, executeUninstall, selectApp, toggleFileSelection, toggleGroupSelection } = useUninstall();
  const { addToast } = useToast();
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const debouncedQuery = useDebounce(query, 250);
  const detailScrollRef = useRef<HTMLDivElement>(null);

  // 注意：不再在每次挂载时调用 scanApps()，由 hook 内部根据缓存决定是否需要请求

  useEffect(() => {
    if (selectedApp && detailScrollRef.current) {
      detailScrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedApp?.id]);

  const processing = status === TaskStatus.Processing;
  const showDetail = selectedApp !== null;

  // #19: 排序 + 搜索
  const filtered = useMemo(() => {
    let result = appList;
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.toLowerCase();
      result = result.filter((a) => a.appName.toLowerCase().includes(q) || a.bundleId.toLowerCase().includes(q));
    }
    const sorted = [...result];
    if (sortBy === "name") {
      sorted.sort((a, b) => (a.showName || a.appName).localeCompare(b.showName || b.appName, "zh-CN"));
    } else if (sortBy === "size-desc") {
      sorted.sort((a, b) => (b.bundleSize || 0) - (a.bundleSize || 0));
    } else if (sortBy === "last-used") {
      sorted.sort((a, b) => (b.lastUsedDate || 0) - (a.lastUsedDate || 0));
    }
    return sorted;
  }, [appList, debouncedQuery, sortBy]);

  const fileCount = useMemo(() => {
    if (!selectedApp?.fileGroups) return 0;
    return selectedApp.fileGroups.reduce((s, g) => s + g.files.length, 0);
  }, [selectedApp]);

  // #20: 计算实际选中文件大小
  const selectedFileSize = useMemo(() => {
    if (!selectedApp?.fileGroups) return 0;
    return selectedApp.fileGroups.reduce((s, g) => s + g.selectedSize, 0);
  }, [selectedApp]);

  const selectedFileCount = useMemo(() => {
    if (!selectedApp?.fileGroups) return 0;
    return selectedApp.fileGroups.reduce((s, g) => s + g.selectedCount, 0);
  }, [selectedApp]);

  const handleClick = useCallback((app: InstalledApp) => {
    selectApp(app);
    scanFiles(app.id);
  }, [selectApp, scanFiles]);

  const handleUninstall = useCallback(async () => {
    if (!selectedApp) return;
    setConfirmOpen(false);
    try {
      const ids = selectedApp.fileGroups?.flatMap((g) => g.files).filter((f) => f.selected).map((f) => f.id) ?? [];
      await executeUninstall(selectedApp.id, ids);
      addToast({ type: "success", message: `已卸载 ${selectedApp.showName || selectedApp.appName}` });
    } catch { addToast({ type: "error", message: "卸载失败" }); }
  }, [selectedApp, executeUninstall, addToast]);

  const handleRefresh = useCallback(() => { scanApps(); }, [scanApps]);
  const handleClose = useCallback(() => selectApp(null), [selectApp]);

  return (
    <PageContainer>
      <PageHeader
        title="应用卸载"
        description="彻底卸载应用及其残留文件"
        actions={
          <Button variant="outline" size="sm" onClick={handleRefresh} loading={loading}>
            <RefreshCw className="h-3.5 w-3.5" />
            刷新
          </Button>
        }
      />

      {/* Search + Sort */}
      <div className="mb-5 flex items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="搜索应用..."
          maxWidthClass="max-w-md"
          searching={query !== debouncedQuery && query.trim() !== ""}
        />
        <SortSelect
          value={sortBy}
          onChange={(v) => setSortBy(v as SortBy)}
          options={[
            { value: "name", label: "按名称" },
            { value: "size-desc", label: "按大小" },
            { value: "last-used", label: "按使用时间" },
          ]}
        />
      </div>

      {/* App count */}
      <div className="mb-4 flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {loading
            ? scanProgress && scanProgress.total > 0
              ? `扫描中... ${scanProgress.scanned}/${scanProgress.total}`
              : "加载中..."
            : `${filtered.length} 个应用`}
        </span>
      </div>

      {/* Grid */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {/* 加载中且列表为空时显示骨架屏 */}
        {loading && appList.length === 0 && (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {[1,2,3,4,5,6,7,8,9,10].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 p-3">
                <Skeleton variant="rect" width={64} height={64} className="rounded-2xl" />
                <Skeleton variant="text" width={48} height={10} />
              </div>
            ))}
          </div>
        )}
        {/* 加载中但已有部分应用时显示进度条 */}
        {loading && appList.length > 0 && scanProgress && scanProgress.total > 0 && (
          <div className="mb-3 rounded-xl border border-gray-100 bg-white px-4 py-3 dark:border-gray-700/30 dark:bg-gray-800/50">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium text-gray-600 dark:text-gray-300">
                正在扫描应用... {scanProgress.scanned}/{scanProgress.total}
              </span>
              <span className="text-xs text-gray-400">
                已发现 {appList.length} 个
              </span>
            </div>
            <ProgressBar value={scanProgress.scanned / scanProgress.total} />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <EmptyState icon={AppWindow} title="未找到应用" description={query ? "更换搜索关键词" : "点击刷新按钮扫描"} />
        )}
        {filtered.length > 0 && (
          <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
            {filtered.map((app, idx) => (
              <div
                key={app.id}
                className="min-w-0 animate-fade-in-up"
                style={{ animationDelay: `${Math.min(idx * 20, 400)}ms`, animationFillMode: "backwards" }}
              >
                <AppIconTile app={app} selected={false} onClick={handleClick} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════
          侧滑面板 (Slide-in Panel)
          常规清理工具的交互模式：从右侧滑入，不遮挡应用列表
      ════════════════════════════════════════════════════════════════ */}
      {showDetail && (
        <>
          {/* 遮罩层 */}
          <div
            className="fixed inset-0 z-[9997] bg-black/20 backdrop-blur-sm animate-fade-in"
            onClick={handleClose}
          />

          {/* 侧滑面板 */}
          <div
            className={cn(
              "fixed right-0 top-0 z-[9998] flex h-full w-full max-w-xl flex-col",
              "bg-white shadow-2xl dark:bg-gray-800",
              "animate-slide-in-right",
            )}
            style={{ animationDuration: "0.3s" }}
          >
            {/* Error / Result / Progress */}
            <div className="shrink-0 space-y-3 border-b border-gray-100 px-6 pt-6 pb-4 dark:border-gray-700/30">
              {error && <ErrorAlert message={error} />}
              {uninstallResult && (
                <div className="flex items-center gap-2.5 rounded-xl border border-green-200/60 bg-green-50/80 px-4 py-3 text-sm text-green-700 dark:border-green-800/60 dark:bg-green-900/20 dark:text-green-400 animate-fade-in">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>已释放 {formatFileSize(uninstallResult.freedSize)}，删除 {uninstallResult.deletedFileCount} 个文件{uninstallResult.failedFileCount > 0 && `，${uninstallResult.failedFileCount} 个失败`}</span>
                </div>
              )}
              {processing && uninstallProgress && (
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800/50 animate-fade-in">
                  <div className="mb-2.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-gray-600 dark:text-gray-300">卸载中... ({uninstallProgress.deletedCount}/{uninstallProgress.totalCount})</span>
                  </div>
                  <ProgressBar value={uninstallProgress.totalCount > 0 ? uninstallProgress.deletedCount / uninstallProgress.totalCount : 0} />
                </div>
              )}
            </div>

            {/* Detail scrollable area */}
            <div ref={detailScrollRef} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              {!selectedApp ? (
                <EmptyState icon={AppWindow} title="选择一个应用" description="从应用列表中选择查看残留文件" />
              ) : (
                <div className="animate-fade-in">
                  {/* App Detail Header */}
                  <div className="mb-5 flex items-center gap-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
                    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 dark:bg-indigo-900/20">
                      {selectedApp.iconPath ? <img src={selectedApp.iconPath} alt="" className="h-12 w-12 rounded-xl" /> : <AppWindow className="h-7 w-7 text-indigo-500" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{selectedApp.showName || selectedApp.appName || "未知"}</p>
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        {selectedApp.version || "未知版本"} · {formatFileSize(selectedApp.totalSize || 0)}
                        {selectedApp.isScanComplete && <> · {fileCount} 个残留</>}
                      </p>
                    </div>
                    <Button variant="danger" size="sm" loading={processing} disabled={!selectedApp.isScanComplete || selectedFileCount === 0} onClick={() => setConfirmOpen(true)}>
                      <Trash2 className="h-3.5 w-3.5" />
                      卸载
                    </Button>
                  </div>

                  {/* File Groups */}
                  <div className="space-y-2.5">
                    {!selectedApp.isScanComplete && fileCount === 0 && (
                      <div className="space-y-2.5">
                        {[1,2,3].map((i) => <Skeleton key={i} variant="card" height={70} />)}
                      </div>
                    )}
                    {selectedApp.isScanComplete && fileCount === 0 && (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-12 dark:border-gray-700 dark:bg-gray-800/50">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 dark:bg-green-900/20">
                          <CheckCircle2 className="h-6 w-6 text-green-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">未发现残留文件</p>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">该应用很干净</p>
                      </div>
                    )}
                    {(selectedApp.fileGroups ?? []).map((group) => (
                      <AppFileGroupCard
                        key={group.fileType}
                        group={group}
                        onToggleFile={toggleFileSelection}
                        onToggleGroup={toggleGroupSelection}
                      />
                    ))}
                  </div>

                  {/* Warning footer */}
                  {selectedApp.isScanComplete && fileCount > 0 && (
                    <div className="mt-5 flex items-start gap-2.5 rounded-xl bg-amber-50/60 px-4 py-3 dark:bg-amber-900/10">
                      <FileWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <p className="text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                        卸载将删除应用本体及所有关联的残留文件。请确认选中的文件无误，此操作不可撤销。
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer — 关闭按钮 */}
            <div className="shrink-0 border-t border-gray-100 px-6 py-3 dark:border-gray-700/30">
              <button
                onClick={handleClose}
                className="flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-indigo-500 dark:text-gray-400"
              >
                <ChevronLeft className="h-4 w-4" />
                关闭
              </button>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleUninstall}
        loading={processing}
        title="确认卸载"
        description={selectedApp ? `将卸载「${selectedApp.showName || selectedApp.appName}」及 ${selectedFileCount} 个选中文件，释放 ${formatFileSize(selectedFileSize)}。此操作不可撤销。` : ""}
        confirmLabel="确认卸载"
        danger
      />
    </PageContainer>
  );
}

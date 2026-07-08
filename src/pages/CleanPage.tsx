/**
 * 垃圾清理页面
 */
import { useMemo, useState } from "react";
import { useClean } from "@/hooks/useClean";
import { Button, Card, ProgressBar, EmptyState, StatusBadge } from "@/components/ui";
import { formatFileSize, formatPercent } from "@/utils/format";
import { TaskStatus } from "@/types/common";
import type { CleanSubcategory } from "@/types/clean";
import { Trash2, Search, CheckCircle2, AlertCircle, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";

/** 页面标题 */
const PAGE_TITLE = "垃圾清理";
const PAGE_DESCRIPTION = "扫描系统中的缓存、日志、临时文件等垃圾数据";

/** 垃圾清理页面组件 */
export default function CleanPage() {
  const {
    scanSummary,
    cleanResult,
    status,
    scanProgress,
    error,
    startScan,
    executeCleanAction,
    stopScan,
    reset,
    toggleItemSelection,
    toggleSubcategorySelection,
  } = useClean();

  const isScanning = status === TaskStatus.Scanning;
  const isProcessing = status === TaskStatus.Processing;

  /** 展开的子分类 ID 集合 */
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());

  /** 切换子分类展开/折叠 */
  const toggleExpand = (subcategoryId: string) => {
    setExpandedSubs((prev) => {
      const next = new Set(prev);
      if (next.has(subcategoryId)) {
        next.delete(subcategoryId);
      } else {
        next.add(subcategoryId);
      }
      return next;
    });
  };

  /** 收集所有选中的结果项 ID */
  const selectedIds = useMemo(() => {
    if (!scanSummary) return [];
    return scanSummary.categories
      .flatMap((cat) => cat.subcategories)
      .flatMap((sub) => sub.results)
      .filter((r) => r.selected)
      .map((r) => r.id);
  }, [scanSummary]);

  /** 计算子分类的选中状态 */
  const getSubcategorySelectionInfo = (sub: CleanSubcategory) => {
    const selectedCount = sub.results.filter((r) => r.selected).length;
    const selectedSize = sub.results
      .filter((r) => r.selected)
      .reduce((s, r) => s + r.size, 0);
    const allSelected =
      sub.results.length > 0 && selectedCount === sub.results.length;
    const noneSelected = selectedCount === 0;
    return { selectedCount, selectedSize, allSelected, noneSelected };
  };

  return (
    <div className="flex h-full flex-col p-6">
      {/* 页头 */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Trash2 className="h-6 w-6 text-blue-500" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {PAGE_TITLE}
          </h1>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {PAGE_DESCRIPTION}
        </p>
      </div>

      {/* 扫描进度 */}
      {isScanning && scanProgress && (
        <Card className="mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              {scanProgress.description || "正在扫描..."}
            </span>
            <span className="text-sm font-medium text-blue-500">
              {formatPercent(scanProgress.progress)}
            </span>
          </div>
          <ProgressBar
            value={scanProgress.progress}
            className="mt-2"
            showLabel
          />
        </Card>
      )}

      {/* 错误提示 */}
      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        </Card>
      )}

      {/* 操作按钮 */}
      <div className="mb-4 flex items-center gap-3">
        <Button
          onClick={() => void startScan()}
          loading={isScanning}
          disabled={isProcessing}
        >
          <Search className="h-4 w-4" />
          {isScanning ? "扫描中..." : scanSummary ? "重新扫描" : "开始扫描"}
        </Button>
        {isScanning && (
          <Button variant="outline" onClick={() => void stopScan()}>
            停止扫描
          </Button>
        )}
        {scanSummary && !isScanning && !isProcessing && (
          <Button
            variant="danger"
            onClick={() => void executeCleanAction(selectedIds)}
            disabled={selectedIds.length === 0}
          >
            <Trash2 className="h-4 w-4" />
            清理选中 ({selectedIds.length} 项)
          </Button>
        )}
      </div>

      {/* 清理结果 */}
      {cleanResult && (
        <Card className="mb-4 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20">
          <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-medium">
              清理完成：已释放 {formatFileSize(cleanResult.cleanedSize)}，
              清理 {cleanResult.cleanedFileCount} 个文件
              {cleanResult.failedFileCount > 0 &&
                `，${cleanResult.failedFileCount} 个失败`}
            </span>
          </div>
        </Card>
      )}

      {/* 扫描结果列表 */}
      <div className="flex-1 overflow-y-auto">
        {!scanSummary && !isScanning && (
          <EmptyState
            icon={Trash2}
            title="暂无扫描结果"
            description="点击「开始扫描」检测系统垃圾"
          />
        )}

        {scanSummary?.categories.map((category) => (
          <Card key={category.categoryId} className="mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-800 dark:text-gray-100">
                  {category.title}
                </h3>
                {category.isScanning && (
                  <StatusBadge color="blue">扫描中</StatusBadge>
                )}
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {formatFileSize(
                  category.subcategories.reduce(
                    (sum, sub) =>
                      sum + sub.results.reduce((s, r) => s + r.size, 0),
                    0,
                  ),
                )}
              </span>
            </div>
            <div className="mt-3 space-y-2">
              {category.subcategories.map((sub) => {
                const {
                  selectedCount,
                  selectedSize,
                  allSelected,
                  noneSelected,
                } = getSubcategorySelectionInfo(sub);
                const isExpanded = expandedSubs.has(sub.subcategoryId);
                const totalSize = sub.results.reduce(
                  (s, r) => s + r.size,
                  0,
                );

                return (
                  <div
                    key={sub.subcategoryId}
                    className="rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    {/* 子分类标题行（可点击展开/折叠） */}
                    <div className="flex items-center justify-between px-3 py-2">
                      <div className="flex items-center gap-2">
                        {/* 全选/取消全选复选框 */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSubcategorySelection(sub.subcategoryId);
                          }}
                          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors"
                          style={{
                            borderColor: allSelected
                              ? "#3b82f6"
                              : noneSelected
                                ? "#d1d5db"
                                : "#3b82f6",
                            backgroundColor: allSelected
                              ? "#3b82f6"
                              : noneSelected
                                ? "transparent"
                                : "#3b82f6",
                          }}
                          title={
                            allSelected ? "取消全选" : "全选"
                          }
                        >
                          {allSelected && (
                            <svg
                              className="h-3 w-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                          {!allSelected && !noneSelected && (
                            <div className="h-2 w-2 rounded-sm bg-white" />
                          )}
                        </button>

                        {/* 展开/折叠按钮 */}
                        <button
                          type="button"
                          onClick={() => toggleExpand(sub.subcategoryId)}
                          className="flex items-center gap-1 text-sm text-gray-700 dark:text-gray-200 hover:text-blue-500"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {sub.title}
                        </button>

                        {sub.cautious && (
                          <StatusBadge color="yellow" className="ml-1">
                            谨慎清理
                          </StatusBadge>
                        )}
                        {sub.recommend && (
                          <StatusBadge color="green" className="ml-1">
                            推荐
                          </StatusBadge>
                        )}
                      </div>

                      <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                        {selectedCount > 0 && (
                          <span className="text-blue-500">
                            {formatFileSize(selectedSize)} /{" "}
                          </span>
                        )}
                        {formatFileSize(totalSize)}
                        <span className="ml-2 text-gray-400">
                          ({sub.results.length} 项)
                        </span>
                      </span>
                    </div>

                    {/* 展开后显示文件列表 */}
                    {isExpanded && sub.results.length > 0 && (
                      <div className="border-t border-gray-200 px-3 py-2 dark:border-gray-600">
                        <div className="space-y-1">
                          {sub.results.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-600/50"
                            >
                              {/* 单项复选框 */}
                              <button
                                type="button"
                                onClick={() => toggleItemSelection(item.id)}
                                className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors"
                                style={{
                                  borderColor: item.selected
                                    ? "#3b82f6"
                                    : "#d1d5db",
                                  backgroundColor: item.selected
                                    ? "#3b82f6"
                                    : "transparent",
                                }}
                              >
                                {item.selected && (
                                  <svg
                                    className="h-3 w-3 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                )}
                              </button>

                              <FolderOpen className="h-4 w-4 shrink-0 text-gray-400" />

                              <div className="min-w-0 flex-1">
                                <p
                                  className="truncate text-xs font-medium text-gray-700 dark:text-gray-200"
                                  title={item.path}
                                >
                                  {item.title}
                                </p>
                                <p
                                  className="truncate text-xs text-gray-400"
                                  title={item.path}
                                >
                                  {item.displayPath}
                                </p>
                              </div>

                              <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
                                {formatFileSize(item.size)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 展开后但无文件 */}
                    {isExpanded && sub.results.length === 0 && (
                      <div className="border-t border-gray-200 px-3 py-3 text-center dark:border-gray-600">
                        <span className="text-xs text-gray-400">
                          未发现可清理文件
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      {/* 底部汇总 */}
      {scanSummary && (
        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4 dark:border-gray-700">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              可清理总量：
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                {formatFileSize(scanSummary.totalSize)}
              </span>
            </span>
            <span className="text-sm text-blue-500">
              已选：
              <span className="font-semibold">
                {formatFileSize(scanSummary.selectedSize)}
              </span>
              <span className="ml-1 text-gray-400">
                ({scanSummary.selectedFileCount} 项)
              </span>
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={reset}>
            重置
          </Button>
        </div>
      )}
    </div>
  );
}

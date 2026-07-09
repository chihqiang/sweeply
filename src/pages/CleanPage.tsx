import { useMemo, useState, useCallback, memo, useRef, useEffect } from "react";
import { useClean, CACHE_KEY_CLEAN } from "@/hooks/useClean";
import { useSmoothProgress } from "@/hooks/useSmoothProgress";
import { useDebounce } from "@/hooks/useDebounce";
import {
  Button,
  EmptyState,
  Dialog,
  Checkbox,
  useToast,
  SearchInput,
  SortSelect,
  ScanIdleView,
  ScanProgressView,
  ScanResultLayout,
} from "@/components/ui";
import { formatFileSize } from "@/utils/format";
import { cacheGet } from "@/utils/cache";
import { TaskStatus } from "@/types/common";
import {
  Trash2,
  CheckCircle2,
  HardDrive,
  AppWindow,
  Globe,
  Code2,
  Bot,
  CheckCheck,
  Square,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/utils/cn";
import type {
  CleanScanSummary,
  CleanCategory,
  CleanSubcategory,
  CleanResultItem,
} from "@/types/clean";

/* ───────────────────────── 常量 & 工具 ───────────────────────── */

/** 分类图标映射（后端返回 categoryId 字符串，前端按需匹配图标） */
const CATEGORY_ICONS: Record<string, typeof HardDrive> = {
  system: HardDrive,
  application: AppWindow,
  browser: Globe,
  developer: Code2,
  aitools: Bot,
};

type SortBy = "size-desc" | "size-asc" | "name";

/** 计算分类总大小（含直接结果和子分类结果） */
function categoryTotalSize(cat: CleanCategory): number {
  const direct = cat.results.reduce((s, r) => s + r.size, 0);
  const sub = cat.subcategories.reduce(
    (s, sub) => s + sub.results.reduce((a, r) => a + r.size, 0),
    0,
  );
  return direct + sub;
}

/** 计算分类中已选大小和已选数（含直接结果和子分类结果） */
function categorySelectedInfo(cat: CleanCategory): {
  selectedSize: number;
  selectedCount: number;
  totalItems: number;
} {
  let selectedSize = 0;
  let selectedCount = 0;
  let totalItems = 0;
  for (const item of cat.results) {
    totalItems++;
    if (item.selected) {
      selectedSize += item.size;
      selectedCount++;
    }
  }
  for (const sub of cat.subcategories) {
    for (const item of sub.results) {
      totalItems++;
      if (item.selected) {
        selectedSize += item.size;
        selectedCount++;
      }
    }
  }
  return { selectedSize, selectedCount, totalItems };
}

/* ───────────────────────── 子组件 ───────────────────────── */

/** 文件行 */
const CleanFileRow = memo(function CleanFileRow({
  item,
  onToggle,
}: {
  item: CleanResultItem;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors",
        "hover:bg-gray-50 dark:hover:bg-gray-700/30",
        item.selected && "bg-indigo-50/50 dark:bg-indigo-900/15",
      )}
      onClick={() => onToggle(item.id)}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={item.selected}
          onChange={() => onToggle(item.id)}
        />
      </div>
      <div
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors",
          item.selected
            ? "bg-indigo-100 dark:bg-indigo-900/30"
            : "bg-gray-100 dark:bg-gray-700/50",
        )}
      >
        <FolderOpen
          className={cn(
            "h-3 w-3",
            item.selected ? "text-indigo-500" : "text-gray-400",
          )}
        />
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[13px] font-medium text-gray-700 dark:text-gray-200"
          title={item.path}
        >
          {item.title}
        </p>
        <p
          className="truncate text-xs text-gray-500 dark:text-gray-400"
          title={item.path}
        >
          {item.displayPath}
        </p>
      </div>
      <span
        className={cn(
          "shrink-0 text-[13px] font-medium",
          item.selected
            ? "text-indigo-600 dark:text-indigo-400"
            : "text-gray-500 dark:text-gray-400",
        )}
      >
        {formatFileSize(item.size)}
      </span>
    </div>
  );
});

/** 子分类行（含展开/收起） */
const SubcategoryRow = memo(function SubcategoryRow({
  sub,
  isExpanded,
  info,
  onToggle,
  onToggleSub,
  onToggleItem,
}: {
  sub: CleanSubcategory;
  isExpanded: boolean;
  info: {
    selectedCount: number;
    selectedSize: number;
    allSelected: boolean;
    noneSelected: boolean;
    totalSize: number;
  };
  onToggle: (id: string) => void;
  onToggleSub: (id: string) => void;
  onToggleItem: (id: string) => void;
}) {
  const { selectedCount, selectedSize, allSelected, noneSelected, totalSize } =
    info;
  const hasSelection = selectedCount > 0;

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors",
          "hover:bg-gray-50 dark:hover:bg-gray-700/30",
          hasSelection && "bg-indigo-50/30 dark:bg-indigo-900/10",
        )}
        onClick={() => onToggle(sub.subcategoryId)}
      >
        <div className="flex items-center gap-2.5">
          <div onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={allSelected}
              indeterminate={
                !allSelected && !noneSelected && selectedCount > 0
              }
              onChange={() => onToggleSub(sub.subcategoryId)}
            />
          </div>
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
          )}
          <span
            className={cn(
              "text-[13px] font-medium",
              hasSelection
                ? "text-indigo-700 dark:text-indigo-300"
                : "text-gray-700 dark:text-gray-200",
            )}
          >
            {sub.title}
          </span>
          {sub.recommend && (
            <span className="inline-flex items-center gap-0.5 rounded bg-green-50 px-1 py-0.5 text-xs font-medium text-green-600 dark:bg-green-900/20 dark:text-green-400">
              <ShieldCheck className="h-3 w-3" />
              推荐
            </span>
          )}
          {sub.cautious && (
            <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              谨慎
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-[13px]">
          {hasSelection && (
            <span className="font-semibold text-indigo-600 dark:text-indigo-400">
              {formatFileSize(selectedSize)}
            </span>
          )}
          <span className="text-gray-500 dark:text-gray-400">
            {formatFileSize(totalSize)}
            <span className="ml-1 text-gray-400 dark:text-gray-500">
              ({sub.results.length})
            </span>
          </span>
        </div>
      </div>

      {isExpanded && sub.results.length > 0 && (
        <div className="ml-7 space-y-0.5 animate-fade-in">
          {sub.results.map((item) => (
            <CleanFileRow
              key={item.id}
              item={item}
              onToggle={onToggleItem}
            />
          ))}
        </div>
      )}
    </div>
  );
});

/** 直接结果行 */
const DirectResultsSection = memo(function DirectResultsSection({
  results,
  isExpanded,
  onToggleExpand,
  onToggleItem,
}: {
  results: CleanResultItem[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onToggleItem: (id: string) => void;
}) {
  return (
    <div className="space-y-1">
      <div
        className="flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
        onClick={onToggleExpand}
      >
        {isExpanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
        )}
        <span className="text-[13px] font-medium text-gray-500 dark:text-gray-400">
          {isExpanded ? "收起" : "展开"} {results.length} 项
        </span>
      </div>
      {isExpanded && (
        <div className="space-y-0.5 animate-fade-in">
          {results.map((item) => (
            <CleanFileRow
              key={item.id}
              item={item}
              onToggle={onToggleItem}
            />
          ))}
        </div>
      )}
    </div>
  );
});

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
    toggleCategorySelection,
    selectAllRecommended,
    deselectAll,
  } = useClean();
  const { addToast } = useToast();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (!scanSummary) return new Set();
    const ids = new Set<string>();
    for (const cat of scanSummary.categories) {
      for (const sub of cat.subcategories) {
        if (sub.results.some((r) => r.selected)) ids.add(sub.subcategoryId);
      }
    }
    return ids;
  });
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounce(searchQuery, 200);
  const [sortBy, setSortBy] = useState<SortBy>("size-desc");

  // 扫描进度 ETA 计算
  const scanStartTimeRef = useRef<number>(0);
  const [eta, setEta] = useState<string>("");

  const isScanning = status === TaskStatus.Scanning;
  const isProcessing = status === TaskStatus.Processing;

  useEffect(() => {
    if (isScanning && scanStartTimeRef.current === 0) {
      scanStartTimeRef.current = performance.now();
    }
    if (!isScanning) {
      scanStartTimeRef.current = 0;
      setEta("");
    }
  }, [isScanning]);

  useEffect(() => {
    if (!isScanning || !scanProgress || scanProgress.progress <= 0.05) return;
    const elapsed = (performance.now() - scanStartTimeRef.current) / 1000;
    const rate = scanProgress.progress / elapsed;
    if (rate > 0 && scanProgress.progress < 0.95) {
      const remaining = (1 - scanProgress.progress) / rate;
      if (remaining > 60) {
        setEta(`约 ${Math.ceil(remaining / 60)} 分钟`);
      } else if (remaining > 1) {
        setEta(`约 ${Math.ceil(remaining)} 秒`);
      }
    }
  }, [isScanning, scanProgress]);

  const toggle = useCallback(
    (id: string) =>
      setExpanded((p) => {
        const n = new Set(p);
        if (n.has(id)) n.delete(id);
        else n.add(id);
        return n;
      }),
    [],
  );

  // 计算选中信息 + 搜索过滤 + 排序
  const {
    selectedIds,
    sizes,
    totalSelected,
    sortedCategories,
    subInfoMap,
    catInfoMap,
    categorySummary,
  } = useMemo(() => {
    const ids: string[] = [];
    const szs: number[] = [];
    let total = 0;
    const subMap = new Map<
      string,
      {
        selectedCount: number;
        selectedSize: number;
        allSelected: boolean;
        noneSelected: boolean;
        totalSize: number;
      }
    >();
    const catMap = new Map<
      string,
      {
        selectedSize: number;
        selectedCount: number;
        totalItems: number;
        allSelected: boolean;
        noneSelected: boolean;
      }
    >();
    const catSummary: {
      title: string;
      selectedSize: number;
      selectedCount: number;
    }[] = [];

    if (!scanSummary)
      return {
        selectedIds: ids,
        sizes: szs,
        totalSelected: total,
        sortedCategories: [],
        subInfoMap: subMap,
        catInfoMap: catMap,
        categorySummary: catSummary,
      };

    const q = debouncedQuery.trim().toLowerCase();

    for (const cat of scanSummary.categories) {
      const { selectedSize, selectedCount, totalItems } =
        categorySelectedInfo(cat);
      catMap.set(cat.categoryId, {
        selectedSize,
        selectedCount,
        totalItems,
        allSelected: totalItems > 0 && selectedCount === totalItems,
        noneSelected: selectedCount === 0,
      });

      if (selectedCount > 0) {
        catSummary.push({ title: cat.title, selectedSize, selectedCount });
      }

      for (const item of cat.results) {
        if (item.selected) {
          ids.push(item.id);
          szs.push(item.size);
          total += item.size;
        }
      }
      for (const sub of cat.subcategories) {
        let n = 0,
          sz = 0,
          ts = 0;
        for (const item of sub.results) {
          ts += item.size;
          if (item.selected) {
            n++;
            sz += item.size;
            ids.push(item.id);
            szs.push(item.size);
          }
        }
        total += sz;
        subMap.set(sub.subcategoryId, {
          selectedCount: n,
          selectedSize: sz,
          allSelected: sub.results.length > 0 && n === sub.results.length,
          noneSelected: n === 0,
          totalSize: ts,
        });
      }
    }

    // 搜索过滤 + 排序
    let sorted = scanSummary.categories
      .map((cat) => {
        if (q) {
          const filteredSubs = cat.subcategories
            .map((sub) => ({
              ...sub,
              results: sub.results.filter(
                (r) =>
                  r.title.toLowerCase().includes(q) ||
                  r.displayPath.toLowerCase().includes(q),
              ),
            }))
            .filter((sub) => sub.results.length > 0);
          const filteredDirect = cat.results.filter(
            (r) =>
              r.title.toLowerCase().includes(q) ||
              r.displayPath.toLowerCase().includes(q),
          );
          return {
            ...cat,
            subcategories: filteredSubs,
            results: filteredDirect,
          };
        }
        return {
          ...cat,
          subcategories: cat.subcategories.filter(
            (sub) => sub.results.length > 0,
          ),
        };
      })
      .filter(
        (cat) => cat.results.length > 0 || cat.subcategories.length > 0,
      );

    sorted = sorted.map((cat) => ({
      ...cat,
      subcategories: [...cat.subcategories].sort(
        (a, b) => b.totalSize - a.totalSize,
      ),
    }));

    if (sortBy === "size-desc") {
      sorted.sort((a, b) => categoryTotalSize(b) - categoryTotalSize(a));
    } else if (sortBy === "size-asc") {
      sorted.sort((a, b) => categoryTotalSize(a) - categoryTotalSize(b));
    } else if (sortBy === "name") {
      sorted.sort((a, b) => a.title.localeCompare(b.title, "zh-CN"));
    }

    return {
      selectedIds: ids,
      sizes: szs,
      totalSelected: total,
      sortedCategories: sorted,
      subInfoMap: subMap,
      catInfoMap: catMap,
      categorySummary: catSummary,
    };
  }, [scanSummary, debouncedQuery, sortBy]);

  // 清理成功后自动重新扫描
  const prevCleanResultRef = useRef(cleanResult);
  useEffect(() => {
    if (cleanResult && cleanResult !== prevCleanResultRef.current) {
      prevCleanResultRef.current = cleanResult;
      const timer = setTimeout(() => {
        void handleScan();
      }, 2000);
      return () => clearTimeout(timer);
    }
    prevCleanResultRef.current = cleanResult;
  }, [cleanResult]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleClean = useCallback(async () => {
    setConfirmOpen(false);
    try {
      await executeCleanAction(selectedIds, sizes);
      addToast({
        type: "success",
        message: `已释放 ${formatFileSize(totalSelected)}，清理 ${selectedIds.length} 个文件`,
      });
    } catch {
      addToast({ type: "error", message: "清理失败" });
    }
  }, [selectedIds, sizes, executeCleanAction, totalSelected, addToast]);

  const handleScan = useCallback(async () => {
    try {
      setExpanded(new Set());
      setSearchQuery("");
      await startScan();
      const summary = cacheGet<CleanScanSummary>(CACHE_KEY_CLEAN);
      if (summary) {
        const ids = new Set<string>();
        for (const cat of summary.categories) {
          for (const sub of cat.subcategories) {
            if (sub.results.some((r) => r.selected)) ids.add(sub.subcategoryId);
          }
        }
        setExpanded(ids);
      }
    } catch {
      addToast({ type: "error", message: "扫描失败" });
    }
  }, [startScan, addToast]);

  const smoothProgress = useSmoothProgress(
    (isScanning || isProcessing) ? (scanProgress?.progress ?? 0) : null,
  );

  const hasResults = sortedCategories.length > 0;

  const confirmDescription = useMemo(() => {
    const parts = [
      `将清理 ${selectedIds.length} 个文件，释放 ${formatFileSize(totalSelected)}。`,
    ];
    if (categorySummary.length > 0) {
      const detail = categorySummary
        .filter((c) => c.selectedCount > 0)
        .slice(0, 4)
        .map((c) => `${c.title} ${formatFileSize(c.selectedSize)}`)
        .join("、");
      parts.push(
        `包含：${detail}${categorySummary.length > 4 ? " 等" : ""}。`,
      );
    }
    parts.push("此操作不可撤销。");
    return parts.join(" ");
  }, [selectedIds.length, totalSelected, categorySummary]);

  /* ── 空闲态 — 使用通用组件 ── */
  if (!scanSummary && !isScanning && !isProcessing) {
    const cleanResultBanner = cleanResult ? (
      <div className="flex items-center gap-2.5 rounded-xl border border-green-200/60 bg-green-50/80 px-4 py-3 text-sm text-green-700 dark:border-green-800/60 dark:bg-green-900/20 dark:text-green-400 animate-fade-in">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          已释放 <strong>{formatFileSize(cleanResult.cleanedSize)}</strong>，清理{" "}
          {cleanResult.cleanedFileCount} 个文件
          {cleanResult.failedFileCount > 0 &&
            `，${cleanResult.failedFileCount} 个失败`}
        </span>
      </div>
    ) : null;

    return (
      <ScanIdleView
        icon={Trash2}
        title="垃圾清理"
        description="智能扫描系统缓存、应用残留、浏览器垃圾、AI 工具数据等，释放磁盘空间"
        onScan={handleScan}
        error={error}
        banner={cleanResultBanner}
      />
    );
  }

  /* ── 扫描中 / 清理中 — 使用通用组件 ── */
  if (isScanning || isProcessing) {
    return (
      <ScanProgressView
        progress={smoothProgress}
        centerContent={
          <span className="text-4xl font-bold gradient-text">
            {Math.round(smoothProgress * 100)}%
          </span>
        }
        centerLabel={isProcessing ? "清理中" : "扫描中"}
        description={
          scanProgress?.description ||
          (isProcessing ? "正在清理..." : "正在扫描...")
        }
        detail={
          scanProgress?.description && smoothProgress > 0 && smoothProgress < 1
            ? scanProgress.description
            : undefined
        }
        eta={eta || undefined}
        canStop={isScanning}
        onStop={() => void stopScan()}
        stopLabel="停止扫描"
        error={error}
      />
    );
  }

  /* ── 扫描结果列表 — 使用通用组件 ── */
  const cleanResultBanner = cleanResult ? (
    <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-green-200/60 bg-green-50/80 px-4 py-3 text-sm text-green-700 dark:border-green-800/60 dark:bg-green-900/20 dark:text-green-400 animate-fade-in">
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>
        已释放 <strong>{formatFileSize(cleanResult.cleanedSize)}</strong>，清理{" "}
        {cleanResult.cleanedFileCount} 个文件
        {cleanResult.failedFileCount > 0 &&
          `，${cleanResult.failedFileCount} 个失败`}
      </span>
    </div>
  ) : null;

  const statsBar = scanSummary ? (
    <>
      <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm dark:border-gray-700 dark:bg-gray-800/50 animate-fade-in-up">
        <div className="flex items-center gap-2">
          <HardDrive className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            可清理
          </span>
          <strong className="text-sm text-gray-900 dark:text-gray-100">
            {formatFileSize(scanSummary.totalSize)}
          </strong>
        </div>
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-indigo-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            已选
          </span>
          <strong className="text-sm text-indigo-600 dark:text-indigo-400">
            {formatFileSize(totalSelected)}
          </strong>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            ({selectedIds.length})
          </span>
        </div>
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {sortedCategories.length} 个分类
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">·</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {scanSummary.totalFileCount} 项
          </span>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="搜索文件名或路径..."
          maxWidthClass="max-w-xs"
        />
        <SortSelect
          value={sortBy}
          onChange={(v) => setSortBy(v as SortBy)}
          options={[
            { value: "size-desc", label: "按大小降序" },
            { value: "size-asc", label: "按大小升序" },
            { value: "name", label: "按名称" },
          ]}
        />
      </div>
    </>
  ) : null;

  const footer = scanSummary && hasResults ? (
    <div className="sticky bottom-0 mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-white/90 px-5 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/90 animate-fade-in-up">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500 dark:text-gray-400">已选</span>
        <strong className="text-indigo-600 dark:text-indigo-400">
          {formatFileSize(totalSelected)}
        </strong>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          ({selectedIds.length} 项)
        </span>
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-gray-500 dark:text-gray-400">
          可清理 {formatFileSize(scanSummary.totalSize)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={selectAllRecommended}>
          <CheckCheck className="h-3.5 w-3.5" />
          全选推荐
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={deselectAll}
          disabled={selectedIds.length === 0}
        >
          <Square className="h-3.5 w-3.5" />
          取消全选
        </Button>
        <Button
          variant="danger"
          disabled={selectedIds.length === 0}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          清理选中 ({selectedIds.length})
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <ScanResultLayout
      title="扫描结果"
      subtitle={`共 ${scanSummary?.totalFileCount ?? 0} 项可清理文件`}
      onRescan={handleScan}
      onReset={reset}
      error={error}
      banner={cleanResultBanner}
      statsBar={statsBar}
      footer={footer}
    >
      {/* 分类列表 */}
      <div className="space-y-3">
        {!scanSummary && (
          <EmptyState
            icon={Trash2}
            title="暂无扫描结果"
            description="点击上方按钮开始扫描"
          />
        )}

        {hasResults &&
          sortedCategories.map((category: CleanCategory) => {
            const Icon = CATEGORY_ICONS[category.categoryId] ?? HardDrive;
            const catTotal = categoryTotalSize(category);
            const catInfo = catInfoMap.get(category.categoryId)!;
            const isHot = catTotal > 1024 * 1024 * 100;
            const hasCatSelection = catInfo.selectedCount > 0;
            const hasSubcategories = category.subcategories.length > 0;
            const hasDirectResults = category.results.length > 0;
            const directExpandKey = `${category.categoryId}::direct`;

            return (
              <div
                key={category.categoryId}
                className={cn(
                  "overflow-hidden rounded-xl border bg-white shadow-sm transition-all dark:bg-gray-800/50 animate-fade-in-up",
                  hasCatSelection
                    ? "border-indigo-200/60 dark:border-indigo-800/40"
                    : "border-gray-100 dark:border-gray-700",
                )}
              >
                <div
                  className={cn(
                    "flex cursor-pointer items-center justify-between px-4 py-3 transition-colors",
                    "hover:bg-gray-50/80 dark:hover:bg-gray-700/20",
                    isHot &&
                      !hasCatSelection &&
                      "bg-orange-50/30 dark:bg-orange-900/10",
                  )}
                  onClick={() => toggleCategorySelection(category.categoryId)}
                >
                  <div className="flex items-center gap-3">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={catInfo.allSelected}
                        indeterminate={
                          !catInfo.allSelected &&
                          !catInfo.noneSelected &&
                          catInfo.selectedCount > 0
                        }
                        onChange={() =>
                          toggleCategorySelection(category.categoryId)
                        }
                      />
                    </div>
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg",
                        isHot
                          ? "bg-orange-50 dark:bg-orange-900/20"
                          : "bg-gray-50 dark:bg-gray-700/40",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4",
                          isHot
                            ? "text-orange-500"
                            : "text-gray-500 dark:text-gray-400",
                        )}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">
                          {category.title}
                        </h2>
                        {isHot && (
                          <span className="rounded bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                            热点
                          </span>
                        )}
                        {category.recommend && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-green-50 px-1 py-0.5 text-xs font-medium text-green-600 dark:bg-green-900/20 dark:text-green-400">
                            <ShieldCheck className="h-3 w-3" />
                            推荐
                          </span>
                        )}
                        {category.cautious && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-amber-50 px-1 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-900/20 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            谨慎
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {hasCatSelection
                          ? `已选 ${formatFileSize(catInfo.selectedSize)} / ${formatFileSize(catTotal)}`
                          : `${catInfo.totalItems} 项 · ${category.tips}`}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-bold",
                      hasCatSelection
                        ? "text-indigo-600 dark:text-indigo-400"
                        : "text-gray-600 dark:text-gray-300",
                    )}
                  >
                    {formatFileSize(catTotal)}
                  </span>
                </div>

                {hasSubcategories && (
                  <div className="space-y-1 border-t border-gray-100 px-3 py-2 dark:border-gray-700/30">
                    {category.subcategories.map((sub: CleanSubcategory) => (
                      <SubcategoryRow
                        key={sub.subcategoryId}
                        sub={sub}
                        isExpanded={expanded.has(sub.subcategoryId)}
                        info={subInfoMap.get(sub.subcategoryId)!}
                        onToggle={toggle}
                        onToggleSub={toggleSubcategorySelection}
                        onToggleItem={toggleItemSelection}
                      />
                    ))}
                  </div>
                )}

                {hasDirectResults && (
                  <div className="border-t border-gray-100 px-3 py-2 dark:border-gray-700/30">
                    <DirectResultsSection
                      results={category.results}
                      isExpanded={expanded.has(directExpandKey)}
                      onToggleExpand={() => toggle(directExpandKey)}
                      onToggleItem={toggleItemSelection}
                    />
                  </div>
                )}
              </div>
            );
          })}

        {scanSummary && !hasResults && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CheckCircle2 className="mb-3 h-12 w-12 text-green-400" />
            <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">
              {searchQuery ? "未找到匹配结果" : "系统很干净！"}
            </p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {searchQuery ? "尝试更换搜索关键词" : "未发现可清理的垃圾文件"}
            </p>
          </div>
        )}
      </div>

      {/* 确认对话框 */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleClean}
        loading={isProcessing}
        title="确认清理"
        description={confirmDescription}
        confirmLabel="确认清理"
        danger
      />
    </ScanResultLayout>
  );
}

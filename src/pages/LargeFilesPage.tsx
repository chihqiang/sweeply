import { useState, useCallback, useMemo, memo } from "react";
import {
  useToast,
  Button,
  EmptyState,
  Dialog,
  Checkbox,
  SearchInput,
  SortSelect,
  ScanIdleView,
  ScanProgressView,
  ScanResultLayout,
} from "@/components/ui";
import { scanLargeFiles, stopLargeFileScan, deleteLargeFiles, openFileLocation } from "@/services/largeFileService";
import type { LargeFile, LargeFileProgress } from "@/types/largeFiles";
import { FileSearch, FolderOpen, Play, Trash2, File, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { formatFileSize } from "@/utils/format";
import { cn } from "@/utils/cn";

const THRESHOLDS = [
  { label: "50 MB", value: 50 },
  { label: "100 MB", value: 100 },
  { label: "500 MB", value: 500 },
  { label: "1 GB", value: 1000 },
];

type SortBy = "size-desc" | "size-asc" | "name" | "date-desc";

/** 大小阈值选择器 */
const SizeThresholdSelector = memo(function SizeThresholdSelector({
  minSize,
  setMinSize,
}: {
  minSize: number;
  setMinSize: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm dark:border-gray-600 dark:bg-gray-800/50">
      <span className="text-gray-500">大于</span>
      {THRESHOLDS.map((t) => (
        <button
          key={t.value}
          onClick={() => setMinSize(t.value)}
          className={cn(
            "rounded-md px-2 py-0.5 text-xs font-medium transition-colors",
            minSize === t.value
              ? "bg-indigo-500 text-white"
              : "text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
});

/** 文件行 */
const LargeFileRow = memo(function LargeFileRow({
  file, isSelected, onToggle, onLocate,
}: {
  file: LargeFile;
  isSelected: boolean;
  onToggle: (path: string) => void;
  onLocate: (path: string) => void;
}) {
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
        "hover:bg-gray-50 dark:hover:bg-gray-700/30",
        isSelected && "bg-indigo-50/50 dark:bg-indigo-900/15",
      )}
      onClick={() => onToggle(file.path)}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={isSelected} onChange={() => onToggle(file.path)} />
      </div>
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
        isSelected ? "bg-indigo-100 dark:bg-indigo-900/30" : "bg-gray-100 dark:bg-gray-700/50",
      )}>
        <File className={cn("h-4 w-4", isSelected ? "text-indigo-500" : "text-gray-400")} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-gray-700 dark:text-gray-200" title={file.path}>{file.name}</p>
        <p className="truncate text-xs text-gray-500 dark:text-gray-400" title={file.path}>{file.path.replace(/\/Users\/[\w]+/, "~")}</p>
      </div>
      <span className="hidden shrink-0 text-xs text-gray-400 sm:block">{file.modified}</span>
      <span className={cn(
        "shrink-0 text-[13px] font-medium",
        isSelected ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-400",
      )}>{formatFileSize(file.size)}</span>
      <button
        onClick={(e) => { e.stopPropagation(); onLocate(file.path); }}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        title="在访达中显示"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </button>
    </div>
  );
});

export default function LargeFilesPage() {
  const [scanPath, setScanPath] = useState("");
  const [minSize, setMinSize] = useState(100);
  const [files, setFiles] = useState<LargeFile[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<LargeFileProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("size-desc");
  const [collapsedExts, setCollapsedExts] = useState<Set<string>>(new Set());
  const { addToast } = useToast();

  const handleSelectPath = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: false, directory: true, title: "选择扫描目录" });
      if (selected) setScanPath(selected as string);
    } catch (e) {
      addToast({ type: "error", message: `选择目录失败: ${e}` });
    }
  }, [addToast]);

  const handleScan = useCallback(async () => {
    if (!scanPath) {
      addToast({ type: "info", message: "请先选择扫描目录" });
      return;
    }
    setScanning(true);
    setError(null);
    setFiles([]);
    setSelectedPaths(new Set());
    setSearchQuery("");
    setProgress({ scanned: 0, found: 0, currentPath: "" });
    try {
      const result = await scanLargeFiles(scanPath, minSize, (p) => setProgress(p));
      setFiles(result);
      addToast({ type: "success", message: `扫描完成，找到 ${result.length} 个大文件` });
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
      setProgress(null);
    }
  }, [scanPath, minSize, addToast]);

  const handleStop = useCallback(async () => {
    try { await stopLargeFileScan(); } catch { /* ignore */ }
    setScanning(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (selectedPaths.size === 0) return;
    setConfirmOpen(false);
    setDeleting(true);
    try {
      const failed = await deleteLargeFiles(Array.from(selectedPaths));
      const deleted = selectedPaths.size - failed.length;
      if (deleted > 0) {
        addToast({ type: "success", message: `已删除 ${deleted} 个文件` });
        setFiles((prev) => prev.filter((f) => !selectedPaths.has(f.path)));
        setSelectedPaths(new Set());
      }
      if (failed.length > 0) addToast({ type: "error", message: `${failed.length} 个文件删除失败` });
    } catch (e) {
      addToast({ type: "error", message: `删除失败: ${e}` });
    } finally {
      setDeleting(false);
    }
  }, [selectedPaths, addToast]);

  const toggleFile = useCallback((path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  const toggleExt = useCallback((ext: string) => {
    setCollapsedExts((prev) => {
      const next = new Set(prev);
      if (next.has(ext)) next.delete(ext); else next.add(ext);
      return next;
    });
  }, []);

  const handleSelectAllInExt = useCallback((_ext: string, filePaths: string[]) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      const allSelected = filePaths.every((p) => next.has(p));
      if (allSelected) {
        filePaths.forEach((p) => next.delete(p));
      } else {
        filePaths.forEach((p) => next.add(p));
      }
      return next;
    });
  }, []);

  const handleLocate = useCallback((path: string) => {
    openFileLocation(path);
  }, []);

  // 搜索 + 排序 + 按扩展名分组
  const { groupedFiles, totalSize, selectedSize } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let filtered = files;
    if (q) {
      filtered = files.filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q));
    }

    const sorted = [...filtered];
    if (sortBy === "size-desc") sorted.sort((a, b) => b.size - a.size);
    else if (sortBy === "size-asc") sorted.sort((a, b) => a.size - b.size);
    else if (sortBy === "name") sorted.sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
    else if (sortBy === "date-desc") sorted.sort((a, b) => (b.modified || "").localeCompare(a.modified || ""));

    const groups = new Map<string, LargeFile[]>();
    for (const f of sorted) {
      const ext = f.extension || "other";
      if (!groups.has(ext)) groups.set(ext, []);
      groups.get(ext)!.push(f);
    }
    // 按组总大小降序
    const sortedGroups = [...groups.entries()].sort((a, b) => {
      const sa = a[1].reduce((s, f) => s + f.size, 0);
      const sb = b[1].reduce((s, f) => s + f.size, 0);
      return sb - sa;
    });

    const ts = files.reduce((s, f) => s + f.size, 0);
    const ss = [...selectedPaths].reduce((s, p) => {
      const f = files.find((f) => f.path === p);
      return s + (f?.size ?? 0);
    }, 0);

    return { groupedFiles: sortedGroups, totalSize: ts, selectedSize: ss };
  }, [files, searchQuery, sortBy, selectedPaths]);

  const hasResults = groupedFiles.length > 0;

  /* ── 空闲态 — 使用通用组件 ── */
  if (files.length === 0 && !scanning) {
    return (
      <ScanIdleView
        icon={FileSearch}
        title="大文件查找"
        description="扫描目录中超过指定大小的大文件，快速定位或清理"
        onScan={handleScan}
        scanLabel="开始扫描"
        scanIcon={Play}
        error={error}
      >
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSelectPath}>
            <FolderOpen className="h-4 w-4" />
            {scanPath ? scanPath.replace(/\/Users\/[\w]+/, "~") : "选择目录"}
          </Button>
          <SizeThresholdSelector minSize={minSize} setMinSize={setMinSize} />
        </div>
      </ScanIdleView>
    );
  }

  /* ── 扫描中 — 使用通用组件 ── */
  if (scanning) {
    const progressValue = progress && files.length > 0 ? 0.8 : 0.3;
    return (
      <ScanProgressView
        progress={progressValue}
        centerContent={
          <span className="text-4xl font-bold gradient-text">
            {progress?.found ?? 0}
          </span>
        }
        centerLabel="个大文件"
        description={`已扫描 ${progress?.scanned ?? 0} 个文件`}
        detail={progress?.currentPath || undefined}
        onStop={handleStop}
        error={error}
      />
    );
  }

  /* ── 结果列表 — 使用通用组件 ── */
  const statsBar = files.length > 0 ? (
    <div className="mb-4 grid grid-cols-3 gap-4 animate-fade-in-up">
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm dark:border-gray-700/30 dark:bg-gray-800/50">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{files.length}</p>
        <p className="text-xs text-gray-400">大文件</p>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm dark:border-gray-700/30 dark:bg-gray-800/50">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatFileSize(totalSize)}</p>
        <p className="text-xs text-gray-400">总大小</p>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm dark:border-gray-700/30 dark:bg-gray-800/50">
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatFileSize(selectedSize)}</p>
        <p className="text-xs text-gray-400">已选可释放</p>
      </div>
    </div>
  ) : null;

  const toolbar = files.length > 0 ? (
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
          { value: "date-desc", label: "按修改时间" },
        ]}
      />
    </div>
  ) : null;

  const footer = files.length > 0 ? (
    <div className="sticky bottom-0 mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-white/90 px-5 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/90 animate-fade-in-up">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500 dark:text-gray-400">已选</span>
        <strong className="text-indigo-600 dark:text-indigo-400">{formatFileSize(selectedSize)}</strong>
        <span className="text-xs text-gray-500 dark:text-gray-400">({selectedPaths.size} 项)</span>
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-gray-500 dark:text-gray-400">总计 {formatFileSize(totalSize)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => setSelectedPaths(new Set())} disabled={selectedPaths.size === 0}>
          取消全选
        </Button>
        <Button variant="danger" disabled={selectedPaths.size === 0} onClick={() => setConfirmOpen(true)} loading={deleting}>
          <Trash2 className="h-4 w-4" />
          删除选中 ({selectedPaths.size})
        </Button>
      </div>
    </div>
  ) : null;

  return (
    <ScanResultLayout
      title="扫描结果"
      subtitle={`共 ${files.length} 个大文件`}
      onRescan={handleScan}
      rescanLabel="重新扫描"
      statsBar={statsBar}
      toolbar={toolbar}
      footer={footer}
    >
      {/* 配置 */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={handleSelectPath}>
          <FolderOpen className="h-4 w-4" />
          {scanPath ? scanPath.replace(/\/Users\/[\w]+/, "~") : "选择目录"}
        </Button>
        <SizeThresholdSelector minSize={minSize} setMinSize={setMinSize} />
      </div>

      {/* 文件列表 */}
      {!hasResults ? (
        <EmptyState icon={FileSearch} title="未找到大文件" description="尝试降低大小阈值或更换目录" />
      ) : (
        <div className="space-y-3">
          {groupedFiles.map(([ext, extFiles]) => {
            const isCollapsed = collapsedExts.has(ext);
            const groupSize = extFiles.reduce((s, f) => s + f.size, 0);
            const groupSelectedCount = extFiles.filter((f) => selectedPaths.has(f.path)).length;
            const allSelected = extFiles.length > 0 && extFiles.every((f) => selectedPaths.has(f.path));
            const noneSelected = groupSelectedCount === 0;
            const hasSelection = groupSelectedCount > 0;

            return (
              <div
                key={ext}
                className={cn(
                  "overflow-hidden rounded-xl border bg-white shadow-sm transition-all dark:bg-gray-800/50 animate-fade-in-up",
                  hasSelection ? "border-indigo-200/60 dark:border-indigo-800/40" : "border-gray-100 dark:border-gray-700",
                )}
              >
                {/* 分组头 */}
                <div
                  className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-700/20"
                  onClick={() => toggleExt(ext)}
                >
                  <div className="flex items-center gap-3">
                    <div onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={allSelected}
                        indeterminate={!allSelected && !noneSelected && hasSelection}
                        onChange={() => handleSelectAllInExt(ext, extFiles.map((f) => f.path))}
                      />
                    </div>
                    {isCollapsed
                      ? <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                      : <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
                    <span className="text-sm font-bold uppercase text-gray-900 dark:text-gray-100">.{ext}</span>
                    <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-500 dark:bg-gray-700 dark:text-gray-400">{extFiles.length}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {hasSelection && (
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {formatFileSize(groupSize * (groupSelectedCount / extFiles.length))}
                      </span>
                    )}
                    <span className={cn("font-bold", hasSelection ? "text-gray-400" : "text-gray-600 dark:text-gray-300")}>
                      {formatFileSize(groupSize)}
                    </span>
                  </div>
                </div>

                {/* 文件列表 */}
                {!isCollapsed && (
                  <div className="space-y-0.5 border-t border-gray-100 px-3 py-2 dark:border-gray-700/30">
                    {extFiles.map((file) => (
                      <LargeFileRow
                        key={file.path}
                        file={file}
                        isSelected={selectedPaths.has(file.path)}
                        onToggle={toggleFile}
                        onLocate={handleLocate}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {hasResults && groupedFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FileSearch className="mb-3 h-12 w-12 text-gray-300" />
              <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">未找到匹配结果</p>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">尝试更换搜索关键词</p>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="删除确认"
        description={`确定要删除选中的 ${selectedPaths.size} 个文件吗？此操作将文件移至废纸篓。`}
        confirmLabel="删除"
        danger
      />
    </ScanResultLayout>
  );
}

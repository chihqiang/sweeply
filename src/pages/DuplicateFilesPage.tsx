import { useState, useCallback, useRef, useMemo, memo } from "react";
import {
  useToast,
  Button,
  Dialog,
  Checkbox,
  ScanIdleView,
  ScanProgressView,
  ScanResultLayout,
} from "@/components/ui";
import { scanDuplicates, stopDuplicateScan, deleteDuplicateFiles } from "@/services/duplicateFileService";
import type { DuplicateGroup, DuplicateProgress, DuplicateFile } from "@/types/duplicateFiles";
import { Copy, Play, Trash2, AlertCircle, File, Wand2, FolderPlus } from "lucide-react";
import { formatFileSize } from "@/utils/format";
import { cn } from "@/utils/cn";

/** 重复文件行 */
const DuplicateFileRow = memo(function DuplicateFileRow({
  file, isSelected, onToggle, isRecommended,
}: {
  file: DuplicateFile;
  isSelected: boolean;
  onToggle: (path: string) => void;
  isRecommended: boolean;
}) {
  return (
    <div
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors",
        "hover:bg-gray-50 dark:hover:bg-gray-700/30",
        isSelected && "bg-indigo-50/50 dark:bg-indigo-900/15",
      )}
      onClick={() => onToggle(file.path)}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Checkbox checked={isSelected} onChange={() => onToggle(file.path)} />
      </div>
      <File className={cn("h-3.5 w-3.5 shrink-0", isSelected ? "text-indigo-400" : "text-gray-400")} />
      <span className="min-w-0 truncate text-gray-700 dark:text-gray-300" title={file.path}>
        {file.name}
      </span>
      {isRecommended && !isSelected && (
        <span className="shrink-0 rounded bg-indigo-50 px-1 py-0.5 text-[10px] font-medium text-indigo-500 dark:bg-indigo-900/20 dark:text-indigo-400">
          建议删除
        </span>
      )}
      <span className="shrink-0 text-gray-400">{file.modified}</span>
      <span className="shrink-0 truncate text-gray-300 dark:text-gray-600" style={{ maxWidth: 200 }} title={file.path}>
        {file.path.replace(/^\/Users\/[\w]+/, "~")}
      </span>
    </div>
  );
});

/** 扫描路径标签列表 */
const ScanPathTags = memo(function ScanPathTags({
  scanPaths,
  onRemove,
}: {
  scanPaths: string[];
  onRemove: (path: string) => void;
}) {
  if (scanPaths.length === 0) {
    return (
      <p className="text-xs text-gray-400">未指定目录，默认扫描 Desktop、Downloads、Documents、Pictures</p>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {scanPaths.map((p) => (
        <span key={p} className="inline-flex items-center gap-1 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600 dark:bg-gray-700/40 dark:text-gray-300">
          <File className="h-3 w-3" />
          {p.replace(/^\/Users\/[\w]+/, "~")}
          <button onClick={() => onRemove(p)} className="ml-0.5 text-gray-400 hover:text-red-500">&times;</button>
        </span>
      ))}
    </div>
  );
});

export default function DuplicateFilesPage() {
  const [scanPaths, setScanPaths] = useState<string[]>([]);
  const [groups, setGroups] = useState<DuplicateGroup[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<DuplicateProgress | null>(null);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);
  const { addToast } = useToast();

  const handleAddPath = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: false, directory: true, title: "选择扫描目录" });
      if (selected) {
        setScanPaths((prev) => prev.includes(selected as string) ? prev : [...prev, selected as string]);
      }
    } catch (e) {
      addToast({ type: "error", message: `选择目录失败: ${e}` });
    }
  }, [addToast]);

  const removePath = useCallback((path: string) => {
    setScanPaths((prev) => prev.filter((p) => p !== path));
  }, []);

  const handleScan = useCallback(async () => {
    let paths = scanPaths;
    if (paths.length === 0) {
      try {
        const { downloadDir } = await import("@tauri-apps/api/path");
        paths = [await downloadDir()];
      } catch {
        paths = [];
      }
      if (paths.length === 0) {
        addToast({ type: "info", message: "请先添加扫描目录" });
        return;
      }
    }
    setScanning(true);
    setError(null);
    setGroups([]);
    setSelectedPaths(new Set());
    setProgress({ phase: "准备扫描...", current: 0, total: 0, currentPath: "" });

    const ctrl = new AbortController();
    abortRef.current = ctrl;

    try {
      const result = await scanDuplicates(paths, (p) => setProgress(p), ctrl.signal);
      setGroups(result);

      // 智能预选：每组自动选中除最新文件外的所有副本
      const autoSelected = new Set<string>();
      for (const group of result) {
        // 按修改时间降序排列，保留最新的一个
        const sorted = [...group.files].sort((a, b) => (b.modified || "").localeCompare(a.modified || ""));
        // 保留第一个（最新），其余选中
        for (let i = 1; i < sorted.length; i++) {
          autoSelected.add(sorted[i].path);
        }
      }
      setSelectedPaths(autoSelected);

      if (result.length > 0) {
        addToast({ type: "success", message: `找到 ${result.length} 组重复文件，已智能预选` });
      } else {
        addToast({ type: "info", message: "未发现重复文件" });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
      setProgress(null);
      abortRef.current = null;
    }
  }, [scanPaths, addToast]);

  const handleStop = useCallback(async () => {
    try {
      await stopDuplicateScan();
      abortRef.current?.abort();
    } catch { /* ignore */ }
  }, []);

  const handleDelete = useCallback(async () => {
    if (selectedPaths.size === 0) return;
    setConfirmOpen(false);
    setDeleting(true);
    try {
      const failed = await deleteDuplicateFiles(Array.from(selectedPaths));
      const deletedCount = selectedPaths.size - failed.length;
      if (deletedCount > 0) {
        addToast({ type: "success", message: `已删除 ${deletedCount} 个重复文件` });
        setGroups((prev) => {
          const updated = prev.map((g) => ({
            ...g,
            files: g.files.filter((f) => !selectedPaths.has(f.path)),
          })).filter((g) => g.files.length > 1);
          return updated;
        });
        setSelectedPaths(new Set());
      }
      if (failed.length > 0) {
        addToast({ type: "error", message: `${failed.length} 个文件删除失败` });
      }
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

  const toggleGroup = useCallback((_groupHash: string, filePaths: string[]) => {
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

  const toggleCollapse = useCallback((hash: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(hash)) next.delete(hash); else next.add(hash);
      return next;
    });
  }, []);

  // 智能预选：保留每组最新文件，选中其余
  const handleAutoSelect = useCallback(() => {
    const autoSelected = new Set<string>();
    for (const group of groups) {
      const sorted = [...group.files].sort((a, b) => (b.modified || "").localeCompare(a.modified || ""));
      for (let i = 1; i < sorted.length; i++) {
        autoSelected.add(sorted[i].path);
      }
    }
    setSelectedPaths(autoSelected);
    addToast({ type: "info", message: "已智能预选：每组保留最新文件" });
  }, [groups, addToast]);

  const totalDupSize = useMemo(() => groups.reduce((s, g) => s + g.size * (g.files.length - 1), 0), [groups]);
  const totalDupFiles = useMemo(() => groups.reduce((s, g) => s + g.files.length - 1, 0), [groups]);
  const selectedSize = useMemo(() => {
    return groups.reduce((s, g) => s + g.files.filter((f) => selectedPaths.has(f.path)).reduce((fs) => fs + g.size, 0), 0);
  }, [groups, selectedPaths]);

  /* ── 空闲态 — 使用通用组件 ── */
  if (groups.length === 0 && !scanning) {
    return (
      <ScanIdleView
        icon={Copy}
        title="重复文件查找"
        description="按大小和哈希找出重复文件，安全释放磁盘空间"
        onScan={handleScan}
        scanLabel="开始扫描"
        scanIcon={Play}
        onIconClick={handleAddPath}
        iconTooltip={scanPaths.length > 0 ? `${scanPaths.length} 个已选目录` : "点击添加扫描目录"}
        error={error}
      >
        <ScanPathTags scanPaths={scanPaths} onRemove={removePath} />
      </ScanIdleView>
    );
  }

  /* ── 扫描中 — 使用通用组件 ── */
  if (scanning) {
    const progressValue = progress && progress.total > 0 ? progress.current / progress.total : 0.3;
    const countDetail = progress && progress.total > 0
      ? `${progress.current} / ${progress.total}`
      : undefined;
    return (
      <ScanProgressView
        progress={progressValue}
        centerContent={
          <span className="text-4xl font-bold gradient-text">
            {progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0}%
          </span>
        }
        centerLabel="扫描中"
        description={progress?.phase || "正在扫描..."}
        detail={progress?.currentPath || countDetail}
        onStop={handleStop}
        error={error}
      />
    );
  }

  /* ── 结果列表 — 使用通用组件 ── */
  const statsBar = groups.length > 0 ? (
    <div className="mb-4 grid grid-cols-3 gap-4 animate-fade-in-up">
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm dark:border-gray-700/30 dark:bg-gray-800/50">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{groups.length}</p>
        <p className="text-xs text-gray-400">重复组</p>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm dark:border-gray-700/30 dark:bg-gray-800/50">
        <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalDupFiles}</p>
        <p className="text-xs text-gray-400">可清理文件</p>
      </div>
      <div className="rounded-xl border border-gray-100 bg-white p-4 text-center shadow-sm dark:border-gray-700/30 dark:bg-gray-800/50">
        <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatFileSize(totalDupSize)}</p>
        <p className="text-xs text-gray-400">可释放空间</p>
      </div>
    </div>
  ) : null;

  const footer = groups.length > 0 ? (
    <div className="sticky bottom-0 mt-4 flex items-center justify-between rounded-xl border border-gray-100 bg-white/90 px-5 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-gray-700 dark:bg-gray-800/90 animate-fade-in-up">
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-500 dark:text-gray-400">已选</span>
        <strong className="text-indigo-600 dark:text-indigo-400">{selectedPaths.size}</strong>
        <span className="text-xs text-gray-500 dark:text-gray-400">个文件</span>
        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
        <span className="text-xs text-gray-500 dark:text-gray-400">可释放 {formatFileSize(selectedSize)}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleAutoSelect}>
          <Wand2 className="h-3.5 w-3.5" />
          智能预选
        </Button>
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
      subtitle={`共 ${groups.length} 组重复文件`}
      onRescan={handleScan}
      rescanLabel="重新扫描"
      maxWidth="3xl"
      statsBar={statsBar}
      footer={footer}
    >
      {/* 扫描路径 */}
      <div className="mb-5 rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700/30 dark:bg-gray-800/50">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">扫描目录</p>
          <Button variant="outline" size="icon" onClick={handleAddPath} title="添加目录" disabled={scanning}>
            <FolderPlus className="h-4 w-4" />
          </Button>
        </div>
        <ScanPathTags scanPaths={scanPaths} onRemove={removePath} />
      </div>

      {/* 重复文件组列表 */}
      <div className="space-y-3">
        {groups.map((group) => {
          const selectedCount = group.files.filter((f) => selectedPaths.has(f.path)).length;
          const keepCount = group.files.length - 1;
          const isCollapsed = collapsedGroups.has(group.hash);
          const allSelected = group.files.length > 0 && group.files.every((f) => selectedPaths.has(f.path));
          const noneSelected = selectedCount === 0;
          const hasSelection = selectedCount > 0;

          // 找出该组中最新文件（不应被推荐删除）
          const sortedByDate = [...group.files].sort((a, b) => (b.modified || "").localeCompare(a.modified || ""));
          const newestPath = sortedByDate[0]?.path;

          return (
            <div
              key={group.hash}
              className={cn(
                "overflow-hidden rounded-xl border bg-white shadow-sm transition-all dark:bg-gray-800/50 animate-fade-in-up",
                hasSelection ? "border-indigo-200/60 dark:border-indigo-800/40" : "border-gray-100 dark:border-gray-700",
              )}
            >
              {/* 分组头 */}
              <div
                className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-700/20"
                onClick={() => toggleCollapse(group.hash)}
              >
                <div className="flex items-center gap-3">
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={!allSelected && !noneSelected && hasSelection}
                      onChange={() => toggleGroup(group.hash, group.files.map((f) => f.path))}
                    />
                  </div>
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gray-50 dark:bg-gray-700/40">
                    <Copy className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatFileSize(group.size)}</span>
                  <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[11px] text-orange-600 dark:bg-orange-900/20 dark:text-orange-400">{group.files.length} 个副本</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  {hasSelection && (
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      已选 {selectedCount}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">保留 1 个，可清理 {keepCount} 个</span>
                </div>
              </div>

              {/* 文件列表 */}
              {!isCollapsed && (
                <div className="space-y-0.5 border-t border-gray-100 px-3 py-2 dark:border-gray-700/30">
                  {group.files.map((file) => (
                    <DuplicateFileRow
                      key={file.path}
                      file={file}
                      isSelected={selectedPaths.has(file.path)}
                      onToggle={toggleFile}
                      isRecommended={file.path !== newestPath}
                    />
                  ))}
                </div>
              )}

              {selectedCount > 0 && selectedCount >= group.files.length && (
                <div className="flex items-center gap-1 border-t border-gray-100 px-4 py-2 text-xs text-amber-500 dark:border-gray-700/30">
                  <AlertCircle className="h-3 w-3" />
                  注意：全部文件已选中，删除后将无法恢复该文件
                </div>
              )}
            </div>
          );
        })}
      </div>

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="删除确认"
        description={`确定要删除选中的 ${selectedPaths.size} 个重复文件吗？此操作将文件移至废纸篓。`}
        confirmLabel="删除"
        danger
      />
    </ScanResultLayout>
  );
}

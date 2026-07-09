import { useState, useCallback, useMemo } from "react";
import {
  useToast,
  Button,
  EmptyState,
  ScanIdleView,
  ScanProgressView,
  ScanResultLayout,
} from "@/components/ui";
import { scanDiskUsage, scanDiskUsageDetail, stopDiskScan } from "@/services/diskUsageService";
import type { DiskItem, DiskUsageProgress } from "@/types/diskUsage";
import { HardDrive, FolderOpen, ArrowLeft, Play, File, Folder } from "lucide-react";
import { formatFileSize } from "@/utils/format";
import { cn } from "@/utils/cn";

const COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-cyan-500", "bg-pink-500", "bg-lime-500",
  "bg-indigo-500", "bg-orange-500", "bg-teal-500", "bg-red-500",
];

/** 简化路径显示，统一为 ~/path 格式 */
function shortenPath(path: string): string {
  return path.replace(/^\/Users\/[^/]+/, "~");
}

function Treemap({ items, onItemClick }: { items: DiskItem[]; onItemClick: (item: DiskItem) => void }) {
  const total = items.reduce((s, i) => s + i.size, 0);
  if (total === 0) return null;

  const minSize = total * 0.01; // < 1% 的不显示在树图中

  return (
    <div className="flex h-64 w-full gap-0.5 overflow-hidden rounded-xl bg-gray-50 dark:bg-gray-700/20">
      {items.filter((i) => i.size >= minSize).map((item, idx) => {
        const pct = (item.size / total) * 100;
        return (
          <button
            key={item.path}
            onClick={() => onItemClick(item)}
            className={cn(
              "relative flex shrink-0 cursor-pointer flex-col items-center justify-center overflow-hidden text-xs text-white/90 transition-all hover:brightness-110",
              COLORS[idx % COLORS.length],
            )}
            style={{ width: `${pct}%` }}
            title={`${item.name}\n${formatFileSize(item.size)} (${pct.toFixed(1)}%)`}
          >
            {pct > 5 && (
              <>
                <span className="truncate px-1 font-medium drop-shadow-sm">{item.name}</span>
                <span className="mt-0.5 drop-shadow-sm opacity-80">{formatFileSize(item.size)}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default function DiskUsagePage() {
  const [scanPath, setScanPath] = useState("");
  const [items, setItems] = useState<DiskItem[]>([]);
  const [detail, setDetail] = useState<DiskItem | null>(null);
  const [history, setHistory] = useState<DiskItem[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState<DiskUsageProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  const handleSelectPath = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({ multiple: false, directory: true, title: "选择分析目录" });
      if (selected) {
        setScanPath(selected as string);
      }
    } catch (e) {
      addToast({ type: "error", message: `选择目录失败: ${e}` });
    }
  }, [addToast]);

  const handleScan = useCallback(async () => {
    if (!scanPath) {
      addToast({ type: "info", message: "请先选择要分析的目录" });
      return;
    }
    setScanning(true);
    setError(null);
    setItems([]);
    setDetail(null);
    setHistory([]);
    setProgress({ current: 0, total: 0, currentPath: "" });
    try {
      const result = await scanDiskUsage(scanPath, (p) => setProgress(p));
      setItems(result);
      addToast({ type: "success", message: `扫描完成，共 ${result.length} 个条目` });
    } catch (e) {
      setError(String(e));
    } finally {
      setScanning(false);
      setProgress(null);
    }
  }, [scanPath, addToast]);

  const handleStop = useCallback(async () => {
    try { await stopDiskScan(); } catch { /* ignore */ }
    setScanning(false);
    setProgress(null);
  }, []);

  const handleItemClick = useCallback(async (item: DiskItem) => {
    if (item.fileCount === 1 && item.children.length === 0) return;
    setHistory((prev) => [...prev, item]);
    setDetail(null);
    try {
      const result = await scanDiskUsageDetail(item.path);
      setDetail(result);
    } catch (e) {
      addToast({ type: "error", message: `读取失败: ${e}` });
    }
  }, [addToast]);

  const handleBack = useCallback(() => {
    const prev = [...history];
    prev.pop();
    setHistory(prev);
    if (prev.length === 0) {
      setDetail(null);
    } else {
      handleItemClick(prev[prev.length - 1]);
    }
  }, [history, handleItemClick]);

  const displayItems = detail ? detail.children : items;
  const totalSize = detail ? detail.size : items.reduce((s, i) => s + i.size, 0);
  const currentLabel = history.length > 0 ? history[history.length - 1].name : (scanPath ? scanPath.split("/").pop() || "" : "");
  const progressPct = useMemo(() => {
    if (!progress) return 0;
    if (progress.total && progress.total > 0) return progress.current / progress.total;
    return 0; // 无 total 时不显示百分比
  }, [progress]);

  /* ── 空闲态 — 使用通用组件 ── */
  if (items.length === 0 && !scanning) {
    return (
      <ScanIdleView
        icon={HardDrive}
        title="磁盘空间分析"
        description="可视化展示磁盘使用分布，快速定位大文件"
        onScan={handleScan}
        scanLabel="开始分析"
        scanIcon={Play}
        error={error}
      >
        <Button variant="outline" onClick={handleSelectPath}>
          <FolderOpen className="h-4 w-4" />
          {scanPath ? shortenPath(scanPath) : "选择目录"}
        </Button>
      </ScanIdleView>
    );
  }

  /* ── 扫描中 — 使用通用组件 ── */
  if (scanning) {
    const countDetail = progress
      ? progress.total && progress.total > 0
        ? `${progress.current} / ${progress.total}`
        : `已处理 ${progress.current} 项`
      : undefined;
    return (
      <ScanProgressView
        progress={progressPct > 0 ? progressPct : 0.3}
        centerContent={
          <span className="text-4xl font-bold gradient-text">
            {progressPct > 0 ? Math.round(progressPct * 100) : "..."}
          </span>
        }
        centerLabel="分析中"
        description={countDetail || "正在扫描文件..."}
        detail={progress?.currentPath || undefined}
        onStop={handleStop}
        error={error}
      />
    );
  }

  /* ── 结果展示 — 使用通用组件 ── */
  return (
    <ScanResultLayout
      title="扫描结果"
      subtitle={`${items.length} 个目录 · ${formatFileSize(totalSize)}`}
      onRescan={handleScan}
      rescanLabel="重新分析"
    >
      {/* 路径选择 */}
      <div className="mb-5 flex items-center gap-3">
        <Button variant="outline" onClick={handleSelectPath}>
          <FolderOpen className="h-4 w-4" />
          {scanPath ? shortenPath(scanPath) : "选择目录"}
        </Button>
      </div>

      {/* 面包屑 */}
      {history.length > 0 && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <button onClick={handleBack} className="flex items-center gap-1 text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300">
            <ArrowLeft className="h-3.5 w-3.5" />返回
          </button>
          <span className="text-gray-300">/</span>
          <span className="font-medium text-gray-700 dark:text-gray-200">{currentLabel}</span>
          <span className="text-xs text-gray-400">{formatFileSize(totalSize)}</span>
        </div>
      )}

      {/* 树图 */}
      {displayItems.length > 0 && (
        <div className="mb-6">
          <Treemap items={displayItems} onItemClick={handleItemClick} />
        </div>
      )}

      {/* 列表 */}
      {displayItems.length > 0 ? (
        <div className="rounded-xl border border-gray-100 bg-white dark:border-gray-700/30 dark:bg-gray-800/50">
          <div className="border-b border-gray-50 px-5 py-3 text-xs font-medium text-gray-400 dark:border-gray-700/20">
            <div className="flex items-center gap-4">
              <span className="flex-1">名称</span>
              <span className="w-24 text-right">大小</span>
              <span className="w-16 text-right">占比</span>
            </div>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700/20">
            {displayItems.map((item, idx) => {
              const pct = totalSize > 0 ? (item.size / totalSize) * 100 : 0;
              const barColor = COLORS[idx % COLORS.length];
              return (
                <button
                  key={item.path}
                  onClick={() => handleItemClick(item)}
                  className="flex w-full items-center gap-4 px-5 py-3 text-left text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/30"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-700/40">
                    {item.fileCount === 1 && item.children.length === 0 ? (
                      <File className="h-4 w-4" />
                    ) : (
                      <Folder className="h-4 w-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-gray-800 dark:text-gray-200">{item.name}</p>
                    <p className="text-xs text-gray-400">{item.fileCount} 项</p>
                  </div>
                  <div className="w-24 text-right">
                    <p className="font-medium tabular-nums text-gray-800 dark:text-gray-200">{formatFileSize(item.size)}</p>
                  </div>
                  <div className="w-20 text-right">
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
                        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${Math.max(pct, 0.5)}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs tabular-nums text-gray-400">{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <EmptyState icon={HardDrive} title="该目录为空" description="选择其他目录进行分析" />
      )}
    </ScanResultLayout>
  );
}

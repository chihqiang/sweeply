/**
 * 垃圾清理 Hook
 */
import { useState, useCallback, useRef } from "react";
import {
  scanCleanFiles,
  executeClean,
  stopCleanScan,
  onCleanProgress,
} from "@/services/cleanService";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { CleanScanSummary, CleanResult, CleanResultItem } from "@/types/clean";
import { TaskStatus, type ProgressEvent } from "@/types/common";

/** 垃圾清理 Hook 返回值 */
export interface UseCleanReturn {
  /** 扫描结果 */
  scanSummary: CleanScanSummary | null;
  /** 清理结果 */
  cleanResult: CleanResult | null;
  /** 任务状态 */
  status: TaskStatus;
  /** 扫描进度 */
  scanProgress: ProgressEvent | null;
  /** 错误信息 */
  error: string | null;
  /** 开始扫描 */
  startScan: () => Promise<void>;
  /** 执行清理 */
  executeCleanAction: (selectedIds: string[]) => Promise<void>;
  /** 停止扫描 */
  stopScan: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
  /** 切换单个结果项的选中状态 */
  toggleItemSelection: (itemId: string) => void;
  /** 切换子分类下所有项的选中状态 */
  toggleSubcategorySelection: (subcategoryId: string) => void;
}

/** 垃圾清理 Hook */
export function useClean(): UseCleanReturn {
  const [scanSummary, setScanSummary] = useState<CleanScanSummary | null>(null);
  const [cleanResult, setCleanResult] = useState<CleanResult | null>(null);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.Idle);
  const [scanProgress, setScanProgress] = useState<ProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  /** 清理监听器 */
  const cleanupListener = useCallback(() => {
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }
  }, []);

  /** 重新计算选中汇总信息 */
  const recalcSelection = useCallback(
    (prev: CleanScanSummary): CleanScanSummary => {
      let selectedSize = 0;
      let selectedFileCount = 0;

      for (const cat of prev.categories) {
        for (const sub of cat.subcategories) {
          for (const item of sub.results) {
            if (item.selected) {
              selectedSize += item.size;
              selectedFileCount += 1;
            }
          }
        }
      }

      return {
        ...prev,
        selectedSize,
        selectedFileCount,
      };
    },
    [],
  );

  /** 切换单个结果项的选中状态 */
  const toggleItemSelection = useCallback(
    (itemId: string) => {
      setScanSummary((prev) => {
        if (!prev) return prev;

        const categories = prev.categories.map((cat) => ({
          ...cat,
          subcategories: cat.subcategories.map((sub) => ({
            ...sub,
            results: sub.results.map((item): CleanResultItem =>
              item.id === itemId
                ? { ...item, selected: !item.selected }
                : item,
            ),
          })),
        }));

        return recalcSelection({ ...prev, categories });
      });
    },
    [recalcSelection],
  );

  /** 切换子分类下所有项的选中状态（全选/取消全选） */
  const toggleSubcategorySelection = useCallback(
    (subcategoryId: string) => {
      setScanSummary((prev) => {
        if (!prev) return prev;

        const categories = prev.categories.map((cat) => ({
          ...cat,
          subcategories: cat.subcategories.map((sub) => {
            if (sub.subcategoryId !== subcategoryId) return sub;

            // 判断当前是否全部选中
            const allSelected =
              sub.results.length > 0 && sub.results.every((r) => r.selected);
            const newSelected = !allSelected;

            return {
              ...sub,
              results: sub.results.map(
                (item): CleanResultItem => ({ ...item, selected: newSelected }),
              ),
            };
          }),
        }));

        return recalcSelection({ ...prev, categories });
      });
    },
    [recalcSelection],
  );

  /** 开始扫描 */
  const startScan = useCallback(async () => {
    console.log("[useClean] 开始扫描...");
    setStatus(TaskStatus.Scanning);
    setError(null);
    setCleanResult(null);
    setScanProgress(null);

    // 先清理上一次的监听器
    cleanupListener();

    try {
      // 先设置进度监听器（注册事件，非常快）
      unlistenRef.current = await onCleanProgress((event) => {
        setScanProgress(event);
      });

      // 再发起扫描（Rust 端使用 spawn_blocking，不会阻塞 UI）
      const result = await scanCleanFiles();
      console.log("[useClean] 扫描完成, 总大小:", result.totalSize);
      setScanSummary(result);
      setStatus(TaskStatus.Completed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[useClean] 扫描失败:", msg);
      setError(msg);
      setStatus(TaskStatus.Error);
    } finally {
      cleanupListener();
    }
  }, [cleanupListener]);

  /** 执行清理 */
  const executeCleanAction = useCallback(
    async (selectedIds: string[]) => {
      console.log("[useClean] 执行清理, 选中:", selectedIds.length, "项");
      setStatus(TaskStatus.Processing);
      setError(null);

      try {
        const result = await executeClean(selectedIds);
        console.log("[useClean] 清理完成:", result);
        setCleanResult(result);
        setStatus(TaskStatus.Completed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[useClean] 清理失败:", msg);
        setError(msg);
        setStatus(TaskStatus.Error);
      }
    },
    [],
  );

  /** 停止扫描 */
  const stopScan = useCallback(async () => {
    console.log("[useClean] 停止扫描");
    try {
      await stopCleanScan();
      setStatus(TaskStatus.Idle);
      cleanupListener();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[useClean] 停止扫描失败:", msg);
      setError(msg);
    }
  }, [cleanupListener]);

  /** 重置状态 */
  const reset = useCallback(() => {
    cleanupListener();
    setScanSummary(null);
    setCleanResult(null);
    setStatus(TaskStatus.Idle);
    setScanProgress(null);
    setError(null);
  }, [cleanupListener]);

  return {
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
  };
}

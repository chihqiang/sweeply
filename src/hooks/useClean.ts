import { useState, useCallback, useRef, useEffect } from "react";
import {
  scanCleanFiles,
  executeClean,
  stopCleanScan,
  onCleanProgress,
} from "@/services/cleanService";
import type { CleanScanSummary, CleanResult, CleanResultItem, CleanCategory } from "@/types/clean";
import type { ProgressEvent } from "@/types/common";
import { TaskStatus } from "@/types/common";
import { useAsyncTask } from "./useAsyncTask";
import { cacheGet, cacheSet, cacheDelete } from "@/utils/cache";

export const CACHE_KEY_CLEAN = "clean:scan";

export interface UseCleanReturn {
  scanSummary: CleanScanSummary | null;
  cleanResult: CleanResult | null;
  status: TaskStatus;
  scanProgress: ProgressEvent | null;
  error: string | null;
  startScan: () => Promise<void>;
  executeCleanAction: (selectedIds: string[], sizes: number[]) => Promise<void>;
  stopScan: () => Promise<void>;
  reset: () => void;
  toggleItemSelection: (itemId: string) => void;
  toggleSubcategorySelection: (subcategoryId: string) => void;
  toggleCategorySelection: (categoryId: string) => void;
  selectAllRecommended: () => void;
  deselectAll: () => void;
}

/** 遍历分类下所有结果项（含子分类和直接结果） */
function allItemsInCategory(cat: CleanCategory): CleanResultItem[] {
  const items = [...cat.results];
  for (const sub of cat.subcategories) {
    items.push(...sub.results);
  }
  return items;
}

/** 重新计算选中大小和数量 */
function recalcSelection(prev: CleanScanSummary): CleanScanSummary {
  let selectedSize = 0;
  let selectedFileCount = 0;
  for (const cat of prev.categories) {
    for (const item of cat.results) {
      if (item.selected) {
        selectedSize += item.size;
        selectedFileCount += 1;
      }
    }
    for (const sub of cat.subcategories) {
      for (const item of sub.results) {
        if (item.selected) {
          selectedSize += item.size;
          selectedFileCount += 1;
        }
      }
    }
  }
  return { ...prev, selectedSize, selectedFileCount };
}

export function useClean(): UseCleanReturn {
  const [scanSummary, setScanSummary] = useState<CleanScanSummary | null>(
    cacheGet<CleanScanSummary>(CACHE_KEY_CLEAN),
  );
  const [scanProgress, setScanProgress] = useState<ProgressEvent | null>(null);
  const mountedRef = useRef(true);
  const scanningRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (scanningRef.current) { stopCleanScan(); }
    };
  }, []);

  useEffect(() => {
    if (scanSummary) {
      cacheSet(CACHE_KEY_CLEAN, scanSummary);
    }
  }, [scanSummary]);

  const scan = useAsyncTask(async () => {
    const cached = cacheGet<CleanScanSummary>(CACHE_KEY_CLEAN);
    if (cached) {
      if (mountedRef.current) setScanSummary(cached);
      return cached;
    }
    scanningRef.current = true;
    setScanProgress(null);
    const unlisten = await onCleanProgress((event) => {
      if (mountedRef.current) setScanProgress(event);
    });
    try {
      const result = await scanCleanFiles();
      // 默认不选中任何项，由用户自行勾选
      cacheSet(CACHE_KEY_CLEAN, result);
      if (mountedRef.current) setScanSummary(result);
      return result;
    } finally {
      scanningRef.current = false;
      unlisten();
    }
  });

  const clean = useAsyncTask(async (selectedIds: string[], sizes: number[]) => {
    setScanProgress(null);
    const unlisten = await onCleanProgress((event) => {
      if (mountedRef.current) setScanProgress(event);
    });
    try {
      const result = await executeClean(selectedIds, sizes);
      return result;
    } finally {
      unlisten();
    }
  });

  const { execute: scanExecute } = scan;
  const startScan = useCallback(async () => {
    cacheDelete(CACHE_KEY_CLEAN);
    setScanSummary(null);
    await scanExecute();
  }, [scanExecute]);

  const { execute: cleanExecute } = clean;
  const executeCleanAction = useCallback(
    async (selectedIds: string[], sizes: number[]) => {
      await cleanExecute(selectedIds, sizes);
    },
    [cleanExecute],
  );

  const toggleItemSelection = useCallback((itemId: string) => {
    setScanSummary((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((cat) => {
        const directResults = cat.results.map((item): CleanResultItem =>
          item.id === itemId ? { ...item, selected: !item.selected } : item,
        );
        const subcategories = cat.subcategories.map((sub) => ({
          ...sub,
          results: sub.results.map((item): CleanResultItem =>
            item.id === itemId ? { ...item, selected: !item.selected } : item,
          ),
        }));
        return { ...cat, results: directResults, subcategories };
      });
      return recalcSelection({ ...prev, categories });
    });
  }, []);

  const toggleSubcategorySelection = useCallback((subcategoryId: string) => {
    setScanSummary((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((cat) => ({
        ...cat,
        subcategories: cat.subcategories.map((sub) => {
          if (sub.subcategoryId !== subcategoryId) return sub;
          const allSelected = sub.results.length > 0 && sub.results.every((r) => r.selected);
          return {
            ...sub,
            results: sub.results.map(
              (item): CleanResultItem => ({ ...item, selected: !allSelected }),
            ),
          };
        }),
      }));
      return recalcSelection({ ...prev, categories });
    });
  }, []);

  const toggleCategorySelection = useCallback((categoryId: string) => {
    setScanSummary((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((cat) => {
        if (cat.categoryId !== categoryId) return cat;
        const allItems = allItemsInCategory(cat);
        const allSelected = allItems.length > 0 && allItems.every((r) => r.selected);
        const newSelected = !allSelected;
        return {
          ...cat,
          results: cat.results.map(
            (item): CleanResultItem => ({ ...item, selected: newSelected }),
          ),
          subcategories: cat.subcategories.map((sub) => ({
            ...sub,
            results: sub.results.map(
              (item): CleanResultItem => ({ ...item, selected: newSelected }),
            ),
          })),
        };
      });
      return recalcSelection({ ...prev, categories });
    });
  }, []);

  const selectAllRecommended = useCallback(() => {
    setScanSummary((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((cat) => ({
        ...cat,
        results: cat.results.map(
          (item): CleanResultItem => ({ ...item, selected: cat.recommend }),
        ),
        subcategories: cat.subcategories.map((sub) => ({
          ...sub,
          results: sub.results.map(
            (item): CleanResultItem => ({ ...item, selected: sub.recommend }),
          ),
        })),
      }));
      return recalcSelection({ ...prev, categories });
    });
  }, []);

  const deselectAll = useCallback(() => {
    setScanSummary((prev) => {
      if (!prev) return prev;
      const categories = prev.categories.map((cat) => ({
        ...cat,
        results: cat.results.map(
          (item): CleanResultItem => ({ ...item, selected: false }),
        ),
        subcategories: cat.subcategories.map((sub) => ({
          ...sub,
          results: sub.results.map(
            (item): CleanResultItem => ({ ...item, selected: false }),
          ),
        })),
      }));
      return recalcSelection({ ...prev, categories });
    });
  }, []);

  const { reset: scanReset } = scan;
  const stopScan = useCallback(async () => {
    await stopCleanScan();
    scanReset();
    setScanProgress(null);
  }, [scanReset]);

  const { reset: cleanReset } = clean;
  const reset = useCallback(() => {
    scanReset();
    cleanReset();
    setScanSummary(null);
    setScanProgress(null);
    cacheDelete(CACHE_KEY_CLEAN);
  }, [scanReset, cleanReset]);

  const status =
    scan.status === TaskStatus.Processing ? TaskStatus.Scanning
    : clean.status === TaskStatus.Processing ? TaskStatus.Processing
    : scan.status === TaskStatus.Error || clean.status === TaskStatus.Error ? TaskStatus.Error
    : scan.status === TaskStatus.Completed || clean.status === TaskStatus.Completed
      ? TaskStatus.Completed
      : TaskStatus.Idle;
  const error = scan.error || clean.error;
  const cleanResult = clean.result;

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
    toggleCategorySelection,
    selectAllRecommended,
    deselectAll,
  };
}

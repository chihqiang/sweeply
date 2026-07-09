import { useState, useCallback, useEffect, useRef } from "react";
import {
  scanInstalledApps,
  scanAppFiles,
  uninstallApp,
  onUninstallProgress,
  onAppFound,
  onAppScanProgress,
} from "@/services/uninstallService";
import type {
  InstalledApp,
  UninstallResult,
  UninstallProgressEvent,
  AppFileGroup,
  AppScanProgress,
} from "@/types/uninstaller";
import { AppScanType } from "@/types/uninstaller";
import { TaskStatus } from "@/types/common";
import { useAsyncTask } from "./useAsyncTask";
import { cacheGet, cacheSet, cacheDelete } from "@/utils/cache";

const CACHE_KEY_APPS = "uninstall:appList";
/** 应用列表缓存 10 分钟（安装的应用不会频繁变化） */
const APP_LIST_TTL = 10 * 60_000;

export interface UseUninstallReturn {
  appList: InstalledApp[];
  selectedApp: InstalledApp | null;
  uninstallResult: UninstallResult | null;
  status: TaskStatus;
  loading: boolean;
  /** 扫描进度（已处理/总数） */
  scanProgress: AppScanProgress | null;
  uninstallProgress: UninstallProgressEvent | null;
  error: string | null;
  scanApps: () => Promise<void>;
  scanFiles: (appId: string) => Promise<void>;
  executeUninstall: (appId: string, selectedFileIds: string[]) => Promise<void>;
  selectApp: (app: InstalledApp | null) => void;
  toggleFileSelection: (fileId: string) => void;
  toggleGroupSelection: (fileType: string) => void;
  reset: () => void;
}

/** 重新计算分组的选中信息 */
function recalcGroups(groups: AppFileGroup[]): AppFileGroup[] {
  return groups.map((g) => {
    const selectedFiles = g.files.filter((f) => f.selected);
    return {
      ...g,
      selectedCount: selectedFiles.length,
      selectedSize: selectedFiles.reduce((s, f) => s + f.size, 0),
      selectionState: g.files.length > 0 && selectedFiles.length === g.files.length
        ? "all"
        : selectedFiles.length === 0 ? "none" : "partial",
    };
  });
}

export function useUninstall(): UseUninstallReturn {
  // 初始化：优先使用缓存，避免每次挂载都重新扫描
  const [appList, setAppList] = useState<InstalledApp[]>(() => cacheGet<InstalledApp[]>(CACHE_KEY_APPS) ?? []);
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);
  const [uninstallProgress, setUninstallProgress] = useState<UninstallProgressEvent | null>(null);
  const [scanProgress, setScanProgress] = useState<AppScanProgress | null>(null);
  // 如果有缓存数据，初始 loading 为 false（直接展示缓存）
  const [loading, setLoading] = useState<boolean>(appList.length === 0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const listTask = useAsyncTask(async () => {
    // 监听增量推送：每发现一个应用就追加到列表
    const unlistenAppFound = await onAppFound((app) => {
      if (!mountedRef.current) return;
      setAppList((prev) => {
        // 避免重复
        if (prev.some((a) => a.id === app.id)) return prev;
        return [...prev, app];
      });
    });

    // 监听扫描进度
    const unlistenProgress = await onAppScanProgress((progress) => {
      if (!mountedRef.current) return;
      setScanProgress(progress);
    });

    try {
      const apps = await scanInstalledApps();
      // 最终使用后端返回的完整排序列表替换（后端按大小排序）
      cacheSet(CACHE_KEY_APPS, apps, APP_LIST_TTL);
      if (mountedRef.current) {
        setAppList(apps);
        setLoading(false);
      }
      return apps;
    } finally {
      unlistenAppFound();
      unlistenProgress();
    }
  });

  const { execute: listExecute } = listTask;

  /** 手动刷新：强制重新扫描（删除缓存 → 清空列表 → 重新获取） */
  const scanApps = useCallback(async () => {
    cacheDelete(CACHE_KEY_APPS);
    setLoading(true);
    setScanProgress(null);
    setAppList([]);
    await listExecute();
  }, [listExecute]);

  // 首次挂载：仅当无缓存数据时才请求
  useEffect(() => {
    if (appList.length === 0) {
      void listExecute();
    }
  }, [listExecute, appList.length]);

  const scanTask = useAsyncTask(async (appId: string) => {
    const app = await scanAppFiles(appId, AppScanType.Uninstall);
    if (mountedRef.current) setSelectedApp(app);
    return app;
  });

  const uninstallTask = useAsyncTask(async (params: { appId: string; selectedFileIds: string[] }) => {
    setUninstallProgress(null);
    const unlisten = await onUninstallProgress((event) => {
      if (mountedRef.current) setUninstallProgress(event);
    });
    try {
      return await uninstallApp(params.appId, params.selectedFileIds);
    } finally {
      unlisten();
    }
  });

  const { execute: scanExecute } = scanTask;
  const scanFiles = useCallback(
    async (appId: string) => {
      await scanExecute(appId);
    },
    [scanExecute],
  );

  const { execute: uninstallExecute } = uninstallTask;
  const executeUninstall = useCallback(
    async (appId: string, selectedFileIds: string[]) => {
      await uninstallExecute({ appId, selectedFileIds });
    },
    [uninstallExecute],
  );

  const selectApp = useCallback((app: InstalledApp | null) => {
    setSelectedApp(app);
  }, []);

  // #21: 切换单个文件选中状态
  const toggleFileSelection = useCallback((fileId: string) => {
    setSelectedApp((prev) => {
      if (!prev?.fileGroups) return prev;
      const groups = prev.fileGroups.map((g) => ({
        ...g,
        files: g.files.map((f) =>
          f.id === fileId ? { ...f, selected: !f.selected } : f,
        ),
      }));
      return { ...prev, fileGroups: recalcGroups(groups) };
    });
  }, []);

  // #21: 切换整组文件选中状态
  const toggleGroupSelection = useCallback((fileType: string) => {
    setSelectedApp((prev) => {
      if (!prev?.fileGroups) return prev;
      const groups = prev.fileGroups.map((g) => {
        if (g.fileType !== fileType) return g;
        const allSelected = g.files.length > 0 && g.files.every((f) => f.selected);
        return {
          ...g,
          files: g.files.map((f) => ({ ...f, selected: !allSelected })),
        };
      });
      return { ...prev, fileGroups: recalcGroups(groups) };
    });
  }, []);

  const { reset: listReset } = listTask;
  const { reset: scanReset } = scanTask;
  const { reset: uninstallReset } = uninstallTask;

  const reset = useCallback(() => {
    listReset();
    scanReset();
    uninstallReset();
    cacheDelete(CACHE_KEY_APPS);
    setAppList([]);
    setSelectedApp(null);
    setUninstallProgress(null);
    setScanProgress(null);
    setLoading(false);
  }, [listReset, scanReset, uninstallReset]);

  const status =
    listTask.status === TaskStatus.Processing || scanTask.status === TaskStatus.Processing
      ? TaskStatus.Scanning
      : uninstallTask.status === TaskStatus.Processing
        ? TaskStatus.Processing
        : listTask.status === TaskStatus.Error || scanTask.status === TaskStatus.Error || uninstallTask.status === TaskStatus.Error
          ? TaskStatus.Error
          : listTask.status === TaskStatus.Completed || scanTask.status === TaskStatus.Completed || uninstallTask.status === TaskStatus.Completed
            ? TaskStatus.Completed
            : TaskStatus.Idle;
  const error = listTask.error || scanTask.error || uninstallTask.error;
  const uninstallResult = uninstallTask.result;

  return {
    appList,
    selectedApp,
    uninstallResult,
    status,
    loading,
    scanProgress,
    uninstallProgress,
    error,
    scanApps,
    scanFiles,
    executeUninstall,
    selectApp,
    toggleFileSelection,
    toggleGroupSelection,
    reset,
  };
}

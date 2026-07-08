/**
 * 应用卸载 Hook
 */
import { useState, useCallback, useRef } from "react";
import {
  scanInstalledApps,
  scanAppFiles,
  uninstallApp,
  onUninstallProgress,
} from "@/services/uninstallService";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type {
  InstalledApp,
  UninstallResult,
  UninstallProgressEvent,
} from "@/types/uninstaller";
import { AppScanType } from "@/types/uninstaller";
import { TaskStatus } from "@/types/common";

/** 应用卸载 Hook 返回值 */
export interface UseUninstallReturn {
  /** 已安装应用列表 */
  appList: InstalledApp[];
  /** 当前选中的应用详情 */
  selectedApp: InstalledApp | null;
  /** 卸载结果 */
  uninstallResult: UninstallResult | null;
  /** 任务状态 */
  status: TaskStatus;
  /** 卸载进度 */
  uninstallProgress: UninstallProgressEvent | null;
  /** 错误信息 */
  error: string | null;
  /** 扫描应用列表 */
  scanApps: () => Promise<void>;
  /** 扫描应用文件 */
  scanFiles: (appId: string) => Promise<void>;
  /** 执行卸载 */
  executeUninstall: (appId: string, selectedFileIds: string[]) => Promise<void>;
  /** 选中应用 */
  selectApp: (app: InstalledApp | null) => void;
  /** 重置状态 */
  reset: () => void;
}

/** 应用卸载 Hook */
export function useUninstall(): UseUninstallReturn {
  const [appList, setAppList] = useState<InstalledApp[]>([]);
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null);
  const [uninstallResult, setUninstallResult] =
    useState<UninstallResult | null>(null);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.Idle);
  const [uninstallProgress, setUninstallProgress] =
    useState<UninstallProgressEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  /** 扫描应用列表 */
  const scanApps = useCallback(async () => {
    console.log("[useUninstall] 扫描应用列表...");
    setStatus(TaskStatus.Scanning);
    setError(null);

    try {
      const apps = await scanInstalledApps();
      console.log("[useUninstall] 扫描完成, 找到", apps.length, "个应用");
      setAppList(apps);
      setStatus(TaskStatus.Completed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[useUninstall] 扫描应用列表失败:", msg);
      setError(msg);
      setStatus(TaskStatus.Error);
    }
  }, []);

  /** 扫描应用文件 */
  const scanFiles = useCallback(async (appId: string) => {
    console.log("[useUninstall] 扫描应用残留, appId:", appId);
    setStatus(TaskStatus.Scanning);
    setError(null);

    try {
      const app = await scanAppFiles(appId, AppScanType.Uninstall);
      console.log("[useUninstall] 残留扫描完成, 总大小:", app.totalSize);
      setSelectedApp(app);
      setStatus(TaskStatus.Completed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[useUninstall] 扫描残留失败:", msg);
      setError(msg);
      setStatus(TaskStatus.Error);
    }
  }, []);

  /** 执行卸载 */
  const executeUninstall = useCallback(
    async (appId: string, selectedFileIds: string[]) => {
      console.log("[useUninstall] 执行卸载, appId:", appId, "选中", selectedFileIds.length, "项");
      setStatus(TaskStatus.Processing);
      setError(null);
      setUninstallResult(null);

      // 先清理上一次监听
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }

      try {
        unlistenRef.current = await onUninstallProgress((event) => {
          setUninstallProgress(event);
        });

        const result = await uninstallApp(appId, selectedFileIds);
        console.log("[useUninstall] 卸载完成:", result);
        setUninstallResult(result);
        setStatus(TaskStatus.Completed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[useUninstall] 卸载失败:", msg);
        setError(msg);
        setStatus(TaskStatus.Error);
      } finally {
        if (unlistenRef.current) {
          unlistenRef.current();
          unlistenRef.current = null;
        }
      }
    },
    [],
  );

  /** 选中应用 */
  const selectApp = useCallback((app: InstalledApp | null) => {
    setSelectedApp(app);
    setUninstallResult(null);
  }, []);

  /** 重置状态 */
  const reset = useCallback(() => {
    setAppList([]);
    setSelectedApp(null);
    setUninstallResult(null);
    setStatus(TaskStatus.Idle);
    setUninstallProgress(null);
    setError(null);
  }, []);

  return {
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
    reset,
  };
}

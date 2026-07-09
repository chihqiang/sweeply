import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  InstalledApp,
  UninstallResult,
  UninstallProgressEvent,
  AppScanType,
  AppScanProgress,
} from "@/types/uninstaller";

const CMD_SCAN_APPS = "scan_installed_apps";
const CMD_SCAN_APP_FILES = "scan_app_files";
const CMD_UNINSTALL_APP = "uninstall_app";
const EVENT_UNINSTALL_PROGRESS = "uninstall://progress";
const EVENT_APP_FOUND = "uninstall://app-found";
const EVENT_APP_SCAN_FINISHED = "uninstall://app-scan-finished";

export async function scanInstalledApps(): Promise<InstalledApp[]> {
  return invoke<InstalledApp[]>(CMD_SCAN_APPS);
}

export async function scanAppFiles(
  appId: string,
  scanType: AppScanType,
): Promise<InstalledApp> {
  return invoke<InstalledApp>(CMD_SCAN_APP_FILES, { appId, scanType });
}

export async function uninstallApp(
  appId: string,
  selectedFileIds: string[],
): Promise<UninstallResult> {
  return invoke<UninstallResult>(CMD_UNINSTALL_APP, {
    appId,
    selectedFileIds,
  });
}

export async function onUninstallProgress(
  callback: (event: UninstallProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<UninstallProgressEvent>(EVENT_UNINSTALL_PROGRESS, (event) => {
    callback(event.payload);
  });
}

/** 监听单个应用被发现（增量推送） */
export async function onAppFound(
  callback: (app: InstalledApp) => void,
): Promise<UnlistenFn> {
  return listen<InstalledApp>(EVENT_APP_FOUND, (event) => {
    callback(event.payload);
  });
}

/** 监听扫描进度（已处理/总数） */
export async function onAppScanProgress(
  callback: (progress: AppScanProgress) => void,
): Promise<UnlistenFn> {
  return listen<AppScanProgress>(EVENT_APP_SCAN_FINISHED, (event) => {
    callback(event.payload);
  });
}

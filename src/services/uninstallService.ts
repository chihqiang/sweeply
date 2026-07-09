import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  InstalledApp,
  UninstallResult,
  UninstallProgressEvent,
  AppScanType,
} from "@/types/uninstaller";

const CMD_SCAN_APPS = "scan_installed_apps";
const CMD_SCAN_APP_FILES = "scan_app_files";
const CMD_UNINSTALL_APP = "uninstall_app";
const EVENT_UNINSTALL_PROGRESS = "uninstall://progress";

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

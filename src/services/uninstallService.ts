/**
 * 应用卸载 Tauri 服务层
 * 封装与 Rust 后端的命令调用
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  InstalledApp,
  UninstallResult,
  UninstallProgressEvent,
  AppScanType,
} from "@/types/uninstaller";

/** 命令名称常量 */
const CMD_SCAN_APPS = "scan_installed_apps";
const CMD_SCAN_APP_FILES = "scan_app_files";
const CMD_UNINSTALL_APP = "uninstall_app";
const EVENT_UNINSTALL_PROGRESS = "uninstall://progress";

/**
 * 扫描已安装应用列表
 * @returns 已安装应用列表
 */
export async function scanInstalledApps(): Promise<InstalledApp[]> {
  return invoke<InstalledApp[]>(CMD_SCAN_APPS);
}

/**
 * 扫描应用的残留文件
 * @param appId 应用 ID
 * @param scanType 扫描类型
 * @returns 包含文件分组的应用信息
 */
export async function scanAppFiles(
  appId: string,
  scanType: AppScanType,
): Promise<InstalledApp> {
  return invoke<InstalledApp>(CMD_SCAN_APP_FILES, { appId, scanType });
}

/**
 * 卸载应用（删除选中的文件项）
 * @param appId 应用 ID
 * @param selectedFileIds 选中的文件项 ID 列表
 * @returns 卸载结果
 */
export async function uninstallApp(
  appId: string,
  selectedFileIds: string[],
): Promise<UninstallResult> {
  return invoke<UninstallResult>(CMD_UNINSTALL_APP, {
    appId,
    selectedFileIds,
  });
}

/**
 * 监听卸载进度事件
 * @param callback 进度回调
 * @returns 取消监听函数
 */
export async function onUninstallProgress(
  callback: (event: UninstallProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<UninstallProgressEvent>(EVENT_UNINSTALL_PROGRESS, (event) => {
    callback(event.payload);
  });
}

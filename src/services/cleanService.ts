/**
 * 垃圾清理 Tauri 服务层
 * 封装与 Rust 后端的命令调用
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { CleanScanSummary, CleanResult } from "@/types/clean";
import type { ProgressEvent } from "@/types/common";

/** 命令名称常量 */
const CMD_SCAN_CLEAN = "scan_clean_files";
const CMD_EXECUTE_CLEAN = "execute_clean";
const CMD_STOP_SCAN = "stop_clean_scan";
const EVENT_CLEAN_PROGRESS = "clean://scan-progress";

/**
 * 扫描垃圾文件
 * @returns 扫描结果汇总
 */
export async function scanCleanFiles(): Promise<CleanScanSummary> {
  return invoke<CleanScanSummary>(CMD_SCAN_CLEAN);
}

/**
 * 执行垃圾清理
 * @param selectedIds 选中的结果项 ID 列表
 * @returns 清理结果
 */
export async function executeClean(selectedIds: string[]): Promise<CleanResult> {
  return invoke<CleanResult>(CMD_EXECUTE_CLEAN, { selectedIds });
}

/**
 * 停止扫描
 */
export async function stopCleanScan(): Promise<void> {
  await invoke(CMD_STOP_SCAN);
}

/**
 * 监听扫描进度事件
 * @param callback 进度回调
 * @returns 取消监听函数
 */
export async function onCleanProgress(
  callback: (event: ProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<ProgressEvent>(EVENT_CLEAN_PROGRESS, (event) => {
    callback(event.payload);
  });
}

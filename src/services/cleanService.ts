import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { CleanScanSummary, CleanResult } from "@/types/clean";
import type { ProgressEvent } from "@/types/common";

const CMD_SCAN_CLEAN = "scan_clean_files";
const CMD_EXECUTE_CLEAN = "execute_clean";
const CMD_STOP_SCAN = "stop_clean_scan";
const EVENT_CLEAN_PROGRESS = "clean://scan-progress";

export async function scanCleanFiles(): Promise<CleanScanSummary> {
  return invoke<CleanScanSummary>(CMD_SCAN_CLEAN);
}

export async function executeClean(
  selectedIds: string[],
  sizes: number[],
): Promise<CleanResult> {
  return invoke<CleanResult>(CMD_EXECUTE_CLEAN, { selectedIds, sizes });
}

export async function stopCleanScan(): Promise<void> {
  await invoke(CMD_STOP_SCAN);
}

export async function onCleanProgress(
  callback: (event: ProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<ProgressEvent>(EVENT_CLEAN_PROGRESS, (event) => {
    callback(event.payload);
  });
}

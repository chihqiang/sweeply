import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DiskItem, DiskUsageProgress } from "@/types/diskUsage";

export async function scanDiskUsage(
  path: string,
  onProgress: (p: DiskUsageProgress) => void,
): Promise<DiskItem[]> {
  const unlisten = await listen<DiskUsageProgress>("diskusage://scan-progress", (e) => {
    onProgress(e.payload);
  });
  try {
    return await invoke<DiskItem[]>("scan_disk_usage", { path });
  } finally {
    unlisten();
  }
}

export async function scanDiskUsageDetail(path: string): Promise<DiskItem> {
  return invoke<DiskItem>("scan_disk_usage_detail", { path });
}

export async function stopDiskScan(): Promise<void> {
  return invoke("stop_disk_scan");
}

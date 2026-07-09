import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { LargeFile, LargeFileProgress } from "@/types/largeFiles";

export async function scanLargeFiles(
  path: string,
  minSizeMb: number,
  onProgress: (p: LargeFileProgress) => void,
): Promise<LargeFile[]> {
  const unlisten = await listen<LargeFileProgress>("largefile://progress", (e) => {
    onProgress(e.payload);
  });
  try {
    return await invoke<LargeFile[]>("scan_large_files", { path, minSizeMb });
  } finally {
    unlisten();
  }
}

export async function stopLargeFileScan(): Promise<void> {
  return invoke("stop_large_file_scan");
}

export async function deleteLargeFiles(paths: string[]): Promise<string[]> {
  return invoke<string[]>("delete_large_files", { paths });
}

export async function openFileLocation(path: string): Promise<void> {
  return invoke("open_file_location", { path });
}

import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { DuplicateGroup, DuplicateProgress } from "@/types/duplicateFiles";

export async function scanDuplicates(
  paths: string[],
  onProgress: (p: DuplicateProgress) => void,
  signal?: AbortSignal,
): Promise<DuplicateGroup[]> {
  const unlisten = await listen<DuplicateProgress>("duplicate://scan-progress", (e) => {
    onProgress(e.payload);
  });

  try {
    if (signal?.aborted) return [];
    const result = await invoke<DuplicateGroup[]>("scan_duplicates", { paths });
    return result;
  } finally {
    unlisten();
  }
}

export async function stopDuplicateScan(): Promise<void> {
  return invoke("stop_duplicate_scan");
}

export async function deleteDuplicateFiles(paths: string[]): Promise<string[]> {
  return invoke<string[]>("delete_duplicate_files", { paths });
}

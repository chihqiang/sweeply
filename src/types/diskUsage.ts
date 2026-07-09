export interface DiskItem {
  name: string;
  path: string;
  size: number;
  fileCount: number;
  children: DiskItem[];
}

export interface DiskUsageProgress {
  current: number;
  total: number;
  /** 当前正在扫描的路径 */
  currentPath: string;
}

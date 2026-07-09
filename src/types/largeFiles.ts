export interface LargeFile {
  path: string;
  name: string;
  size: number;
  modified: string;
  extension: string;
}

export interface LargeFileProgress {
  scanned: number;
  found: number;
  /** 当前正在扫描的路径 */
  currentPath: string;
}

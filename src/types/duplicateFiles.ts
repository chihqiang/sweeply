export interface DuplicateFile {
  path: string;
  name: string;
  modified: string;
}

export interface DuplicateGroup {
  hash: string;
  size: number;
  files: DuplicateFile[];
}

export interface DuplicateProgress {
  phase: string;
  current: number;
  total: number;
  /** 当前正在扫描的路径 */
  currentPath: string;
}

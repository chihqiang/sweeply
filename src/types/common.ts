export interface CommandResult<T> {
  success: boolean;
  data: T;
  message: string;
}

export enum TaskStatus {
  /** 空闲 */
  Idle = "idle",
  /** 扫描中 */
  Scanning = "scanning",
  /** 清理中 / 卸载中 */
  Processing = "processing",
  /** 已完成 */
  Completed = "completed",
  /** 出错 */
  Error = "error",
}

export interface ProgressEvent {
  /** 当前进度 0~1 */
  progress: number;
  /** 当前扫描路径或描述 */
  description: string;
}

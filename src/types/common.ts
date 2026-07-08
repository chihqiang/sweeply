/**
 * 通用类型定义
 */

/** 通用后端命令返回结构 */
export interface CommandResult<T> {
  success: boolean;
  data: T;
  message: string;
}

/** 文件大小单位 */
export enum FileSizeUnit {
  B = "B",
  KB = "KB",
  MB = "MB",
  GB = "GB",
  TB = "TB",
}

/** 选中状态 */
export enum SelectionState {
  /** 未选中 */
  Off = "off",
  /** 已选中 */
  On = "on",
  /** 部分选中 */
  Mixed = "mixed",
}

/** 任务状态 */
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

/** 进度回调事件 */
export interface ProgressEvent {
  /** 当前进度 0~1 */
  progress: number;
  /** 当前扫描路径或描述 */
  description: string;
}

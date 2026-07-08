/**
 * 网络测速相关类型定义
 * 参考 lemon-cleaner 的 LemonNetSpeed 模块
 */

/** 网络连接状态 */
export enum NetworkConnectionState {
  /** 已连接 */
  Connected = "connected",
  /** 未连接 */
  Disconnected = "disconnected",
  /** 检测中 */
  Checking = "checking",
}

/** 测速状态 */
export enum SpeedTestStatus {
  /** 空闲 */
  Idle = "idle",
  /** 测试中 */
  Testing = "testing",
  /** 已完成 */
  Completed = "completed",
  /** 出错 */
  Error = "error",
}

/** 网络速度方向 */
export enum SpeedDirection {
  /** 下载 */
  Download = "download",
  /** 上传 */
  Upload = "upload",
}

/** 单次测速结果 */
export interface SpeedTestResult {
  /** 下载速度（bps） */
  downloadSpeed: number;
  /** 上传速度（bps） */
  uploadSpeed: number;
  /** 延迟（毫秒） */
  latency: number;
  /** 抖动（毫秒） */
  jitter: number;
  /** 丢包率（百分比） */
  packetLoss: number;
  /** 测试时间戳（毫秒） */
  timestamp: number;
}

/** 测速进度事件 */
export interface SpeedTestProgressEvent {
  /** 当前阶段 */
  phase: SpeedTestPhase;
  /** 进度 0~1 */
  progress: number;
  /** 当前速度（bps） */
  currentSpeed: number;
  /** 方向 */
  direction: SpeedDirection;
}

/** 测速阶段 */
export enum SpeedTestPhase {
  /** 延迟测试 */
  Latency = "latency",
  /** 下载测试 */
  Download = "download",
  /** 上传测试 */
  Upload = "upload",
  /** 完成 */
  Done = "done",
}

/** 进程网络使用信息 */
export interface ProcessNetworkUsage {
  /** 进程 ID */
  pid: number;
  /** 进程名称 */
  appName: string;
  /** 下载速度（bps） */
  downloadSpeed: number;
  /** 上传速度（bps） */
  uploadSpeed: number;
  /** 总下载量（字节） */
  totalDownload: number;
  /** 总上传量（字节） */
  totalUpload: number;
}

/** 网络接口信息 */
export interface NetworkInterface {
  /** 接口名称 */
  name: string;
  /** IP 地址 */
  ipAddress: string;
  /** MAC 地址 */
  macAddress: string;
  /** 是否活跃 */
  isActive: boolean;
}

/** 网络状态信息 */
export interface NetworkStatus {
  /** 连接状态 */
  connectionState: NetworkConnectionState;
  /** 网络接口列表 */
  interfaces: NetworkInterface[];
  /** 当前下载速度（bps） */
  currentDownloadSpeed: number;
  /** 当前上传速度（bps） */
  currentUploadSpeed: number;
}

export enum NetworkConnectionState {
  /** 已连接 */
  Connected = "connected",
  /** 未连接 */
  Disconnected = "disconnected",
  Checking = "checking",
}

export enum SpeedDirection {
  /** 下载 */
  Download = "download",
  /** 上传 */
  Upload = "upload",
}

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

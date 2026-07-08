/**
 * 网络测速 Tauri 服务层
 * 封装与 Rust 后端的命令调用
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  NetworkStatus,
  SpeedTestResult,
  SpeedTestProgressEvent,
  ProcessNetworkUsage,
} from "@/types/network";

/** 命令名称常量 */
const CMD_GET_NETWORK_STATUS = "get_network_status";
const CMD_START_SPEED_TEST = "start_speed_test";
const CMD_STOP_SPEED_TEST = "stop_speed_test";
const CMD_GET_PROCESS_NET_USAGE = "get_process_network_usage";
const EVENT_SPEED_TEST_PROGRESS = "speedtest://progress";

/**
 * 获取当前网络状态
 * @returns 网络状态信息
 */
export async function getNetworkStatus(): Promise<NetworkStatus> {
  return invoke<NetworkStatus>(CMD_GET_NETWORK_STATUS);
}

/**
 * 开始网络测速
 * @returns 测速结果
 */
export async function startSpeedTest(): Promise<SpeedTestResult> {
  return invoke<SpeedTestResult>(CMD_START_SPEED_TEST);
}

/**
 * 停止网络测速
 */
export async function stopSpeedTest(): Promise<void> {
  await invoke(CMD_STOP_SPEED_TEST);
}

/**
 * 获取进程网络使用情况
 * @returns 进程网络使用列表
 */
export async function getProcessNetworkUsage(): Promise<
  ProcessNetworkUsage[]
> {
  return invoke<ProcessNetworkUsage[]>(CMD_GET_PROCESS_NET_USAGE);
}

/**
 * 监听测速进度事件
 * @param callback 进度回调
 * @returns 取消监听函数
 */
export async function onSpeedTestProgress(
  callback: (event: SpeedTestProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<SpeedTestProgressEvent>(EVENT_SPEED_TEST_PROGRESS, (event) => {
    callback(event.payload);
  });
}

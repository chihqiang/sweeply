import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  NetworkStatus,
  SpeedTestResult,
  SpeedTestProgressEvent,
} from "@/types/network";

const CMD_GET_NETWORK_STATUS = "get_network_status";
const CMD_START_SPEED_TEST = "start_speed_test";
const CMD_STOP_SPEED_TEST = "stop_speed_test";
const EVENT_SPEED_TEST_PROGRESS = "speedtest://progress";

export async function getNetworkStatus(): Promise<NetworkStatus> {
  return invoke<NetworkStatus>(CMD_GET_NETWORK_STATUS);
}

export async function startSpeedTest(): Promise<SpeedTestResult> {
  return invoke<SpeedTestResult>(CMD_START_SPEED_TEST);
}

export async function stopSpeedTest(): Promise<void> {
  await invoke(CMD_STOP_SPEED_TEST);
}

export async function onSpeedTestProgress(
  callback: (event: SpeedTestProgressEvent) => void,
): Promise<UnlistenFn> {
  return listen<SpeedTestProgressEvent>(EVENT_SPEED_TEST_PROGRESS, (event) => {
    callback(event.payload);
  });
}

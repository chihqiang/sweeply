import { invoke } from "@tauri-apps/api/core";
import type { SystemInfo } from "@/types/system";

const CMD = "get_system_info";
const CMD_FLUSH_DNS = "flush_dns";

export async function getSystemInfo(): Promise<SystemInfo> {
  return invoke<SystemInfo>(CMD);
}

export async function flushDns(): Promise<string> {
  return invoke<string>(CMD_FLUSH_DNS);
}

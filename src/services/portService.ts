import { invoke } from "@tauri-apps/api/core";
import type { ListeningPort } from "@/types/ports";

export async function listListeningPorts(): Promise<ListeningPort[]> {
  return invoke<ListeningPort[]>("list_listening_ports");
}

export async function killProcess(pid: number): Promise<void> {
  return invoke("kill_process", { pid });
}
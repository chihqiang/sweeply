import { invoke } from "@tauri-apps/api/core";
import type { LoginItem, BackgroundItem } from "@/types/loginItems";

export async function listLoginItems(): Promise<LoginItem[]> {
  return invoke<LoginItem[]>("list_login_items");
}

export async function addLoginItem(path: string): Promise<void> {
  return invoke("add_login_item", { path });
}

export async function removeLoginItem(name: string): Promise<void> {
  return invoke("remove_login_item", { name });
}

export async function listBackgroundItems(): Promise<BackgroundItem[]> {
  return invoke<BackgroundItem[]>("list_background_items");
}

import { invoke } from "@tauri-apps/api/core";
import type { KeychainListResult, KeychainItem } from "@/types/keychain";

const CMD_OPEN = "open_keychain_access";
const CMD_LIST_ITEMS = "list_keychain_items";
const CMD_SEARCH = "search_keychain_items";

export async function openKeychainAccess(): Promise<void> {
  await invoke(CMD_OPEN);
}

export async function listKeychains(): Promise<KeychainListResult> {
  return invoke<KeychainListResult>(CMD_LIST_ITEMS);
}

export async function searchKeychainItems(query: string): Promise<KeychainItem[]> {
  return invoke<KeychainItem[]>(CMD_SEARCH, { query });
}

import { invoke } from "@tauri-apps/api/core";
import type { KeychainListResult, KeychainItem } from "@/types/keychain";

const CMD_OPEN = "open_keychain_access";
const CMD_LIST_ITEMS = "list_keychain_items";
const CMD_SEARCH = "search_keychain_items";
const CMD_GET_PASSWORD = "get_keychain_password";
const CMD_DELETE = "delete_keychain_item";

export async function openKeychainAccess(): Promise<void> {
  await invoke(CMD_OPEN);
}

export async function listKeychains(): Promise<KeychainListResult> {
  return invoke<KeychainListResult>(CMD_LIST_ITEMS);
}

export async function searchKeychainItems(query: string): Promise<KeychainItem[]> {
  return invoke<KeychainItem[]>(CMD_SEARCH, { query });
}

export async function getKeychainPassword(rawKind: string, service: string, account: string): Promise<string> {
  return invoke<string>(CMD_GET_PASSWORD, { rawKind, service, account });
}

export async function deleteKeychainItem(rawKind: string, service: string, account: string): Promise<void> {
  return invoke<void>(CMD_DELETE, { rawKind, service, account });
}

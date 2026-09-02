import { useState, useCallback, useEffect, useRef } from "react";
import { openKeychainAccess as openKeychain, listKeychains, searchKeychainItems, getKeychainPassword as getPwd, deleteKeychainItem as deleteItemSvc } from "@/services/keychainService";
import { useAsyncTask } from "./useAsyncTask";
import { cacheGet, cacheSet } from "@/utils/cache";
import { TaskStatus } from "@/types/common";
import type { KeychainListResult, KeychainItem, KeychainFile } from "@/types/keychain";

const CACHE_KEY = "keychain:list";
/** 钥匙串列表缓存 5 分钟 */
const CACHE_TTL = 5 * 60_000;

export type KeychainStatus = "idle" | "loading" | "loaded" | "error";

export interface UseKeychainReturn {
  result: KeychainListResult | null;
  keychains: KeychainFile[];
  items: KeychainItem[];
  query: string;
  status: KeychainStatus;
  error: string | null;
  loading: boolean;
  openAccess: () => Promise<void>;
  load: () => Promise<void>;
  search: (q: string) => Promise<void>;
  getPassword: (rawKind: string, service: string, account: string) => Promise<string>;
  deleteItem: (id: string, rawKind: string, service: string, account: string) => Promise<void>;
}

export function useKeychain(): UseKeychainReturn {
  const cached = cacheGet<KeychainListResult>(CACHE_KEY);
  const [result, setResult] = useState<KeychainListResult | null>(cached ?? null);
  const [items, setItems] = useState<KeychainItem[]>([]);
  const [query, setQuery] = useState("");
  const allItemsRef = useRef<KeychainItem[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // 统一的数据加载任务：拉取钥匙串列表并缓存，再拉取全部条目
  const loadTask = useAsyncTask(async () => {
    const res = await listKeychains();
    cacheSet(CACHE_KEY, res, CACHE_TTL);
    if (mountedRef.current) setResult(res);

    const all = await searchKeychainItems("");
    allItemsRef.current = all;
    if (mountedRef.current) {
      setItems(query === "" ? all : itemsFiltered(all, query));
    }
    return res;
  });

  const { execute: loadExecute } = loadTask;
  const load = useCallback(async () => {
    await loadExecute();
  }, [loadExecute]);

  // search locally from cached items
  const search = useCallback(async (q: string) => {
    setQuery(q);
    const filtered = q === "" ? allItemsRef.current : itemsFiltered(allItemsRef.current, q);
    if (mountedRef.current) setItems(filtered);
  }, []);

  const getPassword = useCallback(async (rawKind: string, service: string, account: string): Promise<string> => {
    return getPwd(rawKind, service, account);
  }, []);

  const deleteItem = useCallback(async (id: string, rawKind: string, service: string, account: string) => {
    await deleteItemSvc(rawKind, service, account);
    allItemsRef.current = allItemsRef.current.filter(item => item.id !== id);
    if (mountedRef.current) {
      setItems(prev => prev.filter(item => item.id !== id));
    }
  }, []);

  const openAccess = useCallback(async () => {
    await openKeychain();
  }, []);

  // 首次挂载
  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      void loadExecute();
    }
  }, [loadExecute]);

  const status: KeychainStatus =
    loadTask.status === TaskStatus.Processing
      ? "loading"
      : loadTask.status === TaskStatus.Error
        ? "error"
        : loadTask.status === TaskStatus.Completed
          ? "loaded"
          : "idle";

  const error = loadTask.error;

  return {
    result,
    keychains: result?.keychains ?? [],
    items,
    query,
    status,
    error,
    loading: loadTask.status === TaskStatus.Processing,
    openAccess,
    load,
    search,
    getPassword,
    deleteItem,
  };
}

/** 按关键词过滤条目（本地过滤，复用后端相同的匹配规则） */
function itemsFiltered(all: KeychainItem[], q: string): KeychainItem[] {
  const lower = q.toLowerCase();
  return all.filter(item =>
    item.title.toLowerCase().includes(lower)
    || item.account.toLowerCase().includes(lower)
    || item.serverOrService.toLowerCase().includes(lower)
  );
}
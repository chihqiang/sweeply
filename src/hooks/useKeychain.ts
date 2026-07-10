import { useState, useCallback, useEffect, useRef } from "react";
import { openKeychainAccess as openKeychain, listKeychains, searchKeychainItems, getKeychainPassword as getPwd, deleteKeychainItem as deleteItemSvc } from "@/services/keychainService";
import { useAsyncTask } from "./useAsyncTask";
import { cacheGet, cacheSet } from "@/utils/cache";
import type { KeychainListResult, KeychainItem } from "@/types/keychain";
import type { KeychainFile } from "@/types/keychain";

const CACHE_KEY = "keychain:list";
/** 钥匙串列表缓存 5 分钟 */
const CACHE_TTL = 5 * 60_000;

export interface UseKeychainReturn {
  result: KeychainListResult | null;
  keychains: KeychainFile[];
  items: KeychainItem[];
  query: string;
  status: string;
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

  const loadTask = useAsyncTask(async () => {
    const res = await listKeychains();
    cacheSet(CACHE_KEY, res, CACHE_TTL);
    setResult(res);
    return res;
  });

  // fetch all items from Rust (dumps keychain)
  const fetchAllItems = useCallback(async () => {
    const all = await searchKeychainItems("");
    allItemsRef.current = all;
    return all;
  }, []);

  const initialLoadTask = useAsyncTask(async () => {
    const res = await listKeychains();
    cacheSet(CACHE_KEY, res, CACHE_TTL);
    setResult(res);
    const all = await searchKeychainItems("");
    allItemsRef.current = all;
    setItems(all);
    return res;
  });

  const { execute: loadExecute } = loadTask;
  const load = useCallback(async () => {
    await loadExecute();
    const all = await fetchAllItems();
    setItems(all);
  }, [loadExecute, fetchAllItems]);

  // search locally from cached items
  const search = useCallback(async (q: string) => {
    setQuery(q);
    if (q === "") {
      setItems(allItemsRef.current);
      return;
    }
    const lower = q.toLowerCase();
    const filtered = allItemsRef.current.filter(item =>
      item.title.toLowerCase().includes(lower)
      || item.account.toLowerCase().includes(lower)
      || item.serverOrService.toLowerCase().includes(lower)
    );
    setItems(filtered);
  }, []);

  const getPassword = useCallback(async (rawKind: string, service: string, account: string): Promise<string> => {
    return getPwd(rawKind, service, account);
  }, []);

  const deleteItem = useCallback(async (id: string, rawKind: string, service: string, account: string) => {
    await deleteItemSvc(rawKind, service, account);
    allItemsRef.current = allItemsRef.current.filter(item => item.id !== id);
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const openAccess = useCallback(async () => {
    await openKeychain();
  }, []);

  // 首次挂载
  const initialLoadRef = useRef(false);
  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      void initialLoadTask.execute();
    }
  }, [initialLoadTask.execute]);

  const status =
    initialLoadTask.status === "processing"
      ? "loading"
      : loadTask.status === "processing"
        ? "loading"
        : initialLoadTask.status === "error"
          ? "error"
          : initialLoadTask.status === "completed"
            ? "loaded"
            : "idle";

  const error = initialLoadTask.error || loadTask.error;

  return {
    result,
    keychains: result?.keychains ?? [],
    items,
    query,
    status,
    error,
    loading: initialLoadTask.status === "processing" || loadTask.status === "processing",
    openAccess,
    load,
    search,
    getPassword,
    deleteItem,
  };
}

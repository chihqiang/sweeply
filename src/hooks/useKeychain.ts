import { useState, useCallback, useEffect, useRef } from "react";
import { openKeychainAccess as openKeychain, listKeychains, searchKeychainItems } from "@/services/keychainService";
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
}

export function useKeychain(): UseKeychainReturn {
  // 初始化：优先使用缓存
  const cached = cacheGet<KeychainListResult>(CACHE_KEY);
  const [result, setResult] = useState<KeychainListResult | null>(cached ?? null);
  const [items, setItems] = useState<KeychainItem[]>([]);
  const [query, setQuery] = useState("");

  const loadTask = useAsyncTask(async () => {
    const res = await listKeychains();
    cacheSet(CACHE_KEY, res, CACHE_TTL);
    setResult(res);
    return res;
  });

  const searchTask = useAsyncTask(async (q: string) => {
    setQuery(q);
    if (!q.trim()) {
      setItems([]);
      return [];
    }
    const res = await searchKeychainItems(q);
    setItems(res);
    return res;
  });

  const openAccess = useCallback(async () => {
    await openKeychain();
  }, []);

  const { execute: loadExecute } = loadTask;
  const load = useCallback(async () => {
    await loadExecute();
  }, [loadExecute]);

  const { execute: searchExecute } = searchTask;
  const search = useCallback(
    async (q: string) => {
      await searchExecute(q);
    },
    [searchExecute],
  );

  // 首次挂载：仅当无缓存时才请求
  const hasCacheRef = useRef(cached !== null);
  useEffect(() => {
    if (!hasCacheRef.current) {
      void loadExecute();
    }
  }, [loadExecute]);

  const status =
    loadTask.status === "processing"
      ? "loading"
      : loadTask.status === "error"
        ? "error"
        : searchTask.status === "processing"
          ? "searching"
          : loadTask.status === "completed" || cached
            ? "loaded"
            : "idle";

  const error = loadTask.error || searchTask.error;

  return {
    result,
    keychains: result?.keychains ?? [],
    items,
    query,
    status,
    error,
    loading: loadTask.status === "processing",
    openAccess,
    load,
    search,
  };
}

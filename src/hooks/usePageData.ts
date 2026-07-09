import { useState, useEffect, useCallback, useRef } from "react";
import { cacheGet, cacheSet, cacheHas, cacheTimestamp } from "@/utils/cache";

/**
 * 跨页面导航数据缓存 hook
 *
 * 核心机制：使用模块级缓存（cache.ts），组件卸载后数据依然保留。
 * 重新挂载时，如果缓存有效则直接使用，不再调用 Rust 后端。
 *
 * @param key      缓存键
 * @param fetcher  数据获取函数
 * @param ttl      缓存有效期（毫秒），默认 5 分钟
 *
 * @returns { data, loading, error, refresh, lastFetch }
 *   - data:     缓存或新获取的数据
 *   - loading:  是否正在获取
 *   - error:    错误信息
 *   - refresh:  手动刷新（忽略缓存，强制重新获取）
 *   - lastFetch: 上次获取时间戳
 */
export function usePageData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = 5 * 60_000,
): {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  lastFetch: number | null;
} {
  // 初始化：优先使用缓存
  const cached = cacheGet<T>(key);
  const [data, setData] = useState<T | null>(cached);
  const [loading, setLoading] = useState<boolean>(cached === null);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<number | null>(
    cached !== null ? cacheTimestamp(key) : null,
  );

  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // 首次挂载：如果缓存有效则不请求
  useEffect(() => {
    if (cacheHas(key)) {
      const cachedData = cacheGet<T>(key);
      if (cachedData !== null) {
        setData(cachedData);
        setLoading(false);
        setLastFetch(cacheTimestamp(key));
        return;
      }
    }
    // 无缓存，执行请求
    void doFetch(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const doFetch = useCallback(
    async (force: boolean) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      if (force) {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await fetcher();
        cacheSet(key, result, ttl);
        if (mountedRef.current) {
          setData(result);
          setLoading(false);
          setLastFetch(Date.now());
        }
      } catch (e) {
        if (mountedRef.current) {
          setError(String(e));
          setLoading(false);
        }
      } finally {
        fetchingRef.current = false;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key, ttl],
  );

  const refresh = useCallback(async () => {
    await doFetch(true);
  }, [doFetch]);

  return { data, loading, error, refresh, lastFetch };
}

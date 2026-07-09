/**
 * 模块级内存缓存 — 数据在组件卸载后依然保留
 * 支持自定义 TTL（默认 5 分钟）
 */
const store = new Map<string, { data: unknown; ts: number; ttl: number }>();

/** 默认 TTL: 5 分钟 */
const DEFAULT_TTL = 5 * 60_000;

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > entry.ttl) {
    store.delete(key);
    return null;
  }
  return entry.data as T;
}

export function cacheSet<T>(key: string, data: T, ttl: number = DEFAULT_TTL): void {
  store.set(key, { data, ts: Date.now(), ttl });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

/** 检查缓存是否存在（不检查 TTL，用于判断是否已有数据） */
export function cacheHas(key: string): boolean {
  return store.has(key);
}

/** 获取缓存的原始时间戳 */
export function cacheTimestamp(key: string): number | null {
  const entry = store.get(key);
  return entry ? entry.ts : null;
}

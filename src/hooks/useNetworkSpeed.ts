import { useState, useCallback, useEffect, useRef } from "react";
import {
  getNetworkStatus,
  startSpeedTest,
  stopSpeedTest,
  onSpeedTestProgress,
} from "@/services/networkService";
import type {
  NetworkStatus,
  SpeedTestResult,
  SpeedTestProgressEvent,
} from "@/types/network";
import { TaskStatus } from "@/types/common";
import { useAsyncTask } from "./useAsyncTask";
import { cacheGet, cacheSet } from "@/utils/cache";

const CACHE_KEY = "network:status";
/** 网络状态缓存 30 秒 */
const CACHE_TTL = 30_000;

export interface UseNetworkSpeedReturn {
  networkStatus: NetworkStatus | null;
  speedTestResult: SpeedTestResult | null;
  progress: SpeedTestProgressEvent | null;
  status: TaskStatus;
  error: string | null;
  refreshStatus: () => Promise<void>;
  startTest: () => Promise<void>;
  stopTest: () => Promise<void>;
  reset: () => void;
}

export function useNetworkSpeed(): UseNetworkSpeedReturn {
  // 初始化：优先使用缓存
  const cached = cacheGet<NetworkStatus>(CACHE_KEY);
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus | null>(cached ?? null);
  const [progress, setProgress] = useState<SpeedTestProgressEvent | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    // 仅当无缓存时才请求
    if (!cached) {
      getNetworkStatus().then((result) => {
        if (mountedRef.current) {
          setNetworkStatus(result);
          cacheSet(CACHE_KEY, result, CACHE_TTL);
        }
      }).catch(() => {});
    }
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const result = await getNetworkStatus();
      if (mountedRef.current) {
        setNetworkStatus(result);
        cacheSet(CACHE_KEY, result, CACHE_TTL);
      }
    } catch { /* ignore */ }
  }, []);

  const testTask = useAsyncTask(async () => {
    setProgress(null);
    const unlisten = await onSpeedTestProgress((event) => setProgress(event));
    try {
      return await startSpeedTest();
    } finally {
      unlisten();
    }
  });

  const startTest = useCallback(async () => {
    await testTask.execute();
  }, [testTask.execute]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopTest = useCallback(async () => {
    await stopSpeedTest();
    testTask.reset();
  }, [testTask.reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = useCallback(() => {
    testTask.reset();
    setProgress(null);
  }, [testTask.reset]); // eslint-disable-line react-hooks/exhaustive-deps

  const status =
    testTask.status === TaskStatus.Processing ? TaskStatus.Processing
    : testTask.status === TaskStatus.Error ? TaskStatus.Error
    : testTask.status === TaskStatus.Completed ? TaskStatus.Completed
    : TaskStatus.Idle;

  return {
    networkStatus,
    speedTestResult: testTask.result,
    progress,
    status,
    error: testTask.error,
    refreshStatus,
    startTest,
    stopTest,
    reset,
  };
}

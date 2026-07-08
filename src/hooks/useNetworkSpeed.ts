/**
 * 网络测速 Hook
 */
import { useState, useCallback, useRef, useEffect } from "react";
import {
  getNetworkStatus,
  startSpeedTest,
  stopSpeedTest,
  onSpeedTestProgress,
} from "@/services/networkService";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type {
  NetworkStatus,
  SpeedTestResult,
  SpeedTestProgressEvent,
} from "@/types/network";
import { TaskStatus } from "@/types/common";

/** 网络测速 Hook 返回值 */
export interface UseNetworkSpeedReturn {
  /** 网络状态 */
  networkStatus: NetworkStatus | null;
  /** 测速结果 */
  speedTestResult: SpeedTestResult | null;
  /** 测速进度 */
  progress: SpeedTestProgressEvent | null;
  /** 任务状态 */
  status: TaskStatus;
  /** 错误信息 */
  error: string | null;
  /** 刷新网络状态 */
  refreshStatus: () => Promise<void>;
  /** 开始测速 */
  startTest: () => Promise<void>;
  /** 停止测速 */
  stopTest: () => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/** 网络测速 Hook */
export function useNetworkSpeed(): UseNetworkSpeedReturn {
  const [networkStatus, setNetworkStatus] =
    useState<NetworkStatus | null>(null);
  const [speedTestResult, setSpeedTestResult] =
    useState<SpeedTestResult | null>(null);
  const [progress, setProgress] = useState<SpeedTestProgressEvent | null>(null);
  const [status, setStatus] = useState<TaskStatus>(TaskStatus.Idle);
  const [error, setError] = useState<string | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  // 页面加载时自动检测网络状态
  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 刷新网络状态 */
  const refreshStatus = useCallback(async () => {
    console.log("[useNetworkSpeed] 刷新网络状态...");
    try {
      const result = await getNetworkStatus();
      console.log("[useNetworkSpeed] 网络状态:", result.connectionState);
      setNetworkStatus(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[useNetworkSpeed] 刷新网络状态失败:", msg);
      setError(msg);
    }
  }, []);

  /** 开始测速 */
  const startTest = useCallback(async () => {
    console.log("[useNetworkSpeed] 开始测速...");
    setStatus(TaskStatus.Processing);
    setError(null);
    setSpeedTestResult(null);
    setProgress(null);

    // 先清理上一次监听
    if (unlistenRef.current) {
      unlistenRef.current();
      unlistenRef.current = null;
    }

    try {
      unlistenRef.current = await onSpeedTestProgress((event) => {
        setProgress(event);
      });

      const result = await startSpeedTest();
      console.log("[useNetworkSpeed] 测速完成:", result);
      setSpeedTestResult(result);
      setStatus(TaskStatus.Completed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[useNetworkSpeed] 测速失败:", msg);
      setError(msg);
      setStatus(TaskStatus.Error);
    } finally {
      if (unlistenRef.current) {
        unlistenRef.current();
        unlistenRef.current = null;
      }
    }
  }, []);

  /** 停止测速 */
  const stopTest = useCallback(async () => {
    try {
      await stopSpeedTest();
      setStatus(TaskStatus.Idle);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  /** 重置状态 */
  const reset = useCallback(() => {
    setNetworkStatus(null);
    setSpeedTestResult(null);
    setProgress(null);
    setStatus(TaskStatus.Idle);
    setError(null);
  }, []);

  return {
    networkStatus,
    speedTestResult,
    progress,
    status,
    error,
    refreshStatus,
    startTest,
    stopTest,
    reset,
  };
}

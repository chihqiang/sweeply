/**
 * 网络测速页面
 */
import { useNetworkSpeed } from "@/hooks/useNetworkSpeed";
import {
  Button,
  Card,
  ProgressBar,
  StatusBadge,
} from "@/components/ui";
import { formatSpeed } from "@/utils/format";
import { TaskStatus } from "@/types/common";
import type { SpeedTestPhase } from "@/types/network";
import {
  Gauge,
  Play,
  StopCircle,
  ArrowDown,
  ArrowUp,
  Wifi,
  WifiOff,
  AlertCircle,
  Activity,
} from "lucide-react";

/** 页面标题 */
const PAGE_TITLE = "网络测速";
const PAGE_DESCRIPTION = "测试网络下载、上传速度及延迟";

/** 测速阶段显示名称映射 */
const PHASE_LABELS: Record<SpeedTestPhase, string> = {
  latency: "延迟测试",
  download: "下载测速",
  upload: "上传测速",
  done: "已完成",
};

/** 网络测速页面组件 */
export default function NetworkSpeedPage() {
  const {
    networkStatus,
    speedTestResult,
    progress,
    status,
    error,
    refreshStatus,
    startTest,
    stopTest,
    reset,
  } = useNetworkSpeed();

  const isTesting = status === TaskStatus.Processing;
  const isConnected =
    networkStatus?.connectionState === "connected";

  return (
    <div className="flex h-full flex-col p-6">
      {/* 页头 */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Gauge className="h-6 w-6 text-blue-500" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">
            {PAGE_TITLE}
          </h1>
        </div>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {PAGE_DESCRIPTION}
        </p>
      </div>

      {/* 错误提示 */}
      {error && (
        <Card className="mb-4 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">{error}</span>
          </div>
        </Card>
      )}

      {/* 网络连接状态 */}
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isConnected ? (
              <Wifi className="h-5 w-5 text-green-500" />
            ) : (
              <WifiOff className="h-5 w-5 text-red-500" />
            )}
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              网络状态
            </span>
            <StatusBadge color={isConnected ? "green" : networkStatus ? "red" : "gray"}>
              {isConnected ? "已连接" : networkStatus ? "未连接" : "未检测"}
            </StatusBadge>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void refreshStatus()}
          >
            刷新
          </Button>
        </div>
        {networkStatus && networkStatus.interfaces.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {networkStatus.interfaces
              .filter((iface) => iface.isActive)
              .map((iface) => (
                <div
                  key={iface.name}
                  className="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-700/50"
                >
                  <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                    {iface.name}
                  </p>
                  <p className="text-xs text-gray-400">{iface.ipAddress}</p>
                </div>
              ))}
          </div>
        )}
      </Card>

      {/* 测速操作区 */}
      <Card className="mb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-blue-500" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
              测速
            </span>
          </div>
          <div className="flex items-center gap-2">
            {!isTesting ? (
              <Button
                onClick={() => void startTest()}
                disabled={!isConnected}
              >
                <Play className="h-4 w-4" />
                开始测速
              </Button>
            ) : (
              <Button variant="danger" onClick={() => void stopTest()}>
                <StopCircle className="h-4 w-4" />
                停止
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={reset}>
              重置
            </Button>
          </div>
        </div>

        {/* 测速进度 */}
        {isTesting && progress && (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-300">
                {PHASE_LABELS[progress.phase] ?? "测试中..."}
              </span>
              <span className="text-sm font-medium text-blue-500">
                {formatSpeed(progress.currentSpeed)}
              </span>
            </div>
            <ProgressBar
              value={progress.progress}
              className="mt-2"
              showLabel
            />
          </div>
        )}
      </Card>

      {/* 测速结果 */}
      {speedTestResult && (
        <div className="grid grid-cols-2 gap-4">
          {/* 下载速度 */}
          <Card>
            <div className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                下载速度
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
              {formatSpeed(speedTestResult.downloadSpeed)}
            </p>
          </Card>

          {/* 上传速度 */}
          <Card>
            <div className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                上传速度
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
              {formatSpeed(speedTestResult.uploadSpeed)}
            </p>
          </Card>

          {/* 延迟 */}
          <Card>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-yellow-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                延迟
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
              {speedTestResult.latency.toFixed(0)}
              <span className="ml-1 text-sm font-normal text-gray-400">
                ms
              </span>
            </p>
          </Card>

          {/* 抖动 */}
          <Card>
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-purple-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                抖动 / 丢包率
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
              {speedTestResult.jitter.toFixed(1)}
              <span className="ml-1 text-sm font-normal text-gray-400">
                ms
              </span>
              <span className="ml-3 text-sm font-normal text-gray-400">
                / {speedTestResult.packetLoss.toFixed(1)}%
              </span>
            </p>
          </Card>
        </div>
      )}

      {/* 实时速度监控 */}
      {networkStatus && !speedTestResult && !isTesting && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <div className="flex items-center gap-2">
              <ArrowDown className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                当前下载
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
              {formatSpeed(networkStatus.currentDownloadSpeed)}
            </p>
          </Card>
          <Card>
            <div className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-blue-500" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                当前上传
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold text-gray-800 dark:text-gray-100">
              {formatSpeed(networkStatus.currentUploadSpeed)}
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}

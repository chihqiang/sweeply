import { useCallback, useEffect, useRef, useState } from "react";
import { useNetworkSpeed } from "@/hooks/useNetworkSpeed";
import { useSmoothProgress } from "@/hooks/useSmoothProgress";
import { useSpeedHistory } from "@/hooks/useSpeedHistory";
import { Button, StatusBadge, CircularProgress, useToast, Tooltip, PageContainer, PageHeader, ErrorAlert } from "@/components/ui";
import { formatSpeed } from "@/utils/format";
import { TaskStatus } from "@/types/common";
import { Gauge, Play, StopCircle, Wifi, WifiOff, RefreshCw, ArrowDown, ArrowUp, Activity, Clock, Trash } from "lucide-react";
import { cn } from "@/utils/cn";
import type { SpeedTestPhase } from "@/types/network";

export default function NetworkSpeedPage() {
  const { networkStatus, speedTestResult, progress, status, error, refreshStatus, startTest, stopTest, reset } = useNetworkSpeed();
  const { addToast } = useToast();
  const { history, addEntry, clearHistory } = useSpeedHistory();
  const testing = status === TaskStatus.Processing;
  const connected = networkStatus?.connectionState === "connected";

  const smoothProgress = useSmoothProgress(testing ? (progress?.progress ?? 0) : null);
  const currentSpeed = progress?.currentSpeed ?? 0;
  const currentPhase = progress?.phase;
  const currentDirection = progress?.direction;

  const prevResultRef = useRef(speedTestResult);
  useEffect(() => {
    if (speedTestResult && speedTestResult !== prevResultRef.current) {
      addEntry(speedTestResult);
    }
    prevResultRef.current = speedTestResult;
  }, [speedTestResult, addEntry]);

  const handleStart = useCallback(async () => {
    try { await startTest(); } catch { addToast({ type: "error", message: "测速失败" }); }
  }, [startTest, addToast]);

  const handleRefresh = useCallback(async () => {
    try { await refreshStatus(); } catch { addToast({ type: "error", message: "刷新失败" }); }
  }, [refreshStatus, addToast]);

  // #27: 阶段时间线
  const phases: { key: SpeedTestPhase; label: string }[] = [
    { key: "latency" as SpeedTestPhase, label: "延迟" },
    { key: "download" as SpeedTestPhase, label: "下载" },
    { key: "upload" as SpeedTestPhase, label: "上传" },
  ];
  const currentPhaseIndex = currentPhase ? phases.findIndex((p) => p.key === currentPhase) : -1;

  return (
    <PageContainer maxWidth="3xl">
      {/* Header */}
      <PageHeader title="网络测速" description="测试网络下载和上传速度" />

      {error && <ErrorAlert message={error} />}

      {/* Network Status Card */}
      <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${connected ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"}`}>
              {connected ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">网络状态</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{connected ? "已连接" : networkStatus ? "未连接" : "未检测"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={connected ? "success" : networkStatus ? "error" : "idle"} label={connected ? "已连接" : networkStatus ? "未连接" : "未检测"} />
            <Button variant="ghost" size="icon" onClick={handleRefresh} aria-label="刷新网络状态"><RefreshCw className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        {networkStatus && networkStatus.interfaces.filter((i) => i.isActive).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {networkStatus.interfaces.filter((i) => i.isActive).map((iface) => (
              <div key={iface.name} className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs dark:bg-gray-700/40">
                <span className="font-medium text-gray-700 dark:text-gray-300">{iface.name}</span>
                <span className="ml-2 text-gray-500 dark:text-gray-400">{iface.ipAddress}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DNS 刷新 */}
      <div className="mb-5 rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700/30 dark:bg-gray-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-4 w-4 text-gray-400" />
            <div>
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">DNS 缓存</p>
              <p className="text-xs text-gray-400">清除本地 DNS 解析缓存</p>
            </div>
          </div>
          <DnsFlushButton />
        </div>
      </div>

      {/* Speed Gauge - Main Visual */}
      <div className="mb-5 flex flex-col items-center rounded-2xl border border-gray-100 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
        {testing ? (
          <div className="flex flex-col items-center animate-fade-in">
            <CircularProgress
              value={smoothProgress}
              size={200}
              strokeWidth={12}
            >
              <div className="flex flex-col items-center">
                <span className="text-4xl font-bold gradient-text">{formatSpeed(currentSpeed)}</span>
                <span className="mt-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  {currentPhase === "latency" ? "延迟测试" : currentPhase === "download" ? "下载测速" : currentPhase === "upload" ? "上传测速" : "测试中..."}
                </span>
              </div>
            </CircularProgress>
            {/* #27: 阶段时间线替代进度条 */}
            <div className="mt-5 flex items-center gap-2">
              {phases.map((phase, idx) => (
                <div key={phase.key} className="flex items-center gap-2">
                  <div className={cn(
                    "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    idx < currentPhaseIndex && "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
                    idx === currentPhaseIndex && "bg-indigo-500 text-white",
                    idx > currentPhaseIndex && "bg-gray-50 text-gray-400 dark:bg-gray-700/40",
                  )}>
                    {idx < currentPhaseIndex && <span>✓</span>}
                    {phase.label}
                  </div>
                  {idx < phases.length - 1 && (
                    <div className={cn("h-px w-4", idx < currentPhaseIndex ? "bg-green-300" : "bg-gray-200 dark:bg-gray-700")} />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
              {currentDirection === "download" ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />}
              {currentPhase === "latency" ? "正在测试延迟" : `${currentDirection === "download" ? "下载" : "上传"}测速中`}
            </div>
          </div>
        ) : speedTestResult ? (
          /* #23: 测速完成后同时展示下载和上传 */
          <div className="flex flex-col items-center animate-fade-in">
            <div className="flex items-center gap-8">
              <CircularProgress value={1} size={160} strokeWidth={10}>
                <div className="flex flex-col items-center">
                  <ArrowDown className="mb-1 h-4 w-4 text-indigo-500" />
                  <span className="text-2xl font-bold gradient-text">{formatSpeed(speedTestResult.downloadSpeed)}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">下载</span>
                </div>
              </CircularProgress>
              <div className="h-20 w-px bg-gray-100 dark:bg-gray-700" />
              <CircularProgress value={1} size={160} strokeWidth={10}>
                <div className="flex flex-col items-center">
                  <ArrowUp className="mb-1 h-4 w-4 text-purple-500" />
                  <span className="text-2xl font-bold gradient-text">{formatSpeed(speedTestResult.uploadSpeed)}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">上传</span>
                </div>
              </CircularProgress>
            </div>
            <p className="mt-5 text-sm text-green-600 dark:text-green-400">测速完成</p>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-fade-in">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-500 shadow-xl shadow-indigo-500/30">
              <Gauge className="h-10 w-10 text-white" />
            </div>
            <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">准备开始测速</h2>
            <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">点击下方按钮开始测试网络速度</p>
          </div>
        )}

        {/* Action buttons — #25: 未连接时加 tooltip */}
        <div className="mt-6 flex items-center gap-3">
          {!testing ? (
            connected ? (
              <Button onClick={handleStart} size="lg">
                <Play className="h-4 w-4" />
                开始测速
              </Button>
            ) : (
              <Tooltip content="请先连接网络后再进行测速">
                <span>
                  <Button onClick={handleStart} disabled size="lg">
                    <Play className="h-4 w-4" />
                    开始测速
                  </Button>
                </span>
              </Tooltip>
            )
          ) : (
            <Button variant="danger" size="lg" onClick={() => void stopTest()}>
              <StopCircle className="h-4 w-4" />
              停止
            </Button>
          )}
          {(speedTestResult || testing) && (
            <Button variant="outline" size="lg" onClick={reset}>重置</Button>
          )}
        </div>
      </div>

      {/* #24: 实时速度卡片 — 允许与测速结果共存 */}
      {networkStatus && (
        <div className="mb-5 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
            <div className="mb-2 flex items-center justify-center gap-1.5">
              <ArrowDown className="h-3.5 w-3.5 text-indigo-500" />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">当前下载</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatSpeed(networkStatus.currentDownloadSpeed)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
            <div className="mb-2 flex items-center justify-center gap-1.5">
              <ArrowUp className="h-3.5 w-3.5 text-purple-500" />
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">当前上传</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{formatSpeed(networkStatus.currentUploadSpeed)}</p>
          </div>
        </div>
      )}

      {/* Test results - detailed */}
      {speedTestResult && (
        <div className="grid grid-cols-2 gap-4 animate-fade-in-up">
          <div className="rounded-2xl border border-indigo-100/60 bg-indigo-50/30 p-5 shadow-sm dark:border-indigo-800/30 dark:bg-indigo-900/20">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                <ArrowDown className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">下载速度</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatSpeed(speedTestResult.downloadSpeed)}</p>
          </div>
          <div className="rounded-2xl border border-purple-100/60 bg-purple-50/30 p-5 shadow-sm dark:border-purple-800/30 dark:bg-purple-900/20">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                <ArrowUp className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">上传速度</p>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatSpeed(speedTestResult.uploadSpeed)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700/40">
                <Activity className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">延迟</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {speedTestResult.latency.toFixed(0)} <span className="text-base font-normal text-gray-400">ms</span>
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-700/40">
                <Gauge className="h-4 w-4" />
              </div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">抖动 / 丢包</p>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {speedTestResult.jitter.toFixed(1)} <span className="text-base font-normal text-gray-400">ms</span>
              <span className="ml-2 text-base font-normal text-gray-400">/ {speedTestResult.packetLoss.toFixed(1)}%</span>
            </p>
          </div>
        </div>
      )}

      {/* #26: 测速历史记录 */}
      {history.length > 0 && (
        <div className="mt-5 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">测速历史</p>
            </div>
            <button
              onClick={clearHistory}
              className="flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-red-500"
              aria-label="清空历史"
            >
              <Trash className="h-3 w-3" />
              清空
            </button>
          </div>
          <div className="space-y-2">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-xs dark:bg-gray-700/30">
                <span className="text-gray-500 dark:text-gray-400">
                  {new Date(entry.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                </span>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                    <ArrowDown className="h-3 w-3 text-indigo-400" />
                    {formatSpeed(entry.downloadSpeed)}
                  </span>
                  <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                    <ArrowUp className="h-3 w-3 text-purple-400" />
                    {formatSpeed(entry.uploadSpeed)}
                  </span>
                  <span className="text-gray-400">{entry.latency.toFixed(0)}ms</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </PageContainer>
  );
}

function DnsFlushButton() {
  const [status, setStatus] = useState<"idle" | "flushing" | "done" | "error">("idle");
  return (
    <button
      onClick={async () => {
        setStatus("flushing");
        try {
          const { flushDns } = await import("@/services/systemService");
          await flushDns();
          setStatus("done");
          setTimeout(() => setStatus("idle"), 2000);
        } catch {
          setStatus("error");
          setTimeout(() => setStatus("idle"), 2000);
        }
      }}
      disabled={status === "flushing"}
      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        status === "done"
          ? "bg-emerald-500 text-white"
          : status === "error"
            ? "bg-red-500 text-white"
            : "bg-gray-900 text-white hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
      }`}
    >
      {status === "flushing" ? "刷新中..." : status === "done" ? "已清除" : status === "error" ? "失败" : "立即刷新"}
    </button>
  );
}

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Monitor,
  Cpu,
  HardDrive,
  BatteryFull,
  BatteryLow,
  BatteryWarning,
  Info,
  Clock,
  RefreshCw,
  Activity,
} from "lucide-react";
import type { SystemInfo, VolumeInfo } from "@/types/system";
import { getSystemInfo } from "@/services/systemService";
import { PageContainer, PageHeader, PageLoading, Button } from "@/components/ui";
import { formatFileSize } from "@/utils/format";
import { cacheGet, cacheSet } from "@/utils/cache";

const CACHE_KEY = "systemInfo:data";
/** 系统信息缓存 30 秒（硬件信息不常变，但 CPU/内存等需要刷新） */
const CACHE_TTL = 30_000;

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d} 天`);
  if (h > 0) parts.push(`${h} 小时`);
  parts.push(`${m} 分钟`);
  return parts.join(" ");
}

function DiskBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          pct > 90
            ? "bg-red-500"
            : pct > 75
              ? "bg-yellow-500"
              : "bg-blue-500"
        }`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function MemoryBar({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
      <div
        className={`h-full rounded-full transition-all duration-500 ${
          pct > 90
            ? "bg-red-500"
            : pct > 75
              ? "bg-yellow-500"
              : "bg-emerald-500"
        }`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700/30 dark:bg-gray-800/50">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-gray-600 dark:text-gray-300">
        <Icon className="h-4 w-4" />
        {title}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">{label}</span>
      <span className="truncate text-right text-xs font-medium text-gray-700 dark:text-gray-200">{value}</span>
    </div>
  );
}

export default function SystemInfoPage() {
  // 初始化：优先使用缓存
  const cached = cacheGet<SystemInfo>(CACHE_KEY);
  const [info, setInfo] = useState<SystemInfo | null>(cached ?? null);
  const [loading, setLoading] = useState<boolean>(cached === null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasCacheRef = useRef(cached !== null);

  const fetchInfo = useCallback(async () => {
    try {
      const data = await getSystemInfo();
      setInfo(data);
      setError(null);
      cacheSet(CACHE_KEY, data, CACHE_TTL);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 首次挂载：仅当无缓存时才请求；有缓存则直接展示，仅启动定时刷新
  useEffect(() => {
    if (!hasCacheRef.current) {
      Promise.resolve().then(() => fetchInfo());
    }
    // 定时刷新（3 秒），保持实时性但不重新全量加载
    const timer = setInterval(() => void fetchInfo(), 3000);
    return () => clearInterval(timer);
  }, [fetchInfo]);

  if (loading) {
    return <PageLoading label="加载系统信息..." />;
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-500">加载失败</p>
          <p className="mt-1 text-xs text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!info) return null;

  const primaryVolume = info.volumes.find(
    (v: VolumeInfo) => v.mountPoint === "/",
  ) ?? info.volumes[0];

  return (
    <PageContainer>
        <PageHeader
          title="系统信息"
          description="查看 Mac 硬件配置和系统运行状态"
          badge={
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400">
              <Activity className="h-3 w-3 animate-pulse" />
              实时
            </span>
          }
          actions={
            <Button variant="outline" size="sm" onClick={() => { setRefreshing(true); void fetchInfo(); }} disabled={refreshing} loading={refreshing}>
              <RefreshCw className="h-3.5 w-3.5" />
              {refreshing ? "刷新中" : "刷新"}
            </Button>
          }
        />

      <div className="grid gap-4 sm:grid-cols-2">
        {/* 硬件信息 */}
        <SectionCard icon={Monitor} title="硬件信息">
          <InfoRow label="型号" value={info.modelName} />
          <InfoRow label="标识符" value={info.modelIdentifier} />
          <InfoRow label="芯片" value={info.chip} />
          <InfoRow label="物理核心" value={`${info.physicalCores}`} />
          <InfoRow label="逻辑核心" value={`${info.logicalCores}`} />
          <InfoRow label="主机名" value={info.hostName} />
        </SectionCard>

        {/* 系统信息 */}
        <SectionCard icon={Info} title="系统信息">
          <InfoRow label="系统版本" value={info.osVersion} />
          <InfoRow label="构建版本" value={info.osBuild} />
          <InfoRow label="内核版本" value={`${info.kernelVersion}`} />
          <div className="flex items-baseline justify-between gap-4">
            <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">运行时间</span>
            <span className="flex items-center gap-1 text-xs font-medium text-gray-700 dark:text-gray-200">
              <Clock className="h-3 w-3" />
              {formatUptime(info.uptimeSeconds)}
            </span>
          </div>
        </SectionCard>

        {/* CPU */}
        <SectionCard icon={Cpu} title="CPU">
          <div className="flex items-baseline justify-between gap-4">
            <span className="shrink-0 text-xs text-gray-400 dark:text-gray-500">使用率</span>
            <span className="text-lg font-semibold text-gray-700 dark:text-gray-200">
              {info.cpuUsage.toFixed(1)}%
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${Math.min(info.cpuUsage, 100)}%` }}
            />
          </div>
        </SectionCard>

        {/* 内存 */}
        <SectionCard icon={Cpu} title="内存">
          <InfoRow label="总量" value={formatFileSize(info.totalMemory)} />
          <InfoRow label="已用" value={formatFileSize(info.usedMemory)} />
          <InfoRow
            label="可用"
            value={formatFileSize(info.totalMemory - info.usedMemory)}
          />
          <MemoryBar used={info.usedMemory} total={info.totalMemory} />
        </SectionCard>

        {/* 电池 */}
        {info.battery && (
          <SectionCard
            icon={
              info.battery.chargePercent > 80
                ? BatteryFull
                : info.battery.chargePercent > 30
                  ? BatteryLow
                  : BatteryWarning
            }
            title={`电池${info.battery.isCharging ? " (充电中)" : ""}`}
          >
            <InfoRow label="电量" value={`${info.battery.chargePercent}%`} />
            {info.battery.cycleCount !== null && (
              <InfoRow label="循环次数" value={`${info.battery.cycleCount}`} />
            )}
            <InfoRow label="状态" value={info.battery.condition} />
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-700">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  info.battery.chargePercent > 80
                    ? "bg-emerald-500"
                    : info.battery.chargePercent > 30
                      ? "bg-yellow-500"
                      : "bg-red-500"
                }`}
                style={{ width: `${info.battery.chargePercent}%` }}
              />
            </div>
          </SectionCard>
        )}

        {/* 磁盘 */}
        {primaryVolume && (
          <SectionCard icon={HardDrive} title={`磁盘 (${primaryVolume.mountPoint})`}>
            <InfoRow label="总容量" value={formatFileSize(primaryVolume.totalSpace)} />
            <InfoRow label="已用" value={formatFileSize(primaryVolume.totalSpace - primaryVolume.availableSpace)} />
            <InfoRow label="可用" value={formatFileSize(primaryVolume.availableSpace)} />
            <DiskBar
              used={primaryVolume.totalSpace - primaryVolume.availableSpace}
              total={primaryVolume.totalSpace}
            />
          </SectionCard>
      )}
      </div>

      {/* 所有卷 */}
      {info.volumes.length > 1 && (
        <div className="mt-6 rounded-xl border border-gray-100 bg-white p-5 dark:border-gray-700/30 dark:bg-gray-800/50">
          <div className="mb-4 text-sm font-semibold text-gray-600 dark:text-gray-300">所有卷</div>
          <div className="space-y-3">
            {info.volumes.map((v: VolumeInfo) => (
              <div key={v.mountPoint}>
                <div className="mb-1 flex items-baseline justify-between text-xs">
                  <span className="font-medium text-gray-700 dark:text-gray-200">
                    {v.mountPoint === "/" ? "系统卷" : v.mountPoint}
                  </span>
                  <span className="text-gray-400">
                    {formatFileSize(v.availableSpace)} / {formatFileSize(v.totalSpace)}
                  </span>
                </div>
                <DiskBar
                  used={v.totalSpace - v.availableSpace}
                  total={v.totalSpace}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </PageContainer>
  );
}

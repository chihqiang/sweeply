import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useToast, Button, Dialog, EmptyState, PageContainer, PageHeader, PageLoading, SearchInput, ErrorAlert } from "@/components/ui";
import { listListeningPorts, killProcess } from "@/services/portService";
import type { ListeningPort, PortProtocol } from "@/types/ports";
import { Network, RefreshCw, Copy, OctagonX } from "lucide-react";

type ProtocolFilter = "all" | PortProtocol;

export default function PortsPage() {
  const [ports, setPorts] = useState<ListeningPort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [protocol, setProtocol] = useState<ProtocolFilter>("all");
  const [killTarget, setKillTarget] = useState<ListeningPort | null>(null);
  const [killing, setKilling] = useState(false);
  const requestIdRef = useRef(0);
  const { addToast } = useToast();

  const fetchPorts = useCallback(async () => {
    const id = ++requestIdRef.current;
    setLoading(true);
    try {
      const result = await listListeningPorts();
      if (id !== requestIdRef.current) return;
      setError(null);
      setPorts(result);
    } catch (e) {
      if (id !== requestIdRef.current) return;
      setError(String(e));
    } finally {
      if (id === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 延迟到微任务，避免在 effect 内同步调用会 setState 的函数触发级联渲染（与 LoginItemsPage 一致）
    Promise.resolve().then(() => void fetchPorts());
  }, [fetchPorts]);

  const handleCopy = useCallback(
    async (p: ListeningPort) => {
      try {
        await navigator.clipboard.writeText(String(p.port));
        addToast({ type: "success", message: `已复制端口 ${p.port}` });
      } catch (e) {
        addToast({ type: "error", message: `复制失败: ${e}` });
      }
    },
    [addToast],
  );

  const handleKill = useCallback(async () => {
    if (!killTarget) return;
    const target = killTarget;
    setKillTarget(null);
    setKilling(true);
    try {
      await killProcess(target.pid);
      addToast({ type: "success", message: `已结束进程 "${target.process}" (PID ${target.pid})` });
      await fetchPorts();
    } catch (e) {
      addToast({ type: "error", message: `结束进程失败: ${e}` });
    } finally {
      setKilling(false);
    }
  }, [killTarget, addToast, fetchPorts]);

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return ports.filter((p) => {
      if (protocol !== "all" && p.protocol !== protocol) return false;
      if (!kw) return true;
      return (
        String(p.port).includes(kw) ||
        p.address.toLowerCase().includes(kw) ||
        p.process.toLowerCase().includes(kw) ||
        String(p.pid).includes(kw)
      );
    });
  }, [ports, search, protocol]);

  const tcpCount = useMemo(() => ports.filter((p) => p.protocol === "tcp").length, [ports]);
  const udpCount = ports.length - tcpCount;

  const protocolStyles: Record<PortProtocol, string> = {
    tcp: "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400",
    udp: "bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400",
  };

  return (
    <PageContainer maxWidth="4xl">
      <PageHeader
        title="网络端口"
        description="查看本机所有监听中的端口及占用进程"
      />

      {error && <ErrorAlert message={error} />}

      {loading && ports.length === 0 ? (
        <PageLoading label="正在获取端口列表..." />
      ) : (
        <>
          {/* 工具栏 */}
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800">
              {(["all", "tcp", "udp"] as const).map((key) => (
                <button
                  key={key}
                  onClick={() => setProtocol(key)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    protocol === key
                      ? "bg-white text-gray-800 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {key === "all"
                    ? `全部 ${ports.length}`
                    : key === "tcp"
                      ? `TCP ${tcpCount}`
                      : `UDP ${udpCount}`}
                </button>
              ))}
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="搜索端口 / 地址 / 进程 / PID..."
              maxWidthClass="max-w-xs"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchPorts()}
              disabled={loading}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              {loading ? "刷新中..." : "刷新"}
            </Button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={Network}
              title={search || protocol !== "all" ? "没有匹配的端口" : "暂无监听端口"}
              description={search || protocol !== "all" ? "请尝试调整搜索关键词或协议筛选" : "本机当前没有处于监听状态的端口"}
            />
          ) : (
            <div className="space-y-2">
              {filtered.map((p) => (
                <div
                  key={`${p.protocol}-${p.address}-${p.pid}`}
                  className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-3.5 shadow-sm transition-colors hover:border-gray-200 dark:border-gray-700/30 dark:bg-gray-800/50 dark:hover:border-gray-600/50"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="w-[64px] shrink-0 font-mono text-base font-semibold text-gray-900 dark:text-gray-100">
                      {p.port}
                    </span>
                    <span className={`w-[52px] shrink-0 rounded-md px-2 py-0.5 text-center text-[11px] font-medium ${protocolStyles[p.protocol]}`}>
                      {p.protocol.toUpperCase()}
                    </span>
                    <span className="hidden min-w-0 max-w-[220px] truncate font-mono text-xs text-gray-500 dark:text-gray-400 sm:block">
                      {p.address}
                    </span>
                  </div>
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="min-w-0 text-right">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{p.process}</p>
                      <p className="text-xs text-gray-400">PID {p.pid}</p>
                    </div>
                    <span className={`w-[72px] shrink-0 rounded-md px-2 py-0.5 text-center text-[11px] font-medium ${
                      p.state === "listen"
                        ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400"
                    }`}>
                      {p.state}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleCopy(p)}
                      aria-label={`复制端口 ${p.port}`}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <button
                      onClick={() => setKillTarget(p)}
                      disabled={killing}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                    >
                      <OctagonX className="h-3.5 w-3.5" />
                      结束进程
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={killTarget !== null}
        onClose={() => setKillTarget(null)}
        onConfirm={() => void handleKill()}
        title={`结束进程 "${killTarget?.process ?? ""}"`}
        description={`确定要结束此进程吗？（PID ${killTarget?.pid}）它占用的端口将立即释放。`}
        confirmLabel="结束进程"
        loading={killing}
        danger
      />
    </PageContainer>
  );
}
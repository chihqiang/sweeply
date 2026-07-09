import { useState, useEffect, useCallback } from "react";
import { useToast, Button, EmptyState, Dialog, PageContainer, PageHeader, PageLoading, ErrorAlert } from "@/components/ui";
import { listLoginItems, addLoginItem, removeLoginItem, listBackgroundItems } from "@/services/loginItemService";
import type { LoginItem, BackgroundItem } from "@/types/loginItems";
import { LogIn, Plus, Trash2, RefreshCw, AppWindow, Cpu } from "lucide-react";
import { cacheGet, cacheSet, cacheDelete } from "@/utils/cache";

const CACHE_KEY = "loginItems:data";
/** 启动项缓存 5 分钟 */
const CACHE_TTL = 5 * 60_000;

interface LoginItemsCache {
  items: LoginItem[];
  bgItems: BackgroundItem[];
}

export default function LoginItemsPage() {
  // 初始化：优先使用缓存
  const cached = cacheGet<LoginItemsCache>(CACHE_KEY);
  const [items, setItems] = useState<LoginItem[]>(cached?.items ?? []);
  const [bgItems, setBgItems] = useState<BackgroundItem[]>(cached?.bgItems ?? []);
  const [loading, setLoading] = useState<boolean>(cached === null);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [removingTarget, setRemovingTarget] = useState<LoginItem | null>(null);
  const { addToast } = useToast();

  const fetchItems = useCallback(async (force: boolean = false) => {
    // 非强制刷新时，如果已有缓存数据则直接使用
    if (!force && (items.length > 0 || bgItems.length > 0)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [loginResult, bgResult] = await Promise.all([
        listLoginItems(),
        listBackgroundItems(),
      ]);
      setItems(loginResult);
      setBgItems(bgResult);
      cacheSet(CACHE_KEY, { items: loginResult, bgItems: bgResult }, CACHE_TTL);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [items.length, bgItems.length]);

  // 首次挂载：仅当无缓存时才请求
  useEffect(() => {
    if (cached === null) {
      void fetchItems(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        multiple: false,
        directory: false,
        title: "选择应用",
        filters: [{ name: "应用", extensions: ["app"] }],
      });
      if (selected) {
        await addLoginItem(selected as string);
        addToast({ type: "success", message: "已添加到启动项" });
        // 添加后强制刷新
        cacheDelete(CACHE_KEY);
        void fetchItems(true);
      }
    } catch (e) {
      addToast({ type: "error", message: `添加失败: ${e}` });
    }
  }, [fetchItems, addToast]);

  const handleRemove = useCallback(async () => {
    if (!removingTarget) return;
    const name = removingTarget.name;
    setRemovingTarget(null);
    setRemoving(name);
    try {
      await removeLoginItem(name);
      addToast({ type: "success", message: `已移除 "${name}"` });
      setItems((prev) => {
        const next = prev.filter((i) => i.name !== name);
        // 更新缓存
        cacheSet(CACHE_KEY, { items: next, bgItems }, CACHE_TTL);
        return next;
      });
    } catch (e) {
      addToast({ type: "error", message: `移除失败: ${e}` });
    } finally {
      setRemoving(null);
    }
  }, [removingTarget, addToast, bgItems]);

  const handleRefresh = useCallback(() => {
    void fetchItems(true);
  }, [fetchItems]);

  const hasData = items.length > 0 || bgItems.length > 0;

  return (
    <PageContainer maxWidth="3xl">
        <PageHeader
          title="启动项管理"
          description="管理开机自启的应用和后台运行进程"
        />

        {error && <ErrorAlert message={error} />}

        {/* 加载层：首次加载时全屏居中 */}
        {loading && !hasData ? (
          <PageLoading label="正在获取启动项列表..." />
        ) : (
          <>
            {/* 登录时打开 */}
            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <LogIn className="h-4 w-4 text-gray-400" />
                  <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">登录时打开</h2>
                  <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-gray-700/40 dark:text-gray-400">{items.length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={handleAdd} size="sm">
                    <Plus className="h-3.5 w-3.5" />
                    添加
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
                    <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </div>

              {items.length === 0 && !loading ? (
                <EmptyState icon={LogIn} title="暂无启动项" description={'点击"添加"将应用添加到开机自启'} />
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-3.5 shadow-sm transition-colors hover:border-gray-200 dark:border-gray-700/30 dark:bg-gray-800/50 dark:hover:border-gray-600/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-700/40">
                          {item.iconPath ? (
                            <img src={item.iconPath} alt="" className="h-9 w-9 rounded-xl object-contain" />
                          ) : (
                            <AppWindow className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{item.name}</p>
                          <p className="truncate text-xs text-gray-400">{item.path}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                          item.hidden
                            ? "bg-gray-100 text-gray-500 dark:bg-gray-700/40 dark:text-gray-400"
                            : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                        }`}>
                          {item.hidden ? "后台运行" : "允许在后台"}
                        </span>
                        <button
                          onClick={() => setRemovingTarget(item)}
                          disabled={removing === item.name}
                          className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {removing === item.name ? "移除中..." : "移除"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 允许在后台 */}
            <div>
              <div className="mb-4 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200">允许在后台</h2>
                <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-500 dark:bg-gray-700/40 dark:text-gray-400">{bgItems.length}</span>
              </div>

              {bgItems.length === 0 && !loading ? (
                <EmptyState icon={Cpu} title="暂无后台进程" description="后台运行的应用和系统服务会显示在这里" />
              ) : (
                <div className="space-y-1">
                  {bgItems.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-5 py-3 shadow-sm dark:border-gray-700/30 dark:bg-gray-800/50"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-700/40">
                          {item.iconPath ? (
                            <img src={item.iconPath} alt="" className="h-7 w-7 rounded-lg object-contain" />
                          ) : (
                            <Cpu className="h-4 w-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{item.label}</p>
                          <p className="text-xs text-gray-400">
                            {item.status}{item.pid ? ` · PID ${item.pid}` : ""}
                          </p>
                        </div>
                      </div>
                      <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                        item.pid
                          ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                          : "bg-gray-100 text-gray-400 dark:bg-gray-700/40"
                      }`}>
                        {item.pid ? "运行中" : "未运行"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

      <Dialog
        open={removingTarget !== null}
        onClose={() => setRemovingTarget(null)}
        onConfirm={handleRemove}
        title={`移除 "${removingTarget?.name ?? ""}"`}
        description="确定要将此应用从开机自启中移除吗？"
        confirmLabel="移除"
        danger
      />
    </PageContainer>
  );
}

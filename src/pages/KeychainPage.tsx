import { useMemo, useCallback, useState } from "react";
import { useKeychain } from "@/hooks/useKeychain";
import { Button, EmptyState, Card, PageContainer, PageHeader, ErrorAlert, SearchInput } from "@/components/ui";
import { KeyRound, Search, ExternalLink, Loader2, Lock, UnlockKeyhole, FileKey } from "lucide-react";

export default function KeychainPage() {
  const { result, keychains, items, status, error, loading, openAccess, load, search } = useKeychain();
  const [searchInput, setSearchInput] = useState("");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  // 注意：不再在每次挂载时调用 load()，由 hook 内部根据缓存决定是否需要请求

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      search(searchInput);
    },
    [searchInput, search],
  );

  const itemDetail = useMemo(() => {
    if (!selectedItem) return null;
    return items.find((i) => i.id === selectedItem) ?? null;
  }, [selectedItem, items]);

  return (
    <PageContainer>
        <PageHeader
          title="钥匙串管理"
          description="查看和管理 macOS 钥匙串条目"
          actions={
            <>
              <Button onClick={openAccess} size="md">
                <ExternalLink className="h-4 w-4" />
                打开钥匙串访问
              </Button>
              <Button variant="outline" onClick={load} loading={loading}>
                <Loader2 className="h-4 w-4" />
                刷新列表
              </Button>
            </>
          }
        />

      {error && (
        <ErrorAlert
          message={error}
          hint={error.includes("权限") || error.includes("denied") ? "请在 系统设置 → 隐私与安全性 → 辅助功能 中允许本应用" : ""}
        />
      )}

      {keychains.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">钥匙串文件</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {keychains.map((kc) => (
              <Card key={kc.path} className="flex items-center gap-3 p-3">
                {kc.status === "unlocked" ? (
                  <UnlockKeyhole className="h-5 w-5 text-green-500" />
                ) : (
                  <Lock className="h-5 w-5 text-gray-400" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{kc.name}</p>
                  <p className="truncate text-xs text-gray-400">{kc.path}</p>
                </div>
                <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                  kc.status === "unlocked" ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" : "bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                }`}>
                  {kc.status === "unlocked" ? "已解锁" : "未知"}
                </span>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
          搜索条目
          {result && <span className="ml-2 font-normal text-gray-400">（共 {result.totalItems} 条）</span>}
        </h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="输入关键词搜索密码、证书..."
            maxWidthClass="flex-1"
          />
          <Button type="submit" size="md" loading={status === "searching"}>
            <Search className="h-4 w-4" />
            搜索
          </Button>
        </form>
      </div>

      {items.length > 0 && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="space-y-1">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${
                    selectedItem === item.id ? "border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20" : "border-gray-100 dark:border-gray-700/50"
                  }`}
                  onClick={() => setSelectedItem(item.id)}
                >
                  <FileKey className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-gray-800 dark:text-gray-200">{item.title}</p>
                    <p className="truncate text-xs text-gray-400">
                      {item.account}
                      {item.serverOrService && ` · ${item.serverOrService}`}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-gray-50 px-1.5 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    {item.kind}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-1">
            {itemDetail ? (
              <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/50">
                <h3 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">详细信息</h3>
                <dl className="space-y-2 text-sm">
                  <div>
                    <dt className="text-gray-400">名称</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{itemDetail.title}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">类型</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{itemDetail.kind}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">账户</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{itemDetail.account || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">服务器/服务</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{itemDetail.serverOrService || "-"}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-400">修改时间</dt>
                    <dd className="text-gray-800 dark:text-gray-200">{itemDetail.modifiedDate || "-"}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-gray-200 p-6 dark:border-gray-700">
                <p className="text-xs text-gray-400">选择条目查看详情</p>
              </div>
            )}
          </div>
        </div>
      )}

      {status === "loaded" && items.length === 0 && searchInput && (
        <EmptyState icon={Search} title="未找到匹配条目" description="试试其他关键词" />
      )}

      {status === "loaded" && !searchInput && items.length === 0 && (
        <EmptyState icon={KeyRound} title="输入关键词搜索" description="输入关键词搜索钥匙串中的密码、证书等条目" />
      )}
    </PageContainer>
  );
}

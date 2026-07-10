import { useState, useEffect, useCallback } from "react";
import { useKeychain } from "@/hooks/useKeychain";
import { useDebounce } from "@/hooks/useDebounce";
import { Button, EmptyState, PageContainer, PageHeader, ErrorAlert, SearchInput, Dialog } from "@/components/ui";
import { KeyRound, Search, ExternalLink, Loader2, Eye, EyeOff, Copy, Trash2 } from "lucide-react";

export default function KeychainPage() {
  const { result, items, status, error, loading, openAccess, load, search, getPassword, deleteItem } = useKeychain();
  const [searchInput, setSearchInput] = useState("");
  const [passwords, setPasswords] = useState<Record<string, string>>({});
  const [passwordLoading, setPasswordLoading] = useState<string | null>(null);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; rawKind: string; service: string; account: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debouncedQuery = useDebounce(searchInput, 300);

  useEffect(() => {
    search(debouncedQuery);
  }, [debouncedQuery, search]);

  const handleRevealPassword = useCallback(async (id: string, rawKind: string, svc: string, acct: string) => {
    if (passwords[id]) return;
    setPasswordLoading(id);
    try {
      const pwd = await getPassword(rawKind, svc, acct);
      setPasswords(prev => ({ ...prev, [id]: pwd }));
      setVisiblePasswords(prev => ({ ...prev, [id]: true }));
    } catch {
      // password stays hidden on failure
    } finally {
      setPasswordLoading(null);
    }
  }, [passwords, getPassword]);

  const handleCopyPassword = useCallback(async (pwd: string) => {
    try { await navigator.clipboard.writeText(pwd); } catch {}
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteItem(deleteTarget.id, deleteTarget.rawKind, deleteTarget.service, deleteTarget.account);
      setPasswords(prev => { const n = { ...prev }; delete n[deleteTarget.id]; return n; });
    } catch {}
    setDeleting(false);
    setDeleteTarget(null);
  }, [deleteTarget, deleteItem]);

  // loading (idle/empty) state
  if (status === "loading" || status === "idle") {
    return (
      <PageContainer>
        <PageHeader
          title="钥匙串管理"
          description="查看和管理 macOS 钥匙串条目"
          actions={
            <Button onClick={openAccess} size="md">
              <ExternalLink className="h-4 w-4" />
              打开钥匙串访问
            </Button>
          }
        />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </PageContainer>
    );
  }

  // error state
  if (status === "error") {
    return (
      <PageContainer>
        <PageHeader
          title="钥匙串管理"
          description="查看和管理 macOS 钥匙串条目"
          actions={
            <Button onClick={openAccess} size="md">
              <ExternalLink className="h-4 w-4" />
              打开钥匙串访问
            </Button>
          }
        />
        <ErrorAlert
          message={error ?? "加载失败"}
          hint={error?.includes("权限") || error?.includes("denied") ? "请在 系统设置 → 隐私与安全性 → 辅助功能 中允许本应用" : ""}
        />
        <div className="mt-4 flex justify-center">
          <Button onClick={load} loading={loading}>重试</Button>
        </div>
      </PageContainer>
    );
  }

  // loaded state
  return (
    <PageContainer>
      <PageHeader
        title="钥匙串管理"
        description={`查看和管理 macOS 钥匙串条目（共 ${result?.totalItems ?? 0} 条）`}
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

      <div className="mb-6">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="搜索服务名称、账户..."
          maxWidthClass="max-w-md"
          searching={false}
        />
      </div>

      {items.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">服务</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">账户</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">类型</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400">密码</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 dark:text-gray-400">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900/50">
              {items.map((item) => {
                const pwd = passwords[item.id];
                const isLoading = passwordLoading === item.id;
                const isVisible = visiblePasswords[item.id];
                return (
                  <tr key={item.id} className="group hover:bg-gray-50 dark:hover:bg-gray-800/30">
                    <td className="max-w-[200px] truncate px-4 py-3 text-sm text-gray-800 dark:text-gray-200">
                      {item.title}
                    </td>
                    <td className="max-w-[140px] truncate px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                      {item.account || "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                        {item.kind}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {pwd ? (
                        <div className="flex items-center gap-2">
                          <span className="max-w-[180px] truncate font-mono text-sm text-gray-800 dark:text-gray-200">
                            {isVisible ? pwd : "••••••••"}
                          </span>
                          <button
                            onClick={() => setVisiblePasswords(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            className="shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                          ) : (
                            <span className="text-sm text-gray-300 dark:text-gray-600">已隐藏</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {pwd ? (
                          <button
                            onClick={() => handleCopyPassword(pwd)}
                            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                            title="复制密码"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleRevealPassword(item.id, item.rawKind, item.serverOrService, item.account)}
                            disabled={isLoading}
                            className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-indigo-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                          >
                            <Eye className="h-3 w-3" />
                            显示
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteTarget({ id: item.id, rawKind: item.rawKind, service: item.serverOrService, account: item.account, title: item.title })}
                          className="rounded p-1 text-gray-400 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100 dark:hover:text-red-400"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={searchInput ? Search : KeyRound}
          title={searchInput ? "未找到匹配条目" : "钥匙串中没有条目"}
          description={searchInput ? "试试其他关键词" : "钥匙串中可能没有保存任何密码或证书"}
        />
      )}
      {deleteTarget && (
        <Dialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title="删除钥匙串条目"
          description={`确定要删除 "${deleteTarget.title}" 吗？此操作不可撤销。`}
          confirmLabel="删除"
          cancelLabel="取消"
          danger
          loading={deleting}
        />
      )}
    </PageContainer>
  );
}

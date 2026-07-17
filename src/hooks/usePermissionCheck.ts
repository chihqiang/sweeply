import { useState, useCallback, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

/**
 * 权限状态
 */
export interface PermissionStatus {
  hasFullDiskAccess: boolean;
  canAccessDesktop: boolean;
  canAccessDownloads: boolean;
  canAccessDocuments: boolean;
  canAccessLibrary: boolean;
  missingPermissions: string[];
}

const DEFAULT_STATUS: PermissionStatus = {
  hasFullDiskAccess: true,
  canAccessDesktop: true,
  canAccessDownloads: true,
  canAccessDocuments: true,
  canAccessLibrary: true,
  missingPermissions: [],
};

/**
 * 权限检查 Hook — 检查应用是否拥有必要的系统权限
 *
 * 用法：
 * ```tsx
 * const { permission, checkPermission, hasWarning } = usePermissionCheck();
 * ```
 */
export function usePermissionCheck(autoCheck: boolean = true) {
  const [permission, setPermission] = useState<PermissionStatus>(DEFAULT_STATUS);
  const [checked, setChecked] = useState(false);

  const checkPermission = useCallback(async (): Promise<PermissionStatus> => {
    try {
      const result = await invoke<PermissionStatus>("check_permissions");
      setPermission(result);
      setChecked(true);
      return result;
    } catch (e) {
      console.error("[permission] 检查权限失败:", e);
      setChecked(true);
      return DEFAULT_STATUS;
    }
  }, []);

  useEffect(() => {
    if (!autoCheck) return;
    let cancelled = false;
    // 异步检查权限，避免在 effect 中同步调用 setState
    (async () => {
      try {
        const result = await invoke<PermissionStatus>("check_permissions");
        if (!cancelled) {
          setPermission(result);
          setChecked(true);
        }
      } catch (e) {
        if (!cancelled) {
          console.error("[permission] 检查权限失败:", e);
          setChecked(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [autoCheck]);

  const hasWarning = permission.missingPermissions.length > 0;

  return {
    permission,
    checked,
    checkPermission,
    hasWarning,
  };
}

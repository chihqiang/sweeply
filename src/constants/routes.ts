export const ROUTE_PATHS = {
  /** 垃圾清理 */
  CLEAN: "/clean",
  /** 应用卸载 */
  UNINSTALL: "/uninstall",
  /** 网络测速 */
  NETWORK_SPEED: "/network-speed",
  /** 钥匙串管理 */
  KEYCHAIN: "/keychain",
  /** 系统信息 */
  SYSTEM_INFO: "/system",
  /** 启动项管理 */
  LOGIN_ITEMS: "/login-items",
  /** 重复文件查找 */
  DUPLICATE_FILES: "/duplicate-files",
  /** 磁盘空间分析 */
  DISK_USAGE: "/disk-usage",
  /** 大文件查找 */
  LARGE_FILES: "/large-files",
  /** 默认首页（重定向到垃圾清理） */
  HOME: "/",
} as const;

export type RoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];

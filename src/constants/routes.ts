/**
 * 路由路径常量
 */
export const ROUTE_PATHS = {
  /** 垃圾清理 */
  CLEAN: "/clean",
  /** 应用卸载 */
  UNINSTALL: "/uninstall",
  /** 网络测速 */
  NETWORK_SPEED: "/network-speed",
  /** 默认首页（重定向到垃圾清理） */
  HOME: "/",
} as const;

/** 路由路径类型 */
export type RoutePath = (typeof ROUTE_PATHS)[keyof typeof ROUTE_PATHS];

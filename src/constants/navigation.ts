/**
 * 导航菜单配置
 */
import { Trash2, AppWindow, Gauge } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ROUTE_PATHS } from "./routes";

/** 导航项接口 */
export interface NavItem {
  /** 路由路径 */
  path: string;
  /** 显示名称 */
  label: string;
  /** 图标组件 */
  icon: LucideIcon;
  /** 描述说明 */
  description: string;
}

/** 导航菜单列表 */
export const NAV_ITEMS: NavItem[] = [
  {
    path: ROUTE_PATHS.CLEAN,
    label: "垃圾清理",
    icon: Trash2,
    description: "扫描并清理系统垃圾文件",
  },
  {
    path: ROUTE_PATHS.UNINSTALL,
    label: "应用卸载",
    icon: AppWindow,
    description: "彻底卸载应用及残留文件",
  },
  {
    path: ROUTE_PATHS.NETWORK_SPEED,
    label: "网络测速",
    icon: Gauge,
    description: "测试网络下载、上传速度",
  },
];

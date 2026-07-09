import {
  Trash2,
  AppWindow,
  Gauge,
  KeyRound,
  Monitor,
  LogIn,
  Copy,
  HardDrive,
  FileSearch,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ROUTE_PATHS } from "./routes";

export interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  /** 简短描述（侧边栏 tooltip 用） */
  desc?: string;
}

export interface NavGroup {
  /** 分组标题 */
  title: string;
  items: NavItem[];
}

/**
 * 导航分组 — 对齐柠檬清理的工具箱概念
 * 主功能（清理）置顶，其余按「文件工具」「系统管理」「其他」分组
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    title: "主功能",
    items: [
      {
        path: ROUTE_PATHS.CLEAN,
        label: "垃圾清理",
        icon: Trash2,
        desc: "扫描并清理系统垃圾",
      },
    ],
  },
  {
    title: "文件工具",
    items: [
      {
        path: ROUTE_PATHS.LARGE_FILES,
        label: "大文件查找",
        icon: FileSearch,
        desc: "查找并删除大文件",
      },
      {
        path: ROUTE_PATHS.DUPLICATE_FILES,
        label: "重复文件",
        icon: Copy,
        desc: "查找并删除重复文件",
      },
      {
        path: ROUTE_PATHS.DISK_USAGE,
        label: "磁盘分析",
        icon: HardDrive,
        desc: "分析磁盘空间占用",
      },
    ],
  },
  {
    title: "系统管理",
    items: [
      {
        path: ROUTE_PATHS.UNINSTALL,
        label: "应用卸载",
        icon: AppWindow,
        desc: "卸载应用及残留文件",
      },
      {
        path: ROUTE_PATHS.LOGIN_ITEMS,
        label: "启动项",
        icon: LogIn,
        desc: "管理开机启动项",
      },
    ],
  },
  {
    title: "其他工具",
    items: [
      {
        path: ROUTE_PATHS.NETWORK_SPEED,
        label: "网络测速",
        icon: Gauge,
        desc: "测试网络速度",
      },
      {
        path: ROUTE_PATHS.KEYCHAIN,
        label: "钥匙串",
        icon: KeyRound,
        desc: "管理钥匙串条目",
      },
      {
        path: ROUTE_PATHS.SYSTEM_INFO,
        label: "系统信息",
        icon: Monitor,
        desc: "查看硬件和系统信息",
      },
    ],
  },
];

/** 扁平化导航列表（兼容旧代码） */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

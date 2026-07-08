/**
 * 应用卸载相关类型定义
 * 参考 lemon-cleaner 的 LMLocalApp / LMFileItem / LMFileGroup 模型
 * 枚举值与 Rust 端 #[serde(rename_all = "lowercase")] 序列化结果一致
 */

import type { SelectionState } from "./common";

/** 文件类型（卸载残留分类）
 *  参考 lemon-cleaner 的 LMFileType 枚举
 *  Rust 端使用 #[serde(rename_all = "lowercase")] 序列化
 */
export enum UninstallFileType {
  /** 应用本体 */
  Bundle = "bundle",
  /** 支持文件 */
  Support = "support",
  /** 缓存 */
  Cache = "cache",
  /** 偏好设置 */
  Preference = "preference",
  /** 状态文件 */
  State = "state",
  /** 报告文件 */
  Reporter = "reporter",
  /** 日志 */
  Log = "log",
  /** 沙盒数据 */
  Sandbox = "sandbox",
  /** 守护进程 */
  Daemon = "daemon",
  /** 登录项 */
  LoginItem = "loginitem",
  /** 内核扩展（BundleId） */
  KextWithBundleId = "kextwithbundleid",
  /** 内核扩展（路径） */
  KextWithPath = "kextwithpath",
  /** 信号文件 */
  Signal = "signal",
  /** 文件系统 */
  FileSystem = "filesystem",
  /** 偏好面板 */
  PreferencePane = "preferencepane",
  /** 其他 */
  Other = "other",
}

/** 卸载扫描类型
 *  参考 lemon-cleaner 的 AppScanType
 *  Rust 端使用 #[serde(rename_all = "lowercase")] 序列化
 */
export enum AppScanType {
  /** 卸载残留扫描 */
  Leftover = "leftover",
  /** 软件卸载扫描 */
  Uninstall = "uninstall",
}

/** 应用文件项
 *  参考 lemon-cleaner 的 LMFileItem
 */
export interface AppFileItem {
  /** 唯一标识 */
  id: string;
  /** 文件路径 */
  path: string;
  /** 文件名 */
  name: string;
  /** 文件大小（字节） */
  size: number;
  /** 是否选中 */
  selected: boolean;
  /** 文件类型 */
  fileType: UninstallFileType;
  /** 是否已删除 */
  isDeleted: boolean;
}

/** 应用文件分组
 *  参考 lemon-cleaner 的 LMFileGroup
 */
export interface AppFileGroup {
  /** 文件类型 */
  fileType: UninstallFileType;
  /** 该组总大小（字节） */
  totalSize: number;
  /** 文件列表 */
  files: AppFileItem[];
  /** 已选数量 */
  selectedCount: number;
  /** 已选大小（字节） */
  selectedSize: number;
  /** 选中状态 */
  selectionState: SelectionState;
}

/** 已安装应用信息
 *  参考 lemon-cleaner 的 LMLocalApp
 */
export interface InstalledApp {
  /** 唯一标识 */
  id: string;
  /** Bundle ID */
  bundleId: string;
  /** 应用名称 */
  appName: string;
  /** 显示名称 */
  showName: string;
  /** 可执行文件名 */
  executableName: string;
  /** 版本号 */
  version: string;
  /** 应用路径 */
  bundlePath: string;
  /** 应用大小（字节） */
  bundleSize: number;
  /** 最后使用日期（时间戳毫秒） */
  lastUsedDate: number;
  /** 应用图标路径（Base64 或文件路径） */
  iconPath: string;
  /** 总大小（字节） */
  totalSize: number;
  /** 文件项数量 */
  fileItemCount: number;
  /** 已选大小（字节） */
  selectedSize: number;
  /** 已选数量 */
  selectedCount: number;
  /** 文件分组列表 */
  fileGroups: AppFileGroup[];
  /** 是否扫描完成 */
  isScanComplete: boolean;
}

/** 卸载进度事件 */
export interface UninstallProgressEvent {
  /** 应用 ID */
  appId: string;
  /** 已删除文件数 */
  deletedCount: number;
  /** 总文件数 */
  totalCount: number;
  /** 是否完成 */
  isFinished: boolean;
}

/** 卸载结果 */
export interface UninstallResult {
  /** 应用 ID */
  appId: string;
  /** 已释放空间（字节） */
  freedSize: number;
  /** 已删除文件数 */
  deletedFileCount: number;
  /** 失败文件数 */
  failedFileCount: number;
}

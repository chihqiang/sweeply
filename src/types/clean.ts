/**
 * 垃圾清理相关类型定义
 * 参考 lemon-cleaner 的 QMCategoryItem / QMActionItem / QMResultItem 模型
 */

import type { SelectionState } from "./common";

/** 清理大类 ID */
export enum CleanCategoryId {
  /** 系统垃圾 */
  System = "system",
  /** 应用垃圾 */
  Application = "application",
  /** 浏览器垃圾 */
  Browser = "browser",
}

/** 系统垃圾子类 ID */
export enum SystemSubcategoryId {
  /** 系统缓存 */
  Cache = "sys_cache",
  /** 系统日志 */
  Log = "sys_log",
  /** 多余语言包 */
  Language = "sys_language",
  /** 系统临时文件 */
  Temp = "sys_temp",
  /** 回收站 */
  Trash = "sys_trash",
}

/** 浏览器垃圾子类 ID */
export enum BrowserSubcategoryId {
  /** Safari 缓存 */
  SafariCache = "safari_cache",
  /** Safari Cookie */
  SafariCookie = "safari_cookie",
  /** Chrome 缓存 */
  ChromeCache = "chrome_cache",
  /** Firefox 缓存 */
  FirefoxCache = "firefox_cache",
}

/** 扫描行为类型 */
export enum CleanActionType {
  /** 文件 */
  File = "file",
  /** 残留缓存 */
  LeftCache = "leftcache",
  /** 残留日志 */
  LeftLog = "leftlog",
  /** 目录 */
  Directory = "dir",
  /** 语言包 */
  Language = "language",
  /** 应用残留 */
  AppLeft = "appleft",
  /** 安装包 */
  InstallPackage = "installpackage",
}

/** 清理方式
 *  Rust 端使用 #[serde(rename_all = "lowercase")] 序列化
 */
export enum CleanMethod {
  /** 无操作 */
  None = "none",
  /** 直接删除 */
  Remove = "remove",
  /** 移至废纸篓 */
  MoveTrash = "movetrash",
  /** 截断文件 */
  Truncate = "truncate",
  /** 移除语言包 */
  RemoveLanguage = "removelanguage",
}

/** 垃圾清理扫描结果项 */
export interface CleanResultItem {
  /** 唯一标识 */
  id: string;
  /** 显示标题 */
  title: string;
  /** 文件路径 */
  path: string;
  /** 显示路径（简化后） */
  displayPath: string;
  /** 文件大小（字节） */
  size: number;
  /** 清理方式 */
  cleanMethod: CleanMethod;
  /** 是否选中 */
  selected: boolean;
  /** 图标路径（可选） */
  iconPath?: string;
}

/** 垃圾清理子类项 */
export interface CleanSubcategory {
  /** 子类 ID */
  subcategoryId: string;
  /** 显示标题 */
  title: string;
  /** 提示文案 */
  tips: string;
  /** 是否推荐清理 */
  recommend: boolean;
  /** 是否谨慎清理 */
  cautious: boolean;
  /** 扫描结果列表 */
  results: CleanResultItem[];
  /** 是否正在扫描 */
  isScanning: boolean;
  /** 是否已完成扫描 */
  isScanned: boolean;
}

/** 垃圾清理大类项 */
export interface CleanCategory {
  /** 大类 ID */
  categoryId: CleanCategoryId;
  /** 显示标题 */
  title: string;
  /** 提示文案 */
  tips: string;
  /** 子类列表 */
  subcategories: CleanSubcategory[];
  /** 选中状态 */
  selectionState: SelectionState;
  /** 是否正在扫描 */
  isScanning: boolean;
}

/** 垃圾清理扫描结果汇总 */
export interface CleanScanSummary {
  /** 大类列表 */
  categories: CleanCategory[];
  /** 可清理总大小（字节） */
  totalSize: number;
  /** 已选清理大小（字节） */
  selectedSize: number;
  /** 可清理文件总数 */
  totalFileCount: number;
  /** 已选文件数 */
  selectedFileCount: number;
}

/** 垃圾清理完成结果 */
export interface CleanResult {
  /** 已清理大小（字节） */
  cleanedSize: number;
  /** 已清理文件数 */
  cleanedFileCount: number;
  /** 失败文件数 */
  failedFileCount: number;
}

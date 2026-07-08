/**
 * 应用级常量
 */

/** 应用名称 */
export const APP_NAME = "Sweeply";

/** 文件大小换算单位（1024） */
export const FILE_SIZE_BASE = 1024;

/** 文件大小单位列表 */
export const FILE_SIZE_UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

/** 默认扫描并发数 */
export const DEFAULT_SCAN_CONCURRENCY = 4;

/** 进度条最小显示阈值 */
export const MIN_PROGRESS = 0;
export const MAX_PROGRESS = 1;

/** NProgress 配置 */
export const NPROGRESS_CONFIG = {
  /** 最小进度百分比 */
  minimum: 0.1,
  /** 动画缓动 */
  easing: "ease",
  /** 动画速度（毫秒） */
  speed: 400,
  /** 是否显示旋转图标 */
  showSpinner: false,
  /** 是否使用 trickle 模式 */
  trickle: true,
  /** trickle 间隔（毫秒） */
  trickleSpeed: 200,
} as const;

/** 窗口默认配置 */
export const WINDOW_DEFAULTS = {
  minWidth: 720,
  minHeight: 480,
  defaultWidth: 900,
  defaultHeight: 600,
} as const;

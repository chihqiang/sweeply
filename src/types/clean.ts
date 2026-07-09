/**
 * 垃圾清理数据模型
 *
 * 设计理念：通用树形结构，后端定义所有分类/子分类，前端不硬编码任何 ID。
 * - CleanCategory 可直接包含 results（无子分类）或包含 subcategories
 * - 所有 ID 均为 string，由后端动态返回，前端无需维护枚举
 */

/** 清理方式（由后端定义，前端仅做展示） */
export type CleanMethod = "none" | "remove" | "movetrash" | "truncate" | "removelanguage";

/** 清理结果项（叶子节点） */
export interface CleanResultItem {
  /** 唯一标识（格式: prefix::path） */
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

/** 清理子分类 */
export interface CleanSubcategory {
  /** 子分类 ID（后端动态定义） */
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
  /** 子分类总大小（后端预计算） */
  totalSize: number;
}

/** 清理分类（支持直接包含结果项或子分类） */
export interface CleanCategory {
  /** 分类 ID（后端动态定义，如 "system"、"browser"、"application"） */
  categoryId: string;
  /** 显示标题 */
  title: string;
  /** 提示文案 */
  tips: string;
  /** 是否推荐清理 */
  recommend: boolean;
  /** 是否谨慎清理 */
  cautious: boolean;
  /** 子分类列表（为空时使用 results 直接展示） */
  subcategories: CleanSubcategory[];
  /** 直接结果项（无子分类时使用，如应用缓存） */
  results: CleanResultItem[];
  /** 分类总大小（后端预计算） */
  totalSize: number;
}

/** 垃圾清理扫描结果汇总 */
export interface CleanScanSummary {
  /** 分类列表 */
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

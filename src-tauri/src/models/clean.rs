/**
 * 垃圾清理相关数据模型
 *
 * 设计理念：通用树形结构，后端定义所有分类/子分类，前端不硬编码任何 ID。
 * - CleanCategory 可直接包含 results（无子分类）或包含 subcategories
 * - 所有 ID 均为 String，由后端动态返回
 */
use serde::{Deserialize, Serialize};

/// 扫描进度事件载荷
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanProgressPayload {
    pub progress: f64,
    pub description: String,
}

/// 清理方式
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CleanMethod {
    None,
    Remove,
    MoveTrash,
    Truncate,
    RemoveLanguage,
}

/// 垃圾清理扫描结果项（叶子节点）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanResultItem {
    pub id: String,
    pub title: String,
    pub path: String,
    pub display_path: String,
    pub size: u64,
    pub clean_method: CleanMethod,
    pub selected: bool,
    pub icon_path: Option<String>,
}

/// 清理子分类
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanSubcategory {
    pub subcategory_id: String,
    pub title: String,
    pub tips: String,
    pub recommend: bool,
    pub cautious: bool,
    pub results: Vec<CleanResultItem>,
    pub total_size: u64,
}

/// 清理分类（支持直接包含结果项或子分类）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanCategory {
    pub category_id: String,
    pub title: String,
    pub tips: String,
    pub recommend: bool,
    pub cautious: bool,
    /// 子分类列表（为空时使用 results 直接展示）
    pub subcategories: Vec<CleanSubcategory>,
    /// 直接结果项（无子分类时使用，如应用缓存）
    pub results: Vec<CleanResultItem>,
    pub total_size: u64,
}

/// 垃圾清理扫描结果汇总
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanScanSummary {
    pub categories: Vec<CleanCategory>,
    pub total_size: u64,
    pub selected_size: u64,
    pub total_file_count: u64,
    pub selected_file_count: u64,
}

/// 垃圾清理完成结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanResult {
    pub cleaned_size: u64,
    pub cleaned_file_count: u64,
    pub failed_file_count: u64,
}

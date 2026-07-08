/**
 * 垃圾清理相关数据模型
 * 与前端 types/clean.ts 对应
 * 所有 struct 使用 camelCase 序列化，与前端 TypeScript 字段名一致
 */
use serde::{Deserialize, Serialize};

/// 清理大类 ID
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CleanCategoryId {
    System,
    Application,
    Browser,
}

/// 扫描行为类型
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum CleanActionType {
    File,
    Leftcache,
    Leftlog,
    Dir,
    Language,
    Appleft,
    Installpackage,
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

/// 垃圾清理扫描结果项
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

/// 垃圾清理子类项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanSubcategory {
    pub subcategory_id: String,
    pub title: String,
    pub tips: String,
    pub recommend: bool,
    pub cautious: bool,
    pub results: Vec<CleanResultItem>,
    pub is_scanning: bool,
    pub is_scanned: bool,
}

/// 垃圾清理大类项
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanCategory {
    pub category_id: CleanCategoryId,
    pub title: String,
    pub tips: String,
    pub subcategories: Vec<CleanSubcategory>,
    pub selection_state: String,
    pub is_scanning: bool,
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

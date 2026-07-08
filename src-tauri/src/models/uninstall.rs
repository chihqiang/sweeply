/**
 * 应用卸载相关数据模型
 * 与前端 types/uninstaller.ts 对应
 * 参考 lemon-cleaner 的 LMLocalApp / LMFileItem / LMFileGroup 模型
 * 所有 struct 使用 camelCase 序列化，所有枚举使用 lowercase 序列化
 */
use serde::{Deserialize, Serialize};

/// 文件类型（卸载残留分类）
/// 参考 lemon-cleaner 的 LMFileType 枚举
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum UninstallFileType {
    Bundle,
    Support,
    Cache,
    Preference,
    State,
    Reporter,
    Log,
    Sandbox,
    Daemon,
    LoginItem,
    KextWithBundleId,
    KextWithPath,
    Signal,
    FileSystem,
    PreferencePane,
    Other,
}

/// 卸载扫描类型
/// 参考 lemon-cleaner 的 AppScanType
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppScanType {
    Leftover,
    Uninstall,
}

/// 应用文件项
/// 参考 lemon-cleaner 的 LMFileItem
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppFileItem {
    pub id: String,
    pub path: String,
    pub name: String,
    pub size: u64,
    pub selected: bool,
    pub file_type: UninstallFileType,
    pub is_deleted: bool,
}

/// 应用文件分组
/// 参考 lemon-cleaner 的 LMFileGroup
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppFileGroup {
    pub file_type: UninstallFileType,
    pub total_size: u64,
    pub files: Vec<AppFileItem>,
    pub selected_count: u64,
    pub selected_size: u64,
    pub selection_state: String,
}

/// 已安装应用信息
/// 参考 lemon-cleaner 的 LMLocalApp
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledApp {
    pub id: String,
    pub bundle_id: String,
    pub app_name: String,
    pub show_name: String,
    pub executable_name: String,
    pub version: String,
    pub bundle_path: String,
    pub bundle_size: u64,
    pub last_used_date: u64,
    pub icon_path: String,
    pub total_size: u64,
    pub file_item_count: u64,
    pub selected_size: u64,
    pub selected_count: u64,
    pub file_groups: Vec<AppFileGroup>,
    pub is_scan_complete: bool,
}

/// 卸载进度事件
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UninstallProgressEvent {
    pub app_id: String,
    pub deleted_count: u64,
    pub total_count: u64,
    pub is_finished: bool,
}

/// 卸载结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UninstallResult {
    pub app_id: String,
    pub freed_size: u64,
    pub deleted_file_count: u64,
    pub failed_file_count: u64,
}

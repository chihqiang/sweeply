use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeychainFile {
    pub path: String,
    pub name: String,
    pub is_login: bool,
    pub is_system: bool,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeychainItem {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub account: String,
    pub server_or_service: String,
    pub modified_date: String,
    pub raw_data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeychainListResult {
    pub keychains: Vec<KeychainFile>,
    pub total_items: u64,
}

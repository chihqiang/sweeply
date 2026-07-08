/**
 * 网络测速相关数据模型
 * 与前端 types/network.ts 对应
 * 所有 struct 使用 camelCase 序列化，与前端 TypeScript 字段名一致
 */
use serde::{Deserialize, Serialize};

/// 网络连接状态
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum NetworkConnectionState {
    Connected,
    Disconnected,
    Checking,
}

/// 测速阶段
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SpeedTestPhase {
    Latency,
    Download,
    Upload,
    Done,
}

/// 速度方向
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SpeedDirection {
    Download,
    Upload,
}

/// 单次测速结果
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedTestResult {
    pub download_speed: u64,
    pub upload_speed: u64,
    pub latency: u64,
    pub jitter: f64,
    pub packet_loss: f64,
    pub timestamp: u64,
}

/// 测速进度事件
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeedTestProgressEvent {
    pub phase: SpeedTestPhase,
    pub progress: f64,
    pub current_speed: u64,
    pub direction: SpeedDirection,
}

/// 网络接口信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkInterface {
    pub name: String,
    pub ip_address: String,
    pub mac_address: String,
    pub is_active: bool,
}

/// 网络状态信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkStatus {
    pub connection_state: NetworkConnectionState,
    pub interfaces: Vec<NetworkInterface>,
    pub current_download_speed: u64,
    pub current_upload_speed: u64,
}

/// 进程网络使用信息
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessNetworkUsage {
    pub pid: u32,
    pub app_name: String,
    pub download_speed: u64,
    pub upload_speed: u64,
    pub total_download: u64,
    pub total_upload: u64,
}

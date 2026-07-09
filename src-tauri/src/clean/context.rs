/**
 * 扫描上下文 — 依赖注入载体
 *
 * 将进度发射器和取消令牌打包，通过引用注入到 DirScanner，
 * 使扫描器无需直接依赖 Tauri AppHandle 或全局状态。
 */
use crate::clean::progress::{CancelToken, ProgressEmitter};

/// 扫描上下文
///
/// 持有扫描过程中所需的共享依赖：
/// - `emitter`: 进度发射器，向前端推送扫描进度
/// - `cancel`: 取消令牌，响应用户的取消请求
pub struct ScanContext<'a> {
    pub emitter: &'a ProgressEmitter,
    pub cancel: &'a CancelToken,
}

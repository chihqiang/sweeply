/**
 * 进度发射与取消令牌
 *
 * - ProgressEmitter: 封装 Tauri 事件发送，向前端推送扫描进度
 * - CancelToken: 全局取消令牌，跨命令共享（scan / stop 命令均可访问）
 */
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, OnceLock};

use tauri::{AppHandle, Emitter};

use crate::models::clean::CleanProgressPayload;

/// 扫描进度事件名称
const EVENT_CLEAN_PROGRESS: &str = "clean://scan-progress";

// ────────────────────────────────────────────────────────────────────────────
//  ProgressEmitter
// ────────────────────────────────────────────────────────────────────────────

/// 进度发射器 — 封装 Tauri 事件发送
///
/// 通过依赖注入传递给 `DirScanner`，在扫描过程中向前端推送进度。
pub struct ProgressEmitter {
    app: AppHandle,
}

impl ProgressEmitter {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    /// 发送进度事件
    ///
    /// # 参数
    /// - `progress`: 进度值 0.0 ~ 1.0
    /// - `description`: 进度描述文本
    pub fn emit(&self, progress: f64, description: &str) {
        let _ = self.app.emit(
            EVENT_CLEAN_PROGRESS,
            CleanProgressPayload {
                progress,
                description: description.to_string(),
            },
        );
    }
}

// ────────────────────────────────────────────────────────────────────────────
//  CancelToken
// ────────────────────────────────────────────────────────────────────────────

/// 全局取消令牌 — 基于 `OnceLock` 实现的单例
///
/// 扫描开始时调用 `reset()` 清除标志；
/// 用户请求取消时调用 `cancel()` 设置标志；
/// 扫描过程中通过 `check()` 在检查点响应取消。
pub struct CancelToken {
    flag: &'static Arc<AtomicBool>,
}

impl CancelToken {
    /// 获取全局唯一实例
    pub fn global() -> Self {
        static FLAG: OnceLock<Arc<AtomicBool>> = OnceLock::new();
        let flag = FLAG.get_or_init(|| Arc::new(AtomicBool::new(false)));
        Self { flag }
    }

    /// 重置取消标志（扫描开始前调用）
    pub fn reset(&self) {
        self.flag.store(false, Ordering::SeqCst);
    }

    /// 设置取消标志（用户请求停止时调用）
    pub fn cancel(&self) {
        self.flag.store(true, Ordering::SeqCst);
    }

    /// 检查是否已取消
    pub fn is_cancelled(&self) -> bool {
        self.flag.load(Ordering::SeqCst)
    }

    /// 在检查点调用，若已取消则返回 `Err`
    pub fn check(&self) -> Result<(), String> {
        if self.is_cancelled() {
            Err("扫描已取消".to_string())
        } else {
            Ok(())
        }
    }
}

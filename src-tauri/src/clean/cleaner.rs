/**
 * 清理执行器 — 执行实际的文件删除
 *
 * 通过依赖注入接收 ProgressEmitter 和 CancelToken，
 * 遍历用户选中的条目，使用 trash crate 移至废纸篓。
 */
use std::path::PathBuf;

use crate::clean::progress::{CancelToken, ProgressEmitter};
use crate::models::clean::CleanResult;

// ────────────────────────────────────────────────────────────────────────────
//  Cleaner
// ────────────────────────────────────────────────────────────────────────────

/// 清理执行器 — 接收注入的进度发射器和取消令牌
pub struct Cleaner {
    emitter: ProgressEmitter,
    cancel: CancelToken,
}

impl Cleaner {
    /// 创建清理执行器，注入 AppHandle
    pub fn new(app: tauri::AppHandle) -> Self {
        Self {
            emitter: ProgressEmitter::new(app),
            cancel: CancelToken::global(),
        }
    }

    /// 执行清理
    ///
    /// # 参数
    /// - `selected_ids`: 用户选中的条目 ID 列表（格式: `prefix::path`）
    /// - `sizes`: 对应的文件大小列表
    ///
    /// # 返回
    /// 清理结果统计（已清理大小、成功/失败数量）
    pub fn execute(&self, selected_ids: Vec<String>, sizes: Vec<u64>) -> CleanResult {
        self.cancel.reset();

        let total = selected_ids.len();
        let mut cleaned_size: u64 = 0;
        let mut cleaned_file_count: u64 = 0;
        let mut failed_file_count: u64 = 0;

        for (i, id) in selected_ids.iter().enumerate() {
            if self.cancel.is_cancelled() {
                log::info!("[clean] 清理被用户取消");
                break;
            }

            self.emitter.emit(
                (i as f64) / (total as f64),
                &format!("正在清理 ({}/{})", i + 1, total),
            );

            // 从 ID 中提取路径（格式为 prefix::path）
            if let Some(path_str) = id.splitn(2, "::").nth(1) {
                let path = PathBuf::from(path_str);
                if path.exists() {
                    log::info!(
                        "[clean] 删除文件/目录: {} ({} 字节)",
                        path.display(),
                        sizes[i]
                    );
                    match trash::delete(&path) {
                        Ok(_) => {
                            cleaned_size += sizes[i];
                            cleaned_file_count += 1;
                            log::info!("[clean] 删除成功: {}", path.display());
                        }
                        Err(e) => {
                            failed_file_count += 1;
                            log::error!("[clean] 删除失败: {} - {}", path.display(), e);
                        }
                    }
                } else {
                    log::warn!("[clean] 文件不存在: {}", path.display());
                }
            }
        }

        self.emitter.emit(1.0, "清理完成");

        log::info!(
            "[clean] 清理完成: 清理 {} 项, 释放 {} 字节, 失败 {} 项",
            cleaned_file_count,
            cleaned_size,
            failed_file_count
        );

        CleanResult {
            cleaned_size,
            cleaned_file_count,
            failed_file_count,
        }
    }
}

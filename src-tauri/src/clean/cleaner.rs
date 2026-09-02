/**
 * 清理执行器 — 执行实际的文件删除
 *
 * 通过依赖注入接收 ProgressEmitter 和 CancelToken，
 * 遍历用户选中的条目，根据 CleanMethod 执行对应清理方式：
 * - MoveTrash: 移至废纸篓
 * - Remove / RemoveLanguage: 直接删除
 * - Truncate: 截断文件内容
 */
use std::fs;
use std::path::{Path, PathBuf};

use crate::clean::progress::{CancelToken, ProgressEmitter};
use crate::clean::is_known_clean_path;
use crate::models::clean::{CleanMethod, CleanResult};

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
    /// - `methods`: 对应的清理方式列表（与 selected_ids 一一对应）
    ///
    /// # 返回
    /// 清理结果统计（已清理大小、成功/失败数量）
    pub fn execute(
        &self,
        selected_ids: Vec<String>,
        sizes: Vec<u64>,
        methods: Vec<CleanMethod>,
    ) -> CleanResult {
        // 注：取消标志已在命令入口处重置（execute_clean），
        // 此处不再 reset，避免清除清理启动瞬间用户发起的取消请求。

        let total = selected_ids.len();
        if total == 0 {
            return CleanResult {
                cleaned_size: 0,
                cleaned_file_count: 0,
                failed_file_count: 0,
            };
        }

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
                if !path.exists() {
                    log::warn!("[clean] 文件不存在: {}", path.display());
                    continue;
                }

                // 路径来源校验：只允许删除最近一次扫描返回过的路径
                if !is_known_clean_path(&path) {
                    failed_file_count += 1;
                    log::error!(
                        "[clean] 拒绝清理未扫描过的路径（来源校验失败）: {}",
                        path.display()
                    );
                    continue;
                }

                let method = methods.get(i).cloned().unwrap_or(CleanMethod::MoveTrash);
                log::info!(
                    "[clean] 清理文件/目录: {} ({} 字节, 方式: {:?})",
                    path.display(),
                    sizes[i],
                    method
                );
                match remove_by_method(&path, &method) {
                    Ok(_) => {
                        cleaned_size += sizes[i];
                        cleaned_file_count += 1;
                        log::info!("[clean] 清理成功: {}", path.display());
                    }
                    Err(e) => {
                        failed_file_count += 1;
                        log::error!("[clean] 清理失败: {} - {}", path.display(), e);
                    }
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

/// 根据 CleanMethod 执行对应的删除/清理方式
fn remove_by_method(path: &Path, method: &CleanMethod) -> Result<(), String> {
    match method {
        CleanMethod::MoveTrash => trash::delete(path).map_err(|e| e.to_string()),
        CleanMethod::Remove | CleanMethod::RemoveLanguage => {
            if path.is_dir() {
                fs::remove_dir_all(path).map_err(|e| e.to_string())
            } else {
                fs::remove_file(path).map_err(|e| e.to_string())
            }
        }
        CleanMethod::Truncate => {
            // 截断文件内容（保留文件本身，常用于日志/缓存重置）
            fs::OpenOptions::new()
                .write(true)
                .truncate(true)
                .open(path)
                .map(|_| ())
                .map_err(|e| e.to_string())
        }
        CleanMethod::None => trash::delete(path).map_err(|e| e.to_string()),
    }
}
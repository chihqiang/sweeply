use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

fn cancel_flag() -> &'static Arc<AtomicBool> {
    static FLAG: OnceLock<Arc<AtomicBool>> = OnceLock::new();
    FLAG.get_or_init(|| Arc::new(AtomicBool::new(false)))
}

const EVENT_PROGRESS: &str = "largefile://progress";
const PROGRESS_INTERVAL: u64 = 200;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LargeFile {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub modified: String,
    pub extension: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LargeFileProgress {
    pub scanned: u64,
    pub found: u64,
    /// 当前正在扫描的路径（用于前端展示）
    pub current_path: String,
}

/// 扫描大文件（异步，使用 spawn_blocking 避免阻塞主线程）
#[tauri::command]
pub async fn scan_large_files(
    app: AppHandle,
    path: String,
    min_size_mb: u64,
) -> Result<Vec<LargeFile>, String> {
    log::info!("[large_files] 收到扫描大文件命令: path={}, min_size={}MB", path, min_size_mb);

    tauri::async_runtime::spawn_blocking(move || {
        let scan_start = std::time::Instant::now();
        cancel_flag().store(false, Ordering::SeqCst);
        let flag = cancel_flag();
        let root = PathBuf::from(&path);
        let min_bytes = min_size_mb * 1024 * 1024;

        if !root.exists() {
            log::error!("[large_files] 路径不存在: {}", path);
            return Err("路径不存在".to_string());
        }

        let mut files: Vec<LargeFile> = Vec::new();
        let mut scanned = 0u64;
        let mut current_dir = String::new();

        for entry in WalkDir::new(&root).follow_links(false).into_iter().filter_map(|e| e.ok()) {
            if flag.load(Ordering::SeqCst) {
                log::warn!("[large_files] 扫描被取消 (已扫描 {} 个文件, 找到 {} 个大文件)", scanned, files.len());
                return Ok(vec![]);
            }

            if !entry.file_type().is_file() {
                // 记录当前扫描的目录路径
                if entry.file_type().is_dir() {
                    current_dir = entry.path().to_string_lossy().to_string();
                }
                continue;
            }

            scanned += 1;
            if scanned % PROGRESS_INTERVAL == 0 {
                app.emit(EVENT_PROGRESS, LargeFileProgress {
                    scanned,
                    found: files.len() as u64,
                    current_path: current_dir.clone(),
                }).ok();
            }

            let meta = match entry.metadata() {
                Ok(m) => m,
                _ => continue,
            };

            let size = meta.len();
            if size < min_bytes {
                continue;
            }

            let file_path = entry.path().to_path_buf();
            let ext = file_path.extension()
                .map(|e| e.to_string_lossy().to_lowercase())
                .unwrap_or_default();

            files.push(LargeFile {
                path: file_path.to_string_lossy().to_string(),
                name: file_path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                size,
                modified: meta.modified().ok()
                    .map(|t| {
                        let d: chrono::DateTime<chrono::Local> = t.into();
                        d.format("%Y-%m-%d %H:%M").to_string()
                    })
                    .unwrap_or_default(),
                extension: ext,
            });
        }

        files.sort_by(|a, b| b.size.cmp(&a.size));

        log::info!(
            "[large_files] 扫描完成: 扫描 {} 个文件, 找到 {} 个大文件, 耗时 {:.2}s",
            scanned,
            files.len(),
            scan_start.elapsed().as_secs_f64()
        );

        app.emit(EVENT_PROGRESS, LargeFileProgress {
            scanned,
            found: files.len() as u64,
            current_path: String::new(),
        }).ok();

        Ok(files)
    })
    .await
    .map_err(|e| {
        log::error!("[large_files] 扫描线程异常: {}", e);
        format!("扫描失败: {}", e)
    })?
}

#[tauri::command]
pub fn stop_large_file_scan() -> Result<(), String> {
    log::info!("[large_files] 用户请求停止扫描");
    cancel_flag().store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn delete_large_files(paths: Vec<String>) -> Result<Vec<String>, String> {
    log::info!("[large_files] 收到删除大文件命令: {} 个文件", paths.len());
    let mut failed: Vec<String> = Vec::new();
    for path in &paths {
        match trash::delete(PathBuf::from(path)) {
            Ok(_) => {
                log::debug!("[large_files] 删除成功: {}", path);
            }
            Err(e) => {
                log::warn!("[large_files] trash 删除失败: {} - {}, 尝试直接删除", path, e);
                if fs::remove_file(PathBuf::from(path)).is_err() {
                    log::error!("[large_files] 删除失败: {} ({})", path, e);
                    failed.push(format!("{} ({})", path, e));
                }
            }
        }
    }
    log::info!("[large_files] 删除完成: 成功 {} 项, 失败 {} 项", paths.len() - failed.len(), failed.len());
    Ok(failed)
}

#[tauri::command]
pub fn open_file_location(path: String) -> Result<(), String> {
    log::info!("[large_files] 打开文件位置: {}", path);
    std::process::Command::new("open")
        .args(["-R", &path])
        .output()
        .map_err(|e| {
            log::error!("[large_files] 打开文件位置失败: {} - {}", path, e);
            format!("打开文件位置失败: {}", e)
        })?;
    Ok(())
}

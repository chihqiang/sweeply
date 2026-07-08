/**
 * 垃圾清理命令
 * 使用第三方 crate：walkdir（目录遍历）、trash（移至废纸篓）、dirs（标准目录）、sysinfo（系统信息）
 * 所有扫描命令使用 spawn_blocking 避免阻塞 Tauri 主线程
 */
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use crate::models::clean::*;

/// 事件名称常量
const EVENT_CLEAN_PROGRESS: &str = "clean://scan-progress";

/// 计算目录大小（使用 walkdir 递归遍历）
fn calculate_dir_size(path: &PathBuf) -> u64 {
    log::debug!("计算目录大小: {}", path.display());
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

/// 获取系统临时目录
fn get_system_temp_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![];
    dirs.push(std::env::temp_dir());
    #[cfg(target_os = "macos")]
    {
        dirs.push(PathBuf::from("/private/var/tmp"));
        dirs.push(PathBuf::from("/tmp"));
    }
    dirs
}

/// 获取用户缓存目录
fn get_user_cache_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![];
    if let Some(cache) = dirs::cache_dir() {
        dirs.push(cache);
    }
    dirs
}

/// 获取系统日志目录
fn get_system_log_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![];
    #[cfg(target_os = "macos")]
    {
        dirs.push(PathBuf::from("/var/log"));
        if let Some(home) = dirs::home_dir() {
            dirs.push(home.join("Library/Logs"));
        }
    }
    dirs
}

/// 扫描单个目录列表，返回结果项和总大小
/// 默认不选中，由用户自行勾选
fn scan_dir_list(
    dirs: &[PathBuf],
    id_prefix: &str,
    clean_method: CleanMethod,
) -> (Vec<CleanResultItem>, u64) {
    let mut results = vec![];
    let mut total_size: u64 = 0;

    for dir in dirs {
        if dir.exists() {
            log::info!("扫描目录: {} (前缀: {})", dir.display(), id_prefix);
            let size = calculate_dir_size(dir);
            total_size += size;
            log::info!("目录 {} 大小: {} 字节", dir.display(), size);
            results.push(CleanResultItem {
                id: format!("{}_{}", id_prefix, dir.display()),
                title: dir
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                path: dir.display().to_string(),
                display_path: dir.display().to_string(),
                size,
                clean_method: clean_method.clone(),
                selected: false,
                icon_path: None,
            });
        } else {
            log::warn!("目录不存在，跳过: {}", dir.display());
        }
    }

    (results, total_size)
}

/// 同步执行扫描逻辑（在 spawn_blocking 中运行）
fn do_scan(app: &AppHandle) -> CleanScanSummary {
    let mut categories = vec![];
    let mut total_file_count: u64 = 0;

    log::info!("===== 开始垃圾扫描 =====");

    // 扫描系统缓存
    log::info!("[1/3] 扫描系统缓存...");
    let _ = app.emit(
        EVENT_CLEAN_PROGRESS,
        serde_json::json!({
            "progress": 0.1,
            "description": "正在扫描系统缓存...",
        }),
    );
    let cache_dirs = get_user_cache_dirs();
    let (cache_results, cache_size) =
        scan_dir_list(&cache_dirs, "cache", CleanMethod::MoveTrash);
    total_file_count += cache_results.len() as u64;
    log::info!("[1/3] 缓存扫描完成: {} 项, {} 字节", cache_results.len(), cache_size);

    // 扫描系统临时文件
    log::info!("[2/3] 扫描临时文件...");
    let _ = app.emit(
        EVENT_CLEAN_PROGRESS,
        serde_json::json!({
            "progress": 0.5,
            "description": "正在扫描临时文件...",
        }),
    );
    let temp_dirs = get_system_temp_dirs();
    let (temp_results, temp_size) =
        scan_dir_list(&temp_dirs, "temp", CleanMethod::Remove);
    total_file_count += temp_results.len() as u64;
    log::info!("[2/3] 临时文件扫描完成: {} 项, {} 字节", temp_results.len(), temp_size);

    // 扫描系统日志
    log::info!("[3/3] 扫描系统日志...");
    let _ = app.emit(
        EVENT_CLEAN_PROGRESS,
        serde_json::json!({
            "progress": 0.8,
            "description": "正在扫描系统日志...",
        }),
    );
    let log_dirs = get_system_log_dirs();
    let (log_results, log_size) =
        scan_dir_list(&log_dirs, "log", CleanMethod::Remove);
    total_file_count += log_results.len() as u64;
    log::info!("[3/3] 日志扫描完成: {} 项, {} 字节", log_results.len(), log_size);

    let total_size = cache_size + temp_size + log_size;
    log::info!("===== 扫描完成: 总计 {} 字节, {} 项 =====", total_size, total_file_count);

    // 构建系统大类
    let system_category = CleanCategory {
        category_id: CleanCategoryId::System,
        title: "系统垃圾".to_string(),
        tips: "系统缓存、临时文件和日志".to_string(),
        subcategories: vec![
            CleanSubcategory {
                subcategory_id: "sys_cache".to_string(),
                title: "系统缓存".to_string(),
                tips: "应用缓存文件".to_string(),
                recommend: true,
                cautious: false,
                results: cache_results,
                is_scanning: false,
                is_scanned: true,
            },
            CleanSubcategory {
                subcategory_id: "sys_temp".to_string(),
                title: "临时文件".to_string(),
                tips: "系统和应用临时文件".to_string(),
                recommend: true,
                cautious: false,
                results: temp_results,
                is_scanning: false,
                is_scanned: true,
            },
            CleanSubcategory {
                subcategory_id: "sys_log".to_string(),
                title: "系统日志".to_string(),
                tips: "系统和应用日志文件".to_string(),
                recommend: false,
                cautious: true,
                results: log_results,
                is_scanning: false,
                is_scanned: true,
            },
        ],
        selection_state: "on".to_string(),
        is_scanning: false,
    };
    categories.push(system_category);

    // 发送完成进度
    let _ = app.emit(
        EVENT_CLEAN_PROGRESS,
        serde_json::json!({
            "progress": 1.0,
            "description": "扫描完成",
        }),
    );

    CleanScanSummary {
        categories,
        total_size,
        selected_size: 0,
        total_file_count,
        selected_file_count: 0,
    }
}

/// 扫描垃圾文件（异步，使用 spawn_blocking 避免阻塞主线程）
#[tauri::command]
pub async fn scan_clean_files(app: AppHandle) -> Result<CleanScanSummary, String> {
    log::info!("收到扫描垃圾文件命令");
    let app_clone = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        do_scan(&app_clone)
    })
    .await
    .map_err(|e| {
        log::error!("扫描线程异常: {}", e);
        format!("扫描失败: {}", e)
    })?;
    log::info!("扫描垃圾文件命令完成");
    Ok(result)
}

/// 执行垃圾清理（使用 trash crate 移至废纸篓）
#[tauri::command]
pub async fn execute_clean(selected_ids: Vec<String>) -> Result<CleanResult, String> {
    log::info!("收到清理命令, 选中 {} 项", selected_ids.len());

    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut cleaned_size: u64 = 0;
        let mut cleaned_file_count: u64 = 0;
        let mut failed_file_count: u64 = 0;

        for id in &selected_ids {
            // 从 ID 中提取路径（格式为 type_path）
            if let Some(path_str) = id.splitn(2, '_').nth(1) {
                let path = PathBuf::from(path_str);
                if path.exists() {
                    log::info!("删除文件: {}", path.display());
                    match trash::delete(&path) {
                        Ok(_) => {
                            if let Ok(meta) = path.metadata() {
                                cleaned_size += meta.len();
                            }
                            cleaned_file_count += 1;
                            log::info!("删除成功: {}", path.display());
                        }
                        Err(e) => {
                            failed_file_count += 1;
                            log::error!("删除失败: {} - {}", path.display(), e);
                        }
                    }
                } else {
                    log::warn!("文件不存在: {}", path.display());
                }
            }
        }

        log::info!(
            "清理完成: 清理 {} 项, 释放 {} 字节, 失败 {} 项",
            cleaned_file_count,
            cleaned_size,
            failed_file_count
        );

        CleanResult {
            cleaned_size,
            cleaned_file_count,
            failed_file_count,
        }
    })
    .await
    .map_err(|e| {
        log::error!("清理线程异常: {}", e);
        format!("清理失败: {}", e)
    })?;

    Ok(result)
}

/// 停止扫描
#[tauri::command]
pub fn stop_clean_scan() -> Result<(), String> {
    log::info!("收到停止扫描命令");
    Ok(())
}

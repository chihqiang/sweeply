use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use rayon::prelude::*;

fn cancel_flag() -> &'static Arc<AtomicBool> {
    static FLAG: OnceLock<Arc<AtomicBool>> = OnceLock::new();
    FLAG.get_or_init(|| Arc::new(AtomicBool::new(false)))
}

const EVENT_SCAN_PROGRESS: &str = "diskusage://scan-progress";

/// 每扫描多少个文件条目发送一次进度
const PROGRESS_EMIT_INTERVAL: u64 = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskItem {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub file_count: u64,
    pub children: Vec<DiskItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskUsageProgress {
    pub current: u64,
    pub total: u64,
    /// 当前正在扫描的路径（用于前端展示）
    pub current_path: String,
}

/// 单遍扫描：同时统计条目数和累加文件大小，避免两遍遍历
///
/// 使用渐近曲线让进度在遍历过程中持续推进：
/// `fraction = 1 - 1/(1 + n/k)`，n 越大越接近 1。
///
/// 性能优化：相比原先的两遍扫描（先统计再计算），单遍扫描将 I/O 减半，
/// 对于包含大量文件的目录可显著减少耗时。
fn scan_dir_tree(
    path: &PathBuf,
    app: &AppHandle,
    flag: &Arc<AtomicBool>,
) -> Result<Vec<DiskItem>, String> {
    log::info!("[disk_usage] 开始单遍扫描目录树: {}", path.display());

    let mut dir_sizes: HashMap<PathBuf, (u64, u64)> = HashMap::new();
    let mut entry_count: u64 = 0;
    let mut last_emit: u64 = 0;
    let mut current_dir = String::new();

    // 单遍遍历：同时统计条目数、累加文件大小到父目录
    for entry in WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if flag.load(Ordering::SeqCst) {
            log::warn!(
                "[disk_usage] 扫描被取消 (已处理 {} 个条目)",
                entry_count
            );
            return Ok(vec![]);
        }

        if entry.file_type().is_dir() {
            current_dir = entry.path().to_string_lossy().to_string();
        }

        entry_count += 1;

        // 定期发送进度（使用渐近曲线，total=0 表示仍在扫描中）
        if entry_count - last_emit >= PROGRESS_EMIT_INTERVAL {
            last_emit = entry_count;

            // 渐近曲线：进度随条目数趋近 1
            let fraction = 1.0 - 1.0 / (1.0 + entry_count as f64 / 5000.0);
            // 将分数映射到 current/total（total 固定为 10000）
            let scaled_current = (fraction * 10000.0) as u64;

            app.emit(
                EVENT_SCAN_PROGRESS,
                DiskUsageProgress {
                    current: scaled_current,
                    total: 10000,
                    current_path: current_dir.clone(),
                },
            )
            .ok();
        }

        // 读取文件元数据并累加大小
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };

        if entry.file_type().is_file() {
            let file_size = meta.len();
            let entry_path = entry.path().to_path_buf();

            // 累加到所有父目录（直到根）
            let mut parent = entry_path.parent();
            while let Some(p) = parent {
                let e = dir_sizes.entry(p.to_path_buf()).or_insert((0, 0));
                e.0 += file_size;
                e.1 += 1;
                if p == path {
                    break;
                }
                parent = p.parent();
            }
        }
    }

    log::info!(
        "[disk_usage] 单遍扫描完成: 共 {} 个条目, {} 个目录有数据",
        entry_count,
        dir_sizes.len()
    );

    // 最终进度：100%
    app.emit(
        EVENT_SCAN_PROGRESS,
        DiskUsageProgress {
            current: 1,
            total: 1,
            current_path: String::new(),
        },
    )
    .ok();

    // 构建树
    build_children(path, &dir_sizes)
}

fn build_children(
    path: &PathBuf,
    dir_sizes: &HashMap<PathBuf, (u64, u64)>,
) -> Result<Vec<DiskItem>, String> {
    let mut items: Vec<DiskItem> = Vec::new();

    let dir = fs::read_dir(path).map_err(|e| format!("读取目录失败: {}", e))?;
    for entry in dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let child_path = entry.path();

        let (size, file_count) = if child_path.is_dir() {
            dir_sizes.get(&child_path).copied().unwrap_or((0, 0))
        } else {
            let size = fs::metadata(&child_path)
                .ok()
                .map(|m| m.len())
                .unwrap_or(0);
            (size, 1)
        };

        items.push(DiskItem {
            name,
            path: child_path.to_string_lossy().to_string(),
            size,
            file_count,
            children: vec![],
        });
    }

    items.sort_by(|a, b| b.size.cmp(&a.size));
    Ok(items)
}

/// 扫描磁盘使用（异步，使用 spawn_blocking 避免阻塞主线程）
#[tauri::command]
pub async fn scan_disk_usage(
    app: AppHandle,
    path: String,
) -> Result<Vec<DiskItem>, String> {
    log::info!("[disk_usage] 收到扫描磁盘使用命令: path={}", path);

    tauri::async_runtime::spawn_blocking(move || {
        let scan_start = std::time::Instant::now();
        cancel_flag().store(false, Ordering::SeqCst);
        let flag = cancel_flag();
        let root = PathBuf::from(&path);

        if !root.exists() {
            log::error!("[disk_usage] 路径不存在: {}", path);
            return Err("路径不存在".to_string());
        }

        app.emit(
            EVENT_SCAN_PROGRESS,
            DiskUsageProgress {
                current: 0,
                total: 0,
                current_path: root.to_string_lossy().to_string(),
            },
        )
        .ok();

        let items = scan_dir_tree(&root, &app, &flag)?;

        log::info!(
            "[disk_usage] 扫描完成: {} 个顶层项, 耗时 {:.2}s",
            items.len(),
            scan_start.elapsed().as_secs_f64()
        );

        app.emit(
            EVENT_SCAN_PROGRESS,
            DiskUsageProgress {
                current: 1,
                total: 1,
                current_path: String::new(),
            },
        )
        .ok();

        Ok(items)
    })
    .await
    .map_err(|e| {
        log::error!("[disk_usage] 扫描线程异常: {}", e);
        format!("扫描失败: {}", e)
    })?
}

/// 扫描目录详情 — 使用 rayon 并行扫描子目录，大幅加速大目录的详情计算
#[tauri::command]
pub fn scan_disk_usage_detail(path: String) -> Result<DiskItem, String> {
    log::info!("[disk_usage] 收到扫描目录详情命令: path={}", path);
    let scan_start = std::time::Instant::now();
    let root = PathBuf::from(&path);

    if !root.exists() {
        log::error!("[disk_usage] 路径不存在: {}", path);
        return Err("路径不存在".to_string());
    }

    let flag = cancel_flag();

    let dir = fs::read_dir(&root).map_err(|e| format!("读取目录失败: {}", e))?;

    // 收集所有子条目
    let entries: Vec<(String, PathBuf, bool)> = dir
        .flatten()
        .filter_map(|entry| {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                return None;
            }
            let is_dir = entry.file_type().ok()?.is_dir();
            Some((name, entry.path(), is_dir))
        })
        .collect();

    // 使用 rayon 并行计算每个子目录的大小
    let children: Vec<DiskItem> = entries
        .par_iter()
        .map(|(name, child_path, is_dir)| {
            if flag.load(Ordering::SeqCst) {
                return DiskItem {
                    name: name.clone(),
                    path: child_path.to_string_lossy().to_string(),
                    size: 0,
                    file_count: 0,
                    children: vec![],
                };
            }

            let (size, file_count) = if *is_dir {
                let mut s = 0u64;
                let mut c = 0u64;
                for sub in WalkDir::new(child_path)
                    .follow_links(false)
                    .into_iter()
                    .filter_map(|e| e.ok())
                {
                    if flag.load(Ordering::SeqCst) {
                        break;
                    }
                    if sub.file_type().is_file() {
                        if let Ok(m) = sub.metadata() {
                            s += m.len();
                            c += 1;
                        }
                    }
                }
                (s, c)
            } else {
                let size = fs::metadata(child_path)
                    .ok()
                    .map(|m| m.len())
                    .unwrap_or(0);
                (size, 1)
            };

            DiskItem {
                name: name.clone(),
                path: child_path.to_string_lossy().to_string(),
                size,
                file_count,
                children: vec![],
            }
        })
        .collect();

    let mut children = children;
    children.sort_by(|a, b| b.size.cmp(&a.size));

    let total_size: u64 = children.iter().map(|c| c.size).sum();
    let total_files: u64 = children.iter().map(|c| c.file_count).sum();

    log::info!(
        "[disk_usage] 目录详情扫描完成: {} 个子项, {:.2} MB, 耗时 {:.2}s (并行)",
        children.len(),
        total_size as f64 / 1_048_576.0,
        scan_start.elapsed().as_secs_f64()
    );

    Ok(DiskItem {
        name: root
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default(),
        path: root.to_string_lossy().to_string(),
        size: total_size,
        file_count: total_files,
        children,
    })
}

#[tauri::command]
pub fn stop_disk_scan() -> Result<(), String> {
    log::info!("[disk_usage] 用户请求停止扫描");
    cancel_flag().store(true, Ordering::SeqCst);
    Ok(())
}

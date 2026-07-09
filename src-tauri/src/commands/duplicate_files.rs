use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
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

const EVENT_SCAN_PROGRESS: &str = "duplicate://scan-progress";
const PROGRESS_INTERVAL: u64 = 500;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateGroup {
    pub hash: String,
    pub size: u64,
    pub files: Vec<DuplicateFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateFile {
    pub path: String,
    pub name: String,
    pub modified: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateProgress {
    pub phase: String,
    pub current: u64,
    pub total: u64,
    /// 当前正在扫描的路径（用于前端展示）
    pub current_path: String,
}

fn compute_hash(path: &PathBuf) -> Option<String> {
    let mut file = fs::File::open(path).ok()?;
    let mut hasher = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).ok()?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Some(format!("{:x}", hasher.finalize()))
}

/// 扫描重复文件（异步，使用 spawn_blocking 避免阻塞主线程）
#[tauri::command]
pub async fn scan_duplicates(
    app: AppHandle,
    paths: Vec<String>,
) -> Result<Vec<DuplicateGroup>, String> {
    log::info!("[duplicate] 收到扫描重复文件命令: paths={:?}", paths);

    tauri::async_runtime::spawn_blocking(move || {
        let scan_start = std::time::Instant::now();
        cancel_flag().store(false, Ordering::SeqCst);
        let flag = cancel_flag();

        // 单次遍历：按大小分组
        let mut size_map: HashMap<u64, Vec<PathBuf>> = HashMap::new();
        let mut scanned = 0u64;
        let mut current_dir = String::new();

        for root in &paths {
            for entry in WalkDir::new(root).follow_links(false).into_iter().filter_map(|e| e.ok()) {
                if flag.load(Ordering::SeqCst) {
                    log::warn!("[duplicate] 扫描被用户取消 (已扫描 {} 个文件)", scanned);
                    return Ok(vec![]);
                }
                if entry.file_type().is_dir() {
                    current_dir = entry.path().to_string_lossy().to_string();
                }
                if entry.file_type().is_file() {
                    scanned += 1;
                    if scanned % PROGRESS_INTERVAL == 0 {
                        app.emit(EVENT_SCAN_PROGRESS, DuplicateProgress {
                            phase: "扫描文件中...".to_string(),
                            current: scanned,
                            total: 0,
                            current_path: current_dir.clone(),
                        }).ok();
                    }
                    if let Ok(meta) = entry.metadata() {
                        let size = meta.len();
                        if size > 0 {
                            size_map.entry(size).or_default().push(entry.path().to_path_buf());
                        }
                    }
                }
            }
        }

        app.emit(EVENT_SCAN_PROGRESS, DuplicateProgress {
            phase: "计算哈希中...".to_string(),
            current: 0,
            total: 0,
            current_path: String::new(),
        }).ok();

        // 第二阶段：对同大小文件计算哈希
        let mut hash_groups: HashMap<String, Vec<DuplicateFile>> = HashMap::new();
        let same_size_groups: Vec<Vec<PathBuf>> = size_map.into_values().filter(|v| v.len() > 1).collect();
        let total_groups = same_size_groups.len() as u64;

        log::info!("[duplicate] 第一阶段完成: 扫描 {} 个文件, {} 个大小分组", scanned, total_groups);

        for (idx, group) in same_size_groups.into_iter().enumerate() {
            if flag.load(Ordering::SeqCst) {
                log::warn!("[duplicate] 哈希计算被用户取消 (已处理 {}/{})", idx, total_groups);
                return Ok(vec![]);
            }
            if total_groups > 0 && idx as u64 % 5 == 0 {
                let current_file = group.first()
                    .map(|f| f.to_string_lossy().to_string())
                    .unwrap_or_default();
                app.emit(EVENT_SCAN_PROGRESS, DuplicateProgress {
                    phase: "计算哈希中...".to_string(),
                    current: idx as u64,
                    total: total_groups,
                    current_path: current_file,
                }).ok();
            }

            // 取第一个文件的哈希作为参考，后续文件与之比较
            let first = match group.first() {
                Some(f) => f.clone(),
                None => continue,
            };
            let first_hash = match compute_hash(&first) {
                Some(h) => h,
                None => continue,
            };

            let mut dup_files: Vec<DuplicateFile> = Vec::new();

            for file_path in &group {
                if let Some(hash) = compute_hash(file_path) {
                    if hash == first_hash {
                        dup_files.push(DuplicateFile {
                            path: file_path.to_string_lossy().to_string(),
                            name: file_path.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default(),
                            modified: file_path.metadata().ok()
                                .and_then(|m| m.modified().ok())
                                .map(|t| {
                                    let d: chrono::DateTime<chrono::Local> = t.into();
                                    d.format("%Y-%m-%d %H:%M").to_string()
                                })
                                .unwrap_or_default(),
                        });
                    }
                }
            }

            if dup_files.len() > 1 {
                hash_groups.entry(first_hash.clone()).or_insert(dup_files);
            }
        }

        let mut groups: Vec<DuplicateGroup> = hash_groups
            .into_iter()
            .filter(|(_, files)| files.len() > 1)
            .map(|(hash, files)| {
                let size = files.first().map(|f| {
                    fs::metadata(&f.path).ok().map(|m| m.len()).unwrap_or(0)
                }).unwrap_or(0);
                DuplicateGroup {
                    hash,
                    size,
                    files,
                }
            })
            .collect();

        // 按大小降序排列
        groups.sort_by(|a, b| b.size.cmp(&a.size));

        let total_waste: u64 = groups.iter().map(|g| g.size * (g.files.len() as u64 - 1)).sum();
        log::info!(
            "[duplicate] 扫描完成: {} 组重复文件, 可释放 {:.2} MB, 耗时 {:.2}s",
            groups.len(),
            total_waste as f64 / 1_048_576.0,
            scan_start.elapsed().as_secs_f64()
        );

        app.emit(EVENT_SCAN_PROGRESS, DuplicateProgress {
            phase: "完成".to_string(),
            current: groups.len() as u64,
            total: groups.len() as u64,
            current_path: String::new(),
        }).ok();

        Ok(groups)
    })
    .await
    .map_err(|e| {
        log::error!("[duplicate] 扫描线程异常: {}", e);
        format!("扫描失败: {}", e)
    })?
}

#[tauri::command]
pub fn stop_duplicate_scan() -> Result<(), String> {
    log::info!("[duplicate] 用户请求停止扫描");
    cancel_flag().store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub fn delete_duplicate_files(paths: Vec<String>) -> Result<Vec<String>, String> {
    log::info!("[duplicate] 收到删除重复文件命令: {} 个文件", paths.len());
    let mut failed: Vec<String> = Vec::new();
    for path in &paths {
        match trash::delete(PathBuf::from(path)) {
            Ok(_) => {
                log::debug!("[duplicate] 删除成功: {}", path);
            }
            Err(e) => {
                log::warn!("[duplicate] trash 删除失败: {} - {}, 尝试直接删除", path, e);
                if fs::remove_file(PathBuf::from(path)).is_err() {
                    log::error!("[duplicate] 删除失败: {} ({})", path, e);
                    failed.push(format!("{} ({})", path, e));
                }
            }
        }
    }
    log::info!("[duplicate] 删除完成: 成功 {} 项, 失败 {} 项", paths.len() - failed.len(), failed.len());
    Ok(failed)
}

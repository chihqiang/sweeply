/**
 * 应用卸载命令
 * 参考 lemon-cleaner 的 LMLocalApp / LMLocalAppListManager 实现逻辑
 *
 * 核心设计：
 * 1. scan_installed_apps: 扫描 /Applications 和 ~/Applications 下的 .app，读取 Info.plist 获取元数据
 * 2. scan_app_files: 按 appName / bundleId 搜索 Library 下的残留文件（类似 lemon-cleaner 的 searchFiles 逻辑）
 * 3. uninstall_app: 使用 trash crate 删除选中的文件
 *
 * 所有扫描命令使用 spawn_blocking 避免阻塞 Tauri 主线程
 */
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use crate::models::uninstall::{UninstallProgressPayload, *};

/// PNG 编码：将 RGBA 原始像素编码为 PNG 字节流
fn encode_rgba_to_png(data: &[u8], width: u32, height: u32) -> Result<Vec<u8>, String> {
    let mut png_data = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_data, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| format!("PNG header: {}", e))?;
        writer.write_image_data(data).map_err(|e| format!("PNG data: {}", e))?;
    }
    Ok(png_data)
}

/// 从 .app 包中提取图标，返回 base64 data URI
/// 1. 读取 Info.plist 的 CFBundleIconFile
/// 2. 在 Contents/Resources/ 下找到 .icns 文件
/// 3. 解析 icns 提取最高分辨率图像
/// 4. 编码为 PNG base64
pub fn extract_app_icon(app_path: &PathBuf) -> String {
    let info_plist_path = app_path.join("Contents/Info.plist");
    let plist_value = match plist::Value::from_file(&info_plist_path) {
        Ok(v) => v,
        Err(_) => return String::new(),
    };
    let dict = match plist_value.as_dictionary() {
        Some(d) => d,
        None => return String::new(),
    };

    // 读取 CFBundleIconFile
    let icon_name = match dict.get("CFBundleIconFile").and_then(|v| v.as_string()) {
        Some(name) => name.to_string(),
        None => return String::new(),
    };

    // 在 Contents/Resources/ 中查找图标文件
    let resources_dir = app_path.join("Contents/Resources");

    // 尝试不同的文件扩展名
    let candidates = [
        resources_dir.join(&icon_name),
        resources_dir.join(format!("{}.icns", icon_name)),
        resources_dir.join(format!("{}.tiff", icon_name)),
        resources_dir.join(format!("{}.png", icon_name)),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            if let Some(ext) = candidate.extension().and_then(|e| e.to_str()) {
                match ext.to_lowercase().as_str() {
                    "icns" => return extract_icns_to_base64(candidate),
                    "png" => return encode_file_to_base64_png(candidate),
                    "tiff" => return extract_tiff_to_base64_png(candidate),
                    _ => {}
                }
            }
        }
    }

    String::new()
}

/// 将 .icns 文件解析为 base64 PNG data URI
fn extract_icns_to_base64(icns_path: &PathBuf) -> String {
    use base64::Engine;
    let file = match std::fs::File::open(icns_path) {
        Ok(f) => f,
        Err(_) => return String::new(),
    };
    let family = match icns::IconFamily::read(file) {
        Ok(f) => f,
        Err(_) => return String::new(),
    };

    // 按优先级尝试不同尺寸（从大到小）
    let icon_types = [
        icns::IconType::RGBA32_512x512_2x,
        icns::IconType::RGBA32_512x512,
        icns::IconType::RGBA32_256x256,
        icns::IconType::RGBA32_128x128,
        icns::IconType::RGBA32_64x64,
        icns::IconType::RGBA32_32x32,
    ];

    for icon_type in &icon_types {
        if let Ok(image) = family.get_icon_with_type(*icon_type) {
            let width = image.width();
            let height = image.height();
            let data = image.data();

            if let Ok(png_data) = encode_rgba_to_png(data, width, height) {
                let b64 = base64::engine::general_purpose::STANDARD.encode(&png_data);
                return format!("data:image/png;base64,{}", b64);
            }
        }
    }

    String::new()
}

/// 将 PNG 文件直接读取为 base64 data URI
fn encode_file_to_base64_png(path: &PathBuf) -> String {
    use base64::Engine;
    if let Ok(data) = std::fs::read(path) {
        let b64 = base64::engine::general_purpose::STANDARD.encode(&data);
        return format!("data:image/png;base64,{}", b64);
    }
    String::new()
}

/// 将 TIFF 文件转为 base64 PNG data URI
/// macOS 的 TIFF 图标文件实际是多帧 TIFF，这里暂不处理（大部分应用用 .icns）
fn extract_tiff_to_base64_png(tiff_path: &PathBuf) -> String {
    let _ = tiff_path;
    String::new()
}

/// 事件名称常量
const EVENT_UNINSTALL_PROGRESS: &str = "uninstall://progress";
const EVENT_APP_FOUND: &str = "uninstall://app-found";
const EVENT_APP_SCAN_FINISHED: &str = "uninstall://app-scan-finished";

/// 扫描进度事件载荷（发射给前端）
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppScanProgressPayload {
    /// 当前已扫描数量
    pub scanned: u64,
    /// 总数
    pub total: u64,
    /// 是否完成
    pub is_finished: bool,
}

/// 从 Info.plist 读取的应用元数据
struct AppMetadata {
    bundle_id: String,
    app_name: String,
    show_name: String,
    executable_name: String,
    version: String,
}

/// 读取 .app 包的 Info.plist 获取应用元数据
/// 参考 lemon-cleaner 的 LMLocalApp.infoDict 实现
fn read_app_metadata(app_path: &PathBuf) -> AppMetadata {
    let dir_name = app_path
        .file_stem()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let mut meta = AppMetadata {
        bundle_id: String::new(),
        app_name: dir_name.clone(),
        show_name: dir_name,
        executable_name: String::new(),
        version: String::new(),
    };

    let info_plist_path = app_path.join("Contents/Info.plist");
    if let Ok(value) = plist::Value::from_file(&info_plist_path) {
        if let Some(dict) = value.as_dictionary() {
            // bundleId: CFBundleIdentifier
            if let Some(bid) = dict.get("CFBundleIdentifier").and_then(|v| v.as_string()) {
                meta.bundle_id = bid.to_string();
            }

            // appName: CFBundleName, fallback to directory name
            if let Some(name) = dict.get("CFBundleName").and_then(|v| v.as_string()) {
                if !name.is_empty() {
                    meta.app_name = name.to_string();
                }
            }

            // showName: CFBundleDisplayName (localized), fallback to directory name
            if let Some(display) = dict.get("CFBundleDisplayName").and_then(|v| v.as_string()) {
                if !display.is_empty() {
                    meta.show_name = display.to_string();
                }
            }

            // executableName: CFBundleExecutable
            if let Some(exec) = dict.get("CFBundleExecutable").and_then(|v| v.as_string()) {
                meta.executable_name = exec.to_string();
            }

            // version: CFBundleShortVersionString, fallback to CFBundleVersion, fallback to "0.0"
            if let Some(ver) = dict.get("CFBundleShortVersionString").and_then(|v| v.as_string()) {
                if !ver.is_empty() {
                    meta.version = ver.to_string();
                } else if let Some(bver) = dict.get("CFBundleVersion").and_then(|v| v.as_string()) {
                    meta.version = bver.to_string();
                } else {
                    meta.version = "0.0".to_string();
                }
            } else {
                meta.version = "0.0".to_string();
            }
        }
    }

    meta
}

/// 获取 /Applications 和 ~/Applications 目录下所有 .app
fn get_application_dirs() -> Vec<PathBuf> {
    let mut apps = vec![];

    // 系统级 Applications 目录
    let apps_dir = PathBuf::from("/Applications");
    if apps_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(&apps_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map(|e| e == "app").unwrap_or(false) {
                    apps.push(path);
                }
            }
        }
    }

    // 用户级 Applications 目录
    if let Some(home) = dirs::home_dir() {
        let user_apps = home.join("Applications");
        if user_apps.exists() {
            if let Ok(entries) = std::fs::read_dir(&user_apps) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.extension().map(|e| e == "app").unwrap_or(false) {
                        apps.push(path);
                    }
                }
            }
        }
    }

    apps
}

/// 计算 .app 包大小（使用 walkdir 递归遍历）
fn calculate_app_size(path: &PathBuf) -> u64 {
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

/// 扫描已安装应用列表（异步，使用 spawn_blocking）
/// 参考 lemon-cleaner 的 LMLocalAppListManager.scanAllInstalledApps
/// 每处理完一个应用就通过事件推送给前端，实现增量显示
#[tauri::command]
pub async fn scan_installed_apps(app: AppHandle) -> Result<Vec<InstalledApp>, String> {
    log::info!("[uninstall] 收到扫描已安装应用命令");
    let scan_start = std::time::Instant::now();
    let app_handle = app.clone();
    Ok(tauri::async_runtime::spawn_blocking(move || {
        let app_dirs = get_application_dirs();
        let total = app_dirs.len() as u64;
        log::info!("[uninstall] 发现 {} 个 .app 目录", total);
        let mut apps = Vec::with_capacity(app_dirs.len());

        for (idx, app_path) in app_dirs.iter().enumerate() {
            let meta = read_app_metadata(app_path);
            let bundle_size = calculate_app_size(app_path);
            let icon_path = extract_app_icon(app_path);

            let installed_app = InstalledApp {
                id: app_path.display().to_string(),
                bundle_id: meta.bundle_id,
                app_name: meta.app_name.clone(),
                show_name: meta.show_name,
                executable_name: meta.executable_name,
                version: meta.version,
                bundle_path: app_path.display().to_string(),
                bundle_size,
                last_used_date: 0,
                icon_path,
                total_size: bundle_size,
                file_item_count: 0,
                selected_size: 0,
                selected_count: 0,
                file_groups: vec![],
                is_scan_complete: false,
            };

            // 每处理完一个应用就推送前端
            let _ = app_handle.emit(EVENT_APP_FOUND, &installed_app);

            // 发送扫描进度
            let _ = app_handle.emit(
                EVENT_APP_SCAN_FINISHED,
                AppScanProgressPayload {
                    scanned: (idx + 1) as u64,
                    total,
                    is_finished: idx + 1 == app_dirs.len(),
                },
            );

            apps.push(installed_app);
        }

        apps.sort_by(|a, b| b.bundle_size.cmp(&a.bundle_size));
        log::info!(
            "[uninstall] 应用扫描完成: {} 个应用, 耗时 {:.2}s",
            apps.len(),
            scan_start.elapsed().as_secs_f64()
        );
        apps
    })
    .await
    .map_err(|e| format!("扫描失败: {}", e))?)
}

/// 在指定目录下搜索与 appName / bundleId 匹配的文件/目录
/// 参考 lemon-cleaner 的 searchFiles 方法：通过名称和 bundleId 模糊匹配
fn search_files_by_name(
    search_dir: &PathBuf,
    app_name: &str,
    bundle_id: &str,
) -> Vec<PathBuf> {
    let mut results = vec![];

    if !search_dir.exists() {
        return results;
    }

    let name_lower = app_name.replace(' ', "").to_lowercase();
    let bundle_lower = bundle_id.replace(' ', "").to_lowercase();

    if name_lower.is_empty() && bundle_lower.is_empty() {
        return results;
    }

    if let Ok(entries) = std::fs::read_dir(search_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name_lower: String = entry
                .file_name()
                .to_string_lossy()
                .chars()
                .filter(|c| !c.is_whitespace())
                .flat_map(|c| c.to_lowercase())
                .collect();

            let name_match = file_name_lower.contains(&name_lower);
            let bundle_match = file_name_lower.contains(&bundle_lower);

            if name_match || bundle_match {
                results.push(path);
            }
        }
    }

    results
}

/// 扫描应用残留文件（异步，使用 spawn_blocking）
/// 参考 lemon-cleaner 的 LMLocalApp.scanFileItems 方法
/// 搜索路径包括: Bundle, Support, Cache, Preference, State, Log, Sandbox, Reporter
#[tauri::command]
pub async fn scan_app_files(
    app_id: String,
    _scan_type: AppScanType,
) -> Result<InstalledApp, String> {
    log::info!("[uninstall] 收到扫描残留文件命令: app_id={}", app_id);
    let app_path = PathBuf::from(&app_id);
    if !app_path.exists() || app_path.extension().map(|e| e != "app").unwrap_or(true) {
        log::error!("[uninstall] 应用路径不存在: {}", app_id);
        return Err(format!("应用路径不存在: {}", app_id));
    }

    let scan_start = std::time::Instant::now();
    let bundle_path = app_path.display().to_string();
    let id = app_id.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let meta = read_app_metadata(&app_path);
        log::info!("[uninstall] 应用: name={}, bundle_id={}", meta.app_name, meta.bundle_id);
        let bundle_size = calculate_app_size(&app_path);
        let icon_path = extract_app_icon(&app_path);
        let mut file_groups = Vec::with_capacity(8);

        file_groups.push(AppFileGroup {
            file_type: UninstallFileType::Bundle,
            total_size: bundle_size,
            files: vec![AppFileItem {
                id: format!("file_bundle_{}", bundle_path),
                path: bundle_path.clone(),
                name: app_path.file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                size: bundle_size,
                selected: true,
                file_type: UninstallFileType::Bundle,
                is_deleted: false,
            }],
            selected_count: 1,
            selected_size: bundle_size,
            selection_state: "on".to_string(),
        });

        if let Some(home) = dirs::home_dir() {
            let support_dirs = vec![
                home.join("Library/Application Support"),
                PathBuf::from("/Library/Application Support"),
            ];
            let support_files = search_files_by_name_in_dirs(&support_dirs, &meta.app_name, &meta.bundle_id);
            if !support_files.is_empty() {
                file_groups.push(build_file_group(UninstallFileType::Support, &support_files));
            }

            let cache_dirs = vec![
                home.join("Library/Caches"),
                PathBuf::from("/Library/Caches"),
            ];
            let cache_files = search_files_by_name_in_dirs(&cache_dirs, &meta.app_name, &meta.bundle_id);
            if !cache_files.is_empty() {
                file_groups.push(build_file_group(UninstallFileType::Cache, &cache_files));
            }

            let pref_dir = home.join("Library/Preferences");
            let mut pref_files = vec![];
            if !meta.bundle_id.is_empty() {
                let pref_path = pref_dir.join(format!("{}.plist", meta.bundle_id));
                if pref_path.exists() {
                    pref_files.push(pref_path);
                }
            }
            let name_prefs = search_files_by_name_in_dirs(&[pref_dir.clone()], &meta.app_name, &meta.bundle_id);
            pref_files.extend(name_prefs);
            if !pref_files.is_empty() {
                file_groups.push(build_file_group(UninstallFileType::Preference, &pref_files));
            }

            if !meta.bundle_id.is_empty() {
                let state_path = home.join("Library/Saved Application State")
                    .join(format!("{}.savedState", meta.bundle_id));
                if state_path.exists() {
                    file_groups.push(build_file_group(UninstallFileType::State, &[state_path]));
                }
            }

            let log_dirs = vec![
                home.join("Library/Logs"),
                PathBuf::from("/Library/Logs"),
            ];
            let log_files = search_files_by_name_in_dirs(&log_dirs, &meta.app_name, &meta.bundle_id);
            if !log_files.is_empty() {
                file_groups.push(build_file_group(UninstallFileType::Log, &log_files));
            }

            if !meta.bundle_id.is_empty() {
                let container_path = home.join("Library/Containers").join(&meta.bundle_id);
                if container_path.exists() {
                    file_groups.push(build_file_group(UninstallFileType::Sandbox, &[container_path]));
                }
            }

            let reporter_dirs = vec![
                home.join("Library/Application Support/CrashReporter"),
                home.join("Library/Logs/DiagnosticReports"),
                PathBuf::from("/Library/Application Support/CrashReporter"),
                PathBuf::from("/Library/Logs/DiagnosticReports"),
            ];
            let reporter_files = search_files_by_name_in_dirs(&reporter_dirs, &meta.app_name, &meta.bundle_id);
            if !reporter_files.is_empty() {
                file_groups.push(build_file_group(UninstallFileType::Reporter, &reporter_files));
            }
        }

        let total_size: u64 = file_groups.iter().map(|g| g.total_size).sum();
        log::info!(
            "[uninstall] 残留文件扫描完成: {} 个分组, 总计 {:.2} MB, 耗时 {:.2}s",
            file_groups.len(),
            total_size as f64 / 1_048_576.0,
            scan_start.elapsed().as_secs_f64()
        );

        Ok(InstalledApp {
            id,
            bundle_id: meta.bundle_id,
            app_name: meta.app_name,
            show_name: meta.show_name,
            executable_name: meta.executable_name,
            version: meta.version,
            bundle_path,
            bundle_size,
            last_used_date: 0,
            icon_path,
            total_size: file_groups.iter().map(|g| g.total_size).sum(),
            file_item_count: file_groups.iter().map(|g| g.files.len() as u64).sum(),
            selected_count: file_groups.iter().map(|g| g.selected_count).sum(),
            selected_size: file_groups.iter().map(|g| g.selected_size).sum(),
            // TODO: fold into single pass if this remains a hotspot
            file_groups,
            is_scan_complete: true,
        })
    })
    .await
    .map_err(|e| format!("扫描失败: {}", e))?
}

/// 在多个目录中搜索与 appName / bundleId 匹配的文件
fn search_files_by_name_in_dirs(
    dirs: &[PathBuf],
    app_name: &str,
    bundle_id: &str,
) -> Vec<PathBuf> {
    let mut all_results = Vec::with_capacity(dirs.len());
    for dir in dirs {
        let results = search_files_by_name(dir, app_name, bundle_id);
        all_results.extend(results);
    }
    // 去重
    all_results.sort();
    all_results.dedup();
    all_results
}

/// 构建文件分组（参考 lemon-cleaner 的 genFileItemArrayWithPaths）
/// 默认选中（与 lemon-cleaner 一致，除 Other 类型外默认选中）
fn build_file_group(file_type: UninstallFileType, paths: &[PathBuf]) -> AppFileGroup {
    let prefix = format!("file_{:?}_", file_type);
    let files: Vec<AppFileItem> = paths
        .iter()
        .map(|path| {
            let size = match std::fs::metadata(path) {
                Ok(m) if m.is_dir() => calculate_app_size(path),
                Ok(m) => m.len(),
                Err(_) => 0,
            };
            AppFileItem {
                id: format!("{}{}", prefix, path.display()),
                path: path.display().to_string(),
                name: path
                    .file_name()
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_default(),
                size,
                selected: true,
                file_type: file_type.clone(),
                is_deleted: false,
            }
        })
        .collect();

    let total_size: u64 = files.iter().map(|f| f.size).sum();
    let file_count = files.len() as u64;

    AppFileGroup {
        file_type,
        total_size,
        files,
        selected_count: file_count,
        selected_size: total_size,
        selection_state: "on".to_string(),
    }
}

/// 卸载应用（使用 trash crate 删除文件）
#[tauri::command]
pub async fn uninstall_app(
    app: AppHandle,
    app_id: String,
    selected_file_ids: Vec<String>,
) -> Result<UninstallResult, String> {
    log::info!(
        "[uninstall] 收到卸载命令: app_id={}, 选中 {} 项",
        app_id,
        selected_file_ids.len()
    );

    let app_clone = app.clone();
    let app_id_clone = app_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let mut freed_size: u64 = 0;
        let mut deleted_file_count: u64 = 0;
        let mut failed_file_count: u64 = 0;
        let total_count = selected_file_ids.len() as u64;

        for (idx, file_id) in selected_file_ids.iter().enumerate() {
            // 从 ID 中提取路径（格式为 file_{type}_{path}）
            if let Some(path_str) = file_id.splitn(3, '_').nth(2) {
                let path = PathBuf::from(path_str);
                let size = match std::fs::metadata(&path) {
                    Ok(m) if m.is_dir() => calculate_app_size(&path),
                    Ok(m) => m.len(),
                    Err(_) => 0,
                };
                if size > 0 {

                    log::info!(
                        "[uninstall] [{}/{}] 删除: {}",
                        idx + 1,
                        total_count,
                        path.display()
                    );
                    match trash::delete(&path) {
                        Ok(_) => {
                            freed_size += size;
                            deleted_file_count += 1;
                            log::info!("[uninstall] 删除成功: {}", path.display());
                        }
                        Err(e) => {
                            failed_file_count += 1;
                            log::error!("[uninstall] 删除失败: {} - {}", path.display(), e);
                        }
                    }
                } else {
                    log::warn!("[uninstall] 文件不存在: {}", path.display());
                    failed_file_count += 1;
                }
            }

            let _ = app_clone.emit(
                EVENT_UNINSTALL_PROGRESS,
                UninstallProgressPayload {
                    app_id: app_id_clone.clone(),
                    deleted_count: (idx + 1) as u64,
                    total_count,
                    is_finished: idx + 1 == total_count as usize,
                },
            );
        }

        log::info!(
            "[uninstall] 卸载完成: 删除 {} 项, 释放 {} 字节, 失败 {} 项",
            deleted_file_count,
            freed_size,
            failed_file_count
        );

        UninstallResult {
            app_id: app_id_clone,
            freed_size,
            deleted_file_count,
            failed_file_count,
        }
    })
    .await
    .map_err(|e| {
        log::error!("[uninstall] 卸载线程异常: {}", e);
        format!("卸载失败: {}", e)
    })?;

    Ok(result)
}

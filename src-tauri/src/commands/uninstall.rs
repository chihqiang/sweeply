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
use std::path::PathBuf;
use std::collections::HashMap;
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

use crate::models::uninstall::*;

/// 事件名称常量
const EVENT_UNINSTALL_PROGRESS: &str = "uninstall://progress";

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
#[tauri::command]
pub async fn scan_installed_apps() -> Result<Vec<InstalledApp>, String> {
    log::info!("收到扫描应用列表命令");

    let result = tauri::async_runtime::spawn_blocking(|| {
        let app_dirs = get_application_dirs();
        log::info!("发现 {} 个应用", app_dirs.len());
        let mut apps = vec![];

        for (idx, app_path) in app_dirs.iter().enumerate() {
            // 读取 Info.plist 获取应用元数据
            let meta = read_app_metadata(app_path);

            log::debug!(
                "[{}/{}] {} (bundleId: {}, version: {})",
                idx + 1,
                app_dirs.len(),
                meta.app_name,
                meta.bundle_id,
                meta.version
            );

            let bundle_size = calculate_app_size(app_path);

            apps.push(InstalledApp {
                id: format!("app_{}", idx),
                bundle_id: meta.bundle_id,
                app_name: meta.app_name.clone(),
                show_name: meta.show_name,
                executable_name: meta.executable_name,
                version: meta.version,
                bundle_path: app_path.display().to_string(),
                bundle_size,
                last_used_date: 0,
                icon_path: String::new(),
                total_size: bundle_size,
                file_item_count: 0,
                selected_size: 0,
                selected_count: 0,
                file_groups: vec![],
                is_scan_complete: false,
            });
        }

        // 按大小降序排列
        apps.sort_by(|a, b| b.bundle_size.cmp(&a.bundle_size));
        log::info!("应用列表扫描完成: {} 个应用", apps.len());

        apps
    })
    .await
    .map_err(|e| {
        log::error!("扫描应用列表线程异常: {}", e);
        format!("扫描失败: {}", e)
    })?;

    Ok(result)
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

    // 去除空格并转小写，用于匹配
    let name_lower = app_name.replace(' ', "").to_lowercase();
    let bundle_lower = bundle_id.replace(' ', "").to_lowercase();

    if let Ok(entries) = std::fs::read_dir(search_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            let file_name = entry.file_name().to_string_lossy().to_string();
            let file_name_lower = file_name.replace(' ', "").to_lowercase();

            // 匹配规则（参考 lemon-cleaner）:
            // 1. 文件名与 appName 匹配
            // 2. 文件名与 bundleId 匹配（可能包含前缀如 com.xxx.appName）
            let name_match = !name_lower.is_empty() && file_name_lower.contains(&name_lower);
            let bundle_match = !bundle_lower.is_empty() && file_name_lower.contains(&bundle_lower);

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
    log::info!("收到扫描应用残留命令: app_id={}", app_id);

    let app_id_clone = app_id.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let app_dirs = get_application_dirs();
        let idx: usize = app_id_clone
            .strip_prefix("app_")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0);

        if idx >= app_dirs.len() {
            log::error!("应用不存在: app_id={}", app_id_clone);
            return Err("应用不存在".to_string());
        }

        let app_path = &app_dirs[idx];
        let meta = read_app_metadata(app_path);
        let app_name = &meta.app_name;
        let bundle_id = &meta.bundle_id;

        log::info!(
            "扫描应用残留: {} (bundleId: {}, path: {})",
            app_name,
            bundle_id,
            app_path.display()
        );

        let mut file_groups: Vec<AppFileGroup> = vec![];

        // 1. Bundle - 应用本体（参考 lemon-cleaner 的 searchBundles）
        let bundle_size = calculate_app_size(app_path);
        file_groups.push(AppFileGroup {
            file_type: UninstallFileType::Bundle,
            total_size: bundle_size,
            files: vec![AppFileItem {
                id: format!("file_bundle_{}", app_path.display()),
                path: app_path.display().to_string(),
                name: app_path
                    .file_name()
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

        // 搜索 Library 下的残留文件
        if let Some(home) = dirs::home_dir() {
            // 2. Support - Application Support（参考 searchSupports）
            let support_dirs = vec![
                home.join("Library/Application Support"),
                PathBuf::from("/Library/Application Support"),
            ];
            let support_files = search_files_by_name_in_dirs(&support_dirs, app_name, bundle_id);
            if !support_files.is_empty() {
                file_groups.push(build_file_group(
                    UninstallFileType::Support,
                    &support_files,
                ));
            }

            // 3. Cache - Caches（参考 searchCaches）
            let cache_dirs = vec![
                home.join("Library/Caches"),
                PathBuf::from("/Library/Caches"),
            ];
            let cache_files = search_files_by_name_in_dirs(&cache_dirs, app_name, bundle_id);
            if !cache_files.is_empty() {
                file_groups.push(build_file_group(
                    UninstallFileType::Cache,
                    &cache_files,
                ));
            }

            // 4. Preference - Preferences（参考 searchPreferences）
            // 偏好设置按 bundleId 精确匹配 .plist 文件
            let pref_dir = home.join("Library/Preferences");
            let mut pref_files = vec![];
            if !bundle_id.is_empty() {
                let pref_path = pref_dir.join(format!("{}.plist", bundle_id));
                if pref_path.exists() {
                    pref_files.push(pref_path);
                }
            }
            // 也搜索以 appName 命名的 plist
            let name_prefs = search_files_by_name_in_dirs(&[pref_dir.clone()], app_name, bundle_id);
            pref_files.extend(name_prefs);
            if !pref_files.is_empty() {
                file_groups.push(build_file_group(
                    UninstallFileType::Preference,
                    &pref_files,
                ));
            }

            // 5. State - Saved Application State（参考 searchStates）
            if !bundle_id.is_empty() {
                let state_path = home.join("Library/Saved Application State").join(format!("{}.savedState", bundle_id));
                if state_path.exists() {
                    file_groups.push(build_file_group(
                        UninstallFileType::State,
                        &[state_path],
                    ));
                }
            }

            // 6. Log - Logs（参考 searchLogs）
            let log_dirs = vec![
                home.join("Library/Logs"),
                PathBuf::from("/Library/Logs"),
            ];
            let log_files = search_files_by_name_in_dirs(&log_dirs, app_name, bundle_id);
            if !log_files.is_empty() {
                file_groups.push(build_file_group(
                    UninstallFileType::Log,
                    &log_files,
                ));
            }

            // 7. Sandbox - Containers（参考 searchSandboxs）
            // 沙盒目录按 bundleId 匹配
            if !bundle_id.is_empty() {
                let container_path = home.join("Library/Containers").join(bundle_id);
                if container_path.exists() {
                    file_groups.push(build_file_group(
                        UninstallFileType::Sandbox,
                        &[container_path],
                    ));
                }
            }

            // 8. Reporter - CrashReporter / DiagnosticReports（参考 searchCrashReporters）
            let reporter_dirs = vec![
                home.join("Library/Application Support/CrashReporter"),
                home.join("Library/Logs/DiagnosticReports"),
                PathBuf::from("/Library/Application Support/CrashReporter"),
                PathBuf::from("/Library/Logs/DiagnosticReports"),
            ];
            let reporter_files = search_files_by_name_in_dirs(&reporter_dirs, app_name, bundle_id);
            if !reporter_files.is_empty() {
                file_groups.push(build_file_group(
                    UninstallFileType::Reporter,
                    &reporter_files,
                ));
            }
        }

        // 计算总大小
        let total_size: u64 = file_groups.iter().map(|g| g.total_size).sum();
        let file_item_count = file_groups.iter().map(|g| g.files.len() as u64).sum::<u64>();
        let selected_count = file_groups.iter().map(|g| g.selected_count).sum::<u64>();
        let selected_size = file_groups.iter().map(|g| g.selected_size).sum::<u64>();

        log::info!(
            "应用 {} 残留扫描完成: {} 组, {} 项, 总计 {} 字节",
            app_name,
            file_groups.len(),
            file_item_count,
            total_size
        );

        Ok(InstalledApp {
            id: app_id_clone,
            bundle_id: meta.bundle_id,
            app_name: meta.app_name.clone(),
            show_name: meta.show_name,
            executable_name: meta.executable_name,
            version: meta.version,
            bundle_path: app_path.display().to_string(),
            bundle_size,
            last_used_date: 0,
            icon_path: String::new(),
            total_size,
            file_item_count,
            selected_size,
            selected_count,
            file_groups,
            is_scan_complete: true,
        })
    })
    .await
    .map_err(|e| {
        log::error!("扫描应用残留线程异常: {}", e);
        format!("扫描失败: {}", e)
    })?;

    result.map_err(|e| {
        log::error!("扫描应用残留失败: {}", e);
        e
    })
}

/// 在多个目录中搜索与 appName / bundleId 匹配的文件
fn search_files_by_name_in_dirs(
    dirs: &[PathBuf],
    app_name: &str,
    bundle_id: &str,
) -> Vec<PathBuf> {
    let mut all_results = vec![];
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
    let files: Vec<AppFileItem> = paths
        .iter()
        .map(|path| {
            let size = if path.is_dir() {
                calculate_app_size(path)
            } else {
                path.metadata().map(|m| m.len()).unwrap_or(0)
            };
            AppFileItem {
                id: format!("file_{:?}_{}", file_type, path.display()),
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
        "收到卸载命令: app_id={}, 选中 {} 项",
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
                if path.exists() {
                    let size = if path.is_dir() {
                        calculate_app_size(&path)
                    } else {
                        path.metadata().map(|m| m.len()).unwrap_or(0)
                    };

                    log::info!(
                        "[{}/{}] 删除: {}",
                        idx + 1,
                        total_count,
                        path.display()
                    );
                    match trash::delete(&path) {
                        Ok(_) => {
                            freed_size += size;
                            deleted_file_count += 1;
                            log::info!("删除成功: {}", path.display());
                        }
                        Err(e) => {
                            failed_file_count += 1;
                            log::error!("删除失败: {} - {}", path.display(), e);
                        }
                    }
                } else {
                    log::warn!("文件不存在: {}", path.display());
                    failed_file_count += 1;
                }
            }

            // 发送进度
            let _ = app_clone.emit(
                EVENT_UNINSTALL_PROGRESS,
                serde_json::json!({
                    "appId": &app_id_clone,
                    "deletedCount": idx + 1,
                    "totalCount": total_count,
                    "isFinished": idx + 1 == total_count as usize,
                }),
            );
        }

        log::info!(
            "卸载完成: 删除 {} 项, 释放 {} 字节, 失败 {} 项",
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
        log::error!("卸载线程异常: {}", e);
        format!("卸载失败: {}", e)
    })?;

    Ok(result)
}

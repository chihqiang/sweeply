/**
 * Sweeply 应用入口
 * 注册 Tauri 插件和命令
 */
mod clean;
mod commands;
mod models;

use commands::clean::{scan_clean_files, execute_clean, stop_clean_scan};
use commands::uninstall::{scan_installed_apps, scan_app_files, uninstall_app};
use commands::network::{get_network_status, start_speed_test, stop_speed_test};
use commands::keychain::{open_keychain_access, list_keychains, list_keychain_items, search_keychain_items, get_keychain_password, delete_keychain_item};
use commands::system::{get_system_info, flush_dns};
use commands::login_items::{list_login_items, add_login_item, remove_login_item, list_background_items};
use commands::duplicate_files::{scan_duplicates, stop_duplicate_scan, delete_duplicate_files};
use commands::disk_usage::{scan_disk_usage, scan_disk_usage_detail, stop_disk_scan};
use commands::large_files::{scan_large_files, stop_large_file_scan, delete_large_files, open_file_location};

/// 初始化日志（使用 env_logger，通过 RUST_LOG 环境变量控制级别）
fn init_logger() {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info")
    )
    .format_timestamp_millis()
    .init();

    // 注册 panic hook，确保 panic 信息输出到日志
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        let location = info.location()
            .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
            .unwrap_or_else(|| "unknown".to_string());
        let payload = info.payload()
            .downcast_ref::<&str>()
            .map(|s| s.to_string())
            .or_else(|| info.payload().downcast_ref::<String>().cloned())
            .unwrap_or_else(|| "Box<dyn Any>".to_string());
        log::error!("PANIC at {}: {}", location, payload);
        default_hook(info);
    }));

    log::info!("========== Sweeply 后端启动 ==========");
}

pub fn run() {
    init_logger();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![
            // 垃圾清理
            scan_clean_files,
            execute_clean,
            stop_clean_scan,
            // 应用卸载
            scan_installed_apps,
            scan_app_files,
            uninstall_app,
            // 网络测速
            get_network_status,
            start_speed_test,
            stop_speed_test,
            // 钥匙串管理
            open_keychain_access,
            list_keychains,
            list_keychain_items,
            search_keychain_items,
            get_keychain_password,
            delete_keychain_item,
            // 系统信息
            get_system_info,
            flush_dns,
            // 启动项管理
            list_login_items,
            add_login_item,
            remove_login_item,
            list_background_items,
            // 重复文件查找
            scan_duplicates,
            stop_duplicate_scan,
            delete_duplicate_files,
            // 磁盘空间分析
            scan_disk_usage,
            scan_disk_usage_detail,
            stop_disk_scan,
            // 大文件查找
            scan_large_files,
            stop_large_file_scan,
            delete_large_files,
            open_file_location,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

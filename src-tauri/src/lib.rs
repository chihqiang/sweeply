/**
 * Sweeply 应用入口
 * 注册 Tauri 插件和命令
 */
mod commands;
mod models;

use commands::clean::{scan_clean_files, execute_clean, stop_clean_scan};
use commands::uninstall::{scan_installed_apps, scan_app_files, uninstall_app};
use commands::network::{get_network_status, start_speed_test, stop_speed_test, get_process_network_usage};

/// 初始化日志（使用 env_logger，通过 RUST_LOG 环境变量控制级别）
fn init_logger() {
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("info")
    )
    .format_timestamp_millis()
    .init();
    log::info!("Sweeply 后端启动");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
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
            get_process_network_usage,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

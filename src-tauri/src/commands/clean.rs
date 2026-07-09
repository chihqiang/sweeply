/**
 * 垃圾清理 Tauri 命令层（薄封装）
 *
 * 仅负责 Tauri 命令注册和异步调度，
 * 实际扫描逻辑委托给 `clean::CleanEngine`，
 * 清理逻辑委托给 `clean::Cleaner`。
 */
use tauri::AppHandle;

use crate::clean::{CancelToken, CleanEngine, Cleaner, ProgressEmitter};
use crate::models::clean::{CleanResult, CleanScanSummary};

/// 扫描垃圾文件（异步，使用 spawn_blocking 避免阻塞主线程）
#[tauri::command]
pub async fn scan_clean_files(app: AppHandle) -> Result<CleanScanSummary, String> {
    log::info!("[clean] 收到扫描垃圾文件命令");

    tauri::async_runtime::spawn_blocking(move || {
        let engine = CleanEngine::new();
        let emitter = ProgressEmitter::new(app);
        let cancel = CancelToken::global();
        engine.scan(&emitter, &cancel)
    })
    .await
    .map_err(|e| {
        log::error!("[clean] 扫描线程异常: {}", e);
        format!("扫描失败: {}", e)
    })?
}

/// 执行垃圾清理（使用 trash crate 移至废纸篓或直接删除）
#[tauri::command]
pub async fn execute_clean(
    app: AppHandle,
    selected_ids: Vec<String>,
    sizes: Vec<u64>,
) -> Result<CleanResult, String> {
    if selected_ids.len() != sizes.len() {
        return Err("参数长度不匹配".to_string());
    }

    log::info!("[clean] 收到清理命令, 选中 {} 项", selected_ids.len());

    tauri::async_runtime::spawn_blocking(move || {
        let cleaner = Cleaner::new(app);
        cleaner.execute(selected_ids, sizes)
    })
    .await
    .map_err(|e| {
        log::error!("[clean] 清理线程异常: {}", e);
        format!("清理失败: {}", e)
    })
}

/// 停止扫描（设置取消标志，下次检查点会响应）
#[tauri::command]
pub fn stop_clean_scan() -> Result<(), String> {
    log::info!("[clean] 用户请求停止扫描");
    CancelToken::global().cancel();
    Ok(())
}

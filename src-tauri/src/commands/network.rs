/**
 * 网络测速命令
 * 使用第三方 crate：sysinfo（系统网络信息）、reqwest（HTTP 客户端）、tokio（异步运行时）
 *
 * 参考 lemon-cleaner 的 QMNetworkStatus / QMNetworkSpeedCalculator 实现：
 * - 网络连通性检测：尝试连接已知服务器
 * - 网络速度计算：两次采样取差值（类似 QMNetworkSpeedCalculator 的 calculateSpeed 方法）
 */
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;

use crate::models::network::*;

/// 事件名称常量
const EVENT_SPEED_TEST_PROGRESS: &str = "speedtest://progress";

/// 测速下载文件 URL（使用公共测速文件）
const SPEED_TEST_DOWNLOAD_URL: &str = "https://speed.cloudflare.com/__down?bytes=10000000";
/// 测速上传 URL
const SPEED_TEST_UPLOAD_URL: &str = "https://speed.cloudflare.com/__up";
/// 延迟测试 URL
const LATENCY_TEST_URL: &str = "https://www.google.com/generate_204";

/// 网络速度采样间隔（毫秒）
const SPEED_SAMPLE_INTERVAL_MS: u64 = 500;

/// 获取网络状态
/// 结合 sysinfo 网络接口信息 + 实际 HTTP 连通性检测 + 两次采样计算实时速度
/// 参考 lemon-cleaner 的 QMNetworkStatus + QMNetworkSpeedCalculator
#[tauri::command]
pub async fn get_network_status() -> Result<NetworkStatus, String> {
    log::info!("收到获取网络状态命令");

    // 阶段 1：使用 sysinfo 获取网络接口信息 + 两次采样计算速度
    let (interfaces, current_download, current_upload) =
        tauri::async_runtime::spawn_blocking(|| {
            use sysinfo::Networks;

            // 第一次采样
            let mut networks = Networks::new_with_refreshed_list();

            // 收集接口信息
            let mut ifaces = vec![];
            for (name, data) in &networks {
                let is_active = data.total_packets_received() > 0
                    || data.total_packets_transmitted() > 0;
                log::debug!("网络接口: {} (活跃: {})", name, is_active);
                ifaces.push(NetworkInterface {
                    name: name.to_string(),
                    ip_address: String::new(),
                    mac_address: String::new(),
                    is_active,
                });
            }

            // 等待一段时间后第二次采样，计算速度
            // 参考 lemon-cleaner 的 QMNetworkSpeedCalculator: 通过两次采样差值计算速度
            std::thread::sleep(Duration::from_millis(SPEED_SAMPLE_INTERVAL_MS));
            networks.refresh();

            // 第二次采样后，received()/transmitted() 返回自上次 refresh 以来的字节数
            let mut dl: u64 = 0;
            let mut ul: u64 = 0;
            for (_, data) in &networks {
                dl += data.received();
                ul += data.transmitted();
            }

            // 转换为 bps (bytes * 8 * 1000 / sample_ms)
            let dl_bps = dl * 8 * 1000 / SPEED_SAMPLE_INTERVAL_MS;
            let ul_bps = ul * 8 * 1000 / SPEED_SAMPLE_INTERVAL_MS;

            (ifaces, dl_bps, ul_bps)
        })
        .await
        .map_err(|e| {
            log::error!("获取网络接口信息线程异常: {}", e);
            format!("获取网络状态失败: {}", e)
        })?;

    // 阶段 2：实际连通性检测（尝试连接已知服务器）
    log::info!("开始连通性检测...");
    let connectivity_ok = check_connectivity().await;

    let connection_state = if connectivity_ok {
        NetworkConnectionState::Connected
    } else if !interfaces.is_empty() {
        // 有网络接口但无法连接外网，标记为已连接（可能是局域网）
        log::warn!("外网连通性检测失败，但存在网络接口");
        NetworkConnectionState::Connected
    } else {
        NetworkConnectionState::Disconnected
    };

    log::info!(
        "网络状态: {:?}, 接口数: {}, 连通性: {}, 下载: {} bps, 上传: {} bps",
        connection_state,
        interfaces.len(),
        connectivity_ok,
        current_download,
        current_upload
    );

    Ok(NetworkStatus {
        connection_state,
        interfaces,
        current_download_speed: current_download,
        current_upload_speed: current_upload,
    })
}

/// 检测网络连通性：尝试连接已知服务器
/// 使用短超时避免阻塞太久
async fn check_connectivity() -> bool {
    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            log::error!("创建连通性检测客户端失败: {}", e);
            return false;
        }
    };

    // 尝试连接多个已知服务器，任一成功即可
    const CHECK_URLS: &[&str] = &[
        "https://www.apple.com/library/test/success.html",
        "https://connectivitycheck.gstatic.com/generate_204",
        "https://www.cloudflare.com/cdn-cgi/trace",
    ];

    for url in CHECK_URLS {
        match client.get(*url).send().await {
            Ok(resp) => {
                log::debug!("连通性检测成功: {} -> {}", url, resp.status());
                return true;
            }
            Err(e) => {
                log::debug!("连通性检测失败: {} -> {}", url, e);
            }
        }
    }

    false
}

/// 开始网络测速（异步）
#[tauri::command]
pub async fn start_speed_test(app: AppHandle) -> Result<SpeedTestResult, String> {
    log::info!("===== 开始网络测速 =====");

    // 阶段 1：延迟测试
    log::info!("[1/3] 延迟测试...");
    let _ = app.emit(
        EVENT_SPEED_TEST_PROGRESS,
        serde_json::json!({
            "phase": "latency",
            "progress": 0.0,
            "currentSpeed": 0,
            "direction": "download",
        }),
    );

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| {
            log::error!("创建 HTTP 客户端失败: {}", e);
            e.to_string()
        })?;

    // 测试延迟
    let mut latencies = vec![];
    for i in 0..5 {
        let start = Instant::now();
        match client.get(LATENCY_TEST_URL).send().await {
            Ok(resp) => {
                let elapsed = start.elapsed().as_millis() as u64;
                latencies.push(elapsed);
                log::debug!("[延迟 {}/5] {} ms", i + 1, elapsed);
                let _ = resp.bytes().await;
            }
            Err(e) => {
                log::warn!("[延迟 {}/5] 请求失败: {}", i + 1, e);
            }
        }
        let progress = 0.1 * (i + 1) as f64 / 5.0;
        let _ = app.emit(
            EVENT_SPEED_TEST_PROGRESS,
            serde_json::json!({
                "phase": "latency",
                "progress": progress,
                "currentSpeed": 0,
                "direction": "download",
            }),
        );
        sleep(Duration::from_millis(200)).await;
    }

    let latency = if latencies.is_empty() {
        0
    } else {
        latencies.iter().sum::<u64>() / latencies.len() as u64
    };
    log::info!("[1/3] 延迟测试完成: 平均 {} ms", latency);

    let jitter = if latencies.len() > 1 {
        let mean = latency as f64;
        let variance: f64 = latencies
            .iter()
            .map(|&l| {
                let diff = l as f64 - mean;
                diff * diff
            })
            .sum::<f64>()
            / latencies.len() as f64;
        variance.sqrt()
    } else {
        0.0
    };

    // 阶段 2：下载测速
    log::info!("[2/3] 下载测速...");
    let _ = app.emit(
        EVENT_SPEED_TEST_PROGRESS,
        serde_json::json!({
            "phase": "download",
            "progress": 0.2,
            "currentSpeed": 0,
            "direction": "download",
        }),
    );

    let download_start = Instant::now();
    let download_result = client
        .get(SPEED_TEST_DOWNLOAD_URL)
        .send()
        .await
        .map_err(|e| {
            log::error!("下载测速请求失败: {}", e);
            e.to_string()
        })?;

    let download_bytes = download_result
        .bytes()
        .await
        .map_err(|e| {
            log::error!("下载测速读取数据失败: {}", e);
            e.to_string()
        })?;
    let download_elapsed = download_start.elapsed().as_secs_f64();
    let download_speed = if download_elapsed > 0.0 {
        (download_bytes.len() as f64 / download_elapsed * 8.0) as u64
    } else {
        0
    };
    log::info!(
        "[2/3] 下载测速完成: {} 字节 / {:.2}s = {} bps",
        download_bytes.len(),
        download_elapsed,
        download_speed
    );

    let _ = app.emit(
        EVENT_SPEED_TEST_PROGRESS,
        serde_json::json!({
            "phase": "download",
            "progress": 0.6,
            "currentSpeed": download_speed,
            "direction": "download",
        }),
    );

    // 阶段 3：上传测速
    log::info!("[3/3] 上传测速...");
    let _ = app.emit(
        EVENT_SPEED_TEST_PROGRESS,
        serde_json::json!({
            "phase": "upload",
            "progress": 0.7,
            "currentSpeed": 0,
            "direction": "upload",
        }),
    );

    let upload_data = vec![0u8; 1_000_000]; // 1MB
    let upload_start = Instant::now();
    let _upload_result = client
        .post(SPEED_TEST_UPLOAD_URL)
        .body(upload_data)
        .send()
        .await
        .map_err(|e| {
            log::error!("上传测速请求失败: {}", e);
            e.to_string()
        })?;

    let upload_elapsed = upload_start.elapsed().as_secs_f64();
    let upload_speed = if upload_elapsed > 0.0 {
        (1_000_000.0 / upload_elapsed * 8.0) as u64
    } else {
        0
    };
    log::info!(
        "[3/3] 上传测速完成: 1MB / {:.2}s = {} bps",
        upload_elapsed,
        upload_speed
    );

    let _ = app.emit(
        EVENT_SPEED_TEST_PROGRESS,
        serde_json::json!({
            "phase": "upload",
            "progress": 0.95,
            "currentSpeed": upload_speed,
            "direction": "upload",
        }),
    );

    // 完成
    let timestamp = chrono::Utc::now().timestamp_millis() as u64;

    let _ = app.emit(
        EVENT_SPEED_TEST_PROGRESS,
        serde_json::json!({
            "phase": "done",
            "progress": 1.0,
            "currentSpeed": 0,
            "direction": "download",
        }),
    );

    log::info!(
        "===== 测速完成: 下载 {} bps, 上传 {} bps, 延迟 {} ms, 抖动 {:.1} ms =====",
        download_speed,
        upload_speed,
        latency,
        jitter
    );

    Ok(SpeedTestResult {
        download_speed,
        upload_speed,
        latency,
        jitter,
        packet_loss: 0.0,
        timestamp,
    })
}

/// 停止测速
#[tauri::command]
pub fn stop_speed_test() -> Result<(), String> {
    log::info!("收到停止测速命令");
    Ok(())
}

/// 获取进程网络使用情况
#[tauri::command]
pub async fn get_process_network_usage() -> Result<Vec<ProcessNetworkUsage>, String> {
    log::info!("收到获取进程网络使用命令");

    let result = tauri::async_runtime::spawn_blocking(|| {
        use sysinfo::{System, Networks};

        let mut sys = System::new_all();
        sys.refresh_all();
        let networks = Networks::new_with_refreshed_list();
        let _ = &networks;

        let mut result = vec![];
        for (pid, process) in sys.processes() {
            let app_name = process.name().to_string_lossy().to_string();
            if app_name.is_empty() {
                continue;
            }
            result.push(ProcessNetworkUsage {
                pid: pid.as_u32(),
                app_name,
                download_speed: 0,
                upload_speed: 0,
                total_download: 0,
                total_upload: 0,
            });
        }

        log::info!("进程网络使用查询完成: {} 个进程", result.len());
        result
    })
    .await
    .map_err(|e| {
        log::error!("获取进程网络使用线程异常: {}", e);
        format!("获取失败: {}", e)
    })?;

    Ok(result)
}

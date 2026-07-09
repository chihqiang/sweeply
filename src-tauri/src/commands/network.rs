/**
 * 网络测速命令
 * 使用第三方 crate：sysinfo（系统网络信息）、reqwest（HTTP 客户端）、tokio（异步运行时）
 *
 * 测速服务器使用中国友好的地址，并支持多 URL 回退：
 * - 连通性检测：小米 → 百度 → Apple → Cloudflare
 * - 延迟测试：小米 204 → Vivo 204 → 高通 204
 * - 下载测速：腾讯 CDN（Range 请求 10MB）→ Cloudflare
 * - 上传测速：Cloudflare（超时则跳过）
 *
 * 进度方案：
 * - 延迟测试：5 次请求，每次发送进度 (0.00 ~ 0.10)
 * - 下载测速：流式读取 chunk，每个 chunk 发送实时进度和速度 (0.10 ~ 0.55)
 * - 上传测速：流式发送 chunk，每个 chunk 发送实时进度和速度 (0.55 ~ 0.95)
 * - 完成：1.0
 */
use std::sync::LazyLock;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};
use tokio::time::sleep;
use futures_util::stream::{self, StreamExt};

use crate::models::network::*;

static HTTP_CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")
        .timeout(Duration::from_secs(30))
        .build()
        .expect("创建全局 HTTP 客户端失败")
});

fn emit_speed_progress(app: &AppHandle, phase: SpeedTestPhase, progress: f64, current_speed: u64, direction: SpeedDirection) {
    let _ = app.emit(EVENT_SPEED_TEST_PROGRESS, SpeedTestProgressPayload {
        phase,
        progress,
        current_speed,
        direction,
    });
}

/// 事件名称常量
const EVENT_SPEED_TEST_PROGRESS: &str = "speedtest://progress";

// ── 测速 URL 配置（中国友好优先，多 URL 回退）──

/// 连通性检测 URL 列表（中国优先）
const CONNECTIVITY_URLS: &[&str] = &[
    "https://connect.rom.miui.com/generate_204",   // 小米 captive portal
    "https://www.baidu.com",                         // 百度
    "https://www.apple.com/library/test/success.html",
    "https://www.cloudflare.com/cdn-cgi/trace",
];

/// 延迟测试 URL 列表（中国友好的 204 端点）
const LATENCY_TEST_URLS: &[&str] = &[
    "https://connect.rom.miui.com/generate_204",   // 小米
    "https://wifi.vivo.com.cn/generate_204",         // Vivo
    "https://www.qualcomm.cn/generate_204",          // 高通中国
];

/// 下载测速 URL 列表（中国 CDN 优先）
/// 对于大文件 URL，使用 Range 请求限制下载量；Cloudflare 的 URL 自带 bytes 参数
const DOWNLOAD_URLS: &[&str] = &[
    "https://dldir1.qq.com/weixin/Windows/WeChatSetup.exe", // 腾讯 CDN（微信安装包，长期维护）
    "https://speed.cloudflare.com/__down?bytes=10000000",    // Cloudflare
];

/// 上传测速 URL 列表
const UPLOAD_URLS: &[&str] = &[
    "https://speed.cloudflare.com/__up",
];

/// 网络速度采样间隔（毫秒）
const SPEED_SAMPLE_INTERVAL_MS: u64 = 500;

/// 下载测速目标字节数
const DOWNLOAD_TOTAL_BYTES: u64 = 10_000_000;
/// 上传测速总字节数
const UPLOAD_TOTAL_BYTES: u64 = 1_000_000;
/// 上传分块大小
const UPLOAD_CHUNK_SIZE: usize = 100_000;

/// 进度区间
const PHASE_LATENCY_START: f64 = 0.00;
const PHASE_LATENCY_END: f64 = 0.10;
const PHASE_DOWNLOAD_START: f64 = 0.10;
const PHASE_DOWNLOAD_END: f64 = 0.55;
const PHASE_UPLOAD_START: f64 = 0.55;
const PHASE_UPLOAD_END: f64 = 0.95;

/// 获取网络状态
/// 结合 sysinfo 网络接口信息 + 实际 HTTP 连通性检测 + 两次采样计算实时速度
#[tauri::command]
pub async fn get_network_status() -> Result<NetworkStatus, String> {
    log::info!("[network] 收到获取网络状态命令");

    let (interfaces, current_download, current_upload) =
        tauri::async_runtime::spawn_blocking(|| {
            use sysinfo::Networks;

            let mut networks = Networks::new_with_refreshed_list();

            // 第一次采样：收集接口信息 + 保存累计值
            let mut ifaces = Vec::with_capacity(networks.len());
            let mut prev_dl: u64 = 0;
            let mut prev_ul: u64 = 0;
            for (name, data) in &networks {
                let is_active = data.total_packets_received() > 0
                    || data.total_packets_transmitted() > 0;
                prev_dl += data.received();
                prev_ul += data.transmitted();
                ifaces.push(NetworkInterface {
                    name: name.to_string(),
                    ip_address: String::new(),
                    mac_address: String::new(),
                    is_active,
                });
            }

            std::thread::sleep(Duration::from_millis(SPEED_SAMPLE_INTERVAL_MS));
            networks.refresh();

            // 第二次采样：计算差值得到区间速度
            let mut curr_dl: u64 = 0;
            let mut curr_ul: u64 = 0;
            for (_, data) in &networks {
                curr_dl += data.received();
                curr_ul += data.transmitted();
            }

            let interval = SPEED_SAMPLE_INTERVAL_MS;
            let dl_bps = (curr_dl.saturating_sub(prev_dl)) * 8 * 1000 / interval;
            let ul_bps = (curr_ul.saturating_sub(prev_ul)) * 8 * 1000 / interval;

            (ifaces, dl_bps, ul_bps)
        })
        .await
        .map_err(|e| {
            log::error!("[network] 获取网络接口信息线程异常: {}", e);
            format!("获取网络状态失败: {}", e)
        })?;

    // 阶段 2：实际连通性检测（尝试连接已知服务器）
    log::info!("[network] 开始连通性检测...");
    let connectivity_ok = check_connectivity().await;

    let connection_state = if connectivity_ok {
        NetworkConnectionState::Connected
    } else if !interfaces.is_empty() {
        // 有网络接口但无法连接外网，标记为已连接（可能是局域网）
        log::warn!("[network] 外网连通性检测失败，但存在网络接口");
        NetworkConnectionState::Connected
    } else {
        NetworkConnectionState::Disconnected
    };

    log::info!(
        "[network] 网络状态: {:?}, 接口数: {}, 连通性: {}, 下载: {} bps, 上传: {} bps",
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

/// 检测网络连通性：依次尝试中国友好的服务器，任一成功即返回 true
async fn check_connectivity() -> bool {
    for url in CONNECTIVITY_URLS {
        match HTTP_CLIENT.get(*url).timeout(Duration::from_secs(3)).send().await {
            Ok(resp) => {
                log::debug!("[network] 连通性检测成功: {} -> {}", url, resp.status());
                return true;
            }
            Err(e) => {
                log::debug!("[network] 连通性检测失败: {} -> {}", url, e);
            }
        }
    }
    false
}

/// 尝试延迟测试，依次尝试 URL 列表，返回第一个成功的延迟（毫秒）
async fn measure_latency_once() -> Option<u64> {
    for url in LATENCY_TEST_URLS {
        let start = Instant::now();
        match HTTP_CLIENT.get(*url).timeout(Duration::from_secs(5)).send().await {
            Ok(resp) => {
                let elapsed = start.elapsed().as_millis() as u64;
                let _ = resp.bytes().await;
                return Some(elapsed);
            }
            Err(_) => continue,
        }
    }
    None
}

/// 尝试下载测速连接，依次尝试 URL 列表，返回第一个成功的响应流
async fn try_download_connect() -> Result<reqwest::Response, String> {
    for url in DOWNLOAD_URLS {
        log::debug!("[network] 尝试下载测速 URL: {}", url);
        match HTTP_CLIENT
            .get(*url)
            .header("Range", format!("bytes=0-{}", DOWNLOAD_TOTAL_BYTES - 1))
            .timeout(Duration::from_secs(15))
            .send()
            .await
        {
            Ok(resp) if resp.status().is_success() => {
                log::info!("[network] 下载测速连接成功: {} -> {}", url, resp.status());
                return Ok(resp);
            }
            Ok(resp) => {
                log::warn!("[network] 下载测速 URL 返回非成功状态: {} -> {}", url, resp.status());
            }
            Err(e) => {
                log::warn!("[network] 下载测速 URL 连接失败: {} -> {}", url, e);
            }
        }
    }
    Err("所有下载测速服务器均不可达".to_string())
}

/// 尝试上传测速，依次尝试 URL 列表
async fn try_upload(app: &AppHandle) -> Result<u64, String> {
    let upload_start = Instant::now();
    let app_for_stream = app.clone();

    // 用 unfold 创建流式 body，每个 chunk 发送进度
    let upload_stream = stream::unfold(0u64, move |offset| {
        let app = app_for_stream.clone();
        async move {
            if offset >= UPLOAD_TOTAL_BYTES {
                return None;
            }
            let end = (offset + UPLOAD_CHUNK_SIZE as u64).min(UPLOAD_TOTAL_BYTES);
            let chunk = vec![0u8; (end - offset) as usize];

            // 计算当前速度
            let elapsed = upload_start.elapsed().as_secs_f64();
            let current_speed = if elapsed > 0.0 {
                (end as f64 * 8.0 / elapsed) as u64
            } else {
                0
            };

            let fraction = (end as f64 / UPLOAD_TOTAL_BYTES as f64).min(1.0);
            let progress = PHASE_UPLOAD_START
                + (PHASE_UPLOAD_END - PHASE_UPLOAD_START) * fraction;
            emit_speed_progress(
                &app,
                SpeedTestPhase::Upload,
                progress,
                current_speed,
                SpeedDirection::Upload,
            );

            Some((Ok::<_, std::io::Error>(chunk), end))
        }
    });

    for url in UPLOAD_URLS {
        log::debug!("[network] 尝试上传测速 URL: {}", url);

        // 为每次尝试创建新的 stream（stream 消费后不可复用）
        let body = reqwest::Body::wrap_stream(upload_stream);
        // Note: wrap_stream 消费了 upload_stream，后续无法重试
        // 当前只有一个上传 URL，如需多 URL 回退需要重构为每次创建新 stream

        match HTTP_CLIENT
            .post(*url)
            .body(body)
            .header("Content-Type", "application/octet-stream")
            .timeout(Duration::from_secs(20))
            .send()
            .await
        {
            Ok(_) => {
                let elapsed = upload_start.elapsed().as_secs_f64();
                let speed = if elapsed > 0.0 {
                    (UPLOAD_TOTAL_BYTES as f64 / elapsed * 8.0) as u64
                } else {
                    0
                };
                log::info!("[network] 上传测速成功: {} -> {} bps", url, speed);
                return Ok(speed);
            }
            Err(e) => {
                log::warn!("[network] 上传测速 URL 失败: {} -> {}", url, e);
                return Err(format!("上传测速失败: {}", e));
            }
        }
    }

    Err("所有上传测速服务器均不可达".to_string())
}

/// 开始网络测速（异步）
#[tauri::command]
pub async fn start_speed_test(app: AppHandle) -> Result<SpeedTestResult, String> {
    log::info!("[network] ===== 开始网络测速 =====");

    // ── 阶段 1: 延迟测试 (0.00 ~ 0.10) ──
    emit_speed_progress(&app, SpeedTestPhase::Latency, PHASE_LATENCY_START, 0, SpeedDirection::Download);

    let mut latencies = vec![];
    for i in 0..5 {
        match measure_latency_once().await {
            Some(elapsed) => {
                latencies.push(elapsed);
                log::debug!("[network] [延迟 {}/5] {} ms", i + 1, elapsed);
            }
            None => {
                log::warn!("[network] [延迟 {}/5] 所有延迟测试 URL 均失败", i + 1);
            }
        }
        let progress = PHASE_LATENCY_START
            + (PHASE_LATENCY_END - PHASE_LATENCY_START) * (i + 1) as f64 / 5.0;
        emit_speed_progress(&app, SpeedTestPhase::Latency, progress, 0, SpeedDirection::Download);
        sleep(Duration::from_millis(200)).await;
    }

    let latency = if latencies.is_empty() {
        0
    } else {
        latencies.iter().sum::<u64>() / latencies.len() as u64
    };
    log::info!("[network] [1/3] 延迟测试完成: 平均 {} ms (有效 {} 次)", latency, latencies.len());

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

    // ── 阶段 2: 下载测速 (0.10 ~ 0.55) ── 流式读取 chunk，实时发送进度
    emit_speed_progress(&app, SpeedTestPhase::Download, PHASE_DOWNLOAD_START, 0, SpeedDirection::Download);

    let download_response = try_download_connect().await?;
    let download_start = Instant::now();

    let mut received: u64 = 0;
    let mut last_emit: u64 = 0;
    let mut stream = download_response.bytes_stream();

    while let Some(chunk_result) = stream.next().await {
        let chunk = chunk_result.map_err(|e| {
            log::error!("[network] 下载测速读取数据失败: {}", e);
            e.to_string()
        })?;
        received += chunk.len() as u64;

        // 达到目标字节数后停止读取
        if received >= DOWNLOAD_TOTAL_BYTES {
            break;
        }

        // 每收到 200KB 发送一次进度
        if received - last_emit >= 200_000 {
            last_emit = received;
            let elapsed = download_start.elapsed().as_secs_f64();
            let current_speed = if elapsed > 0.0 {
                (received as f64 * 8.0 / elapsed) as u64
            } else {
                0
            };
            let fraction = (received as f64 / DOWNLOAD_TOTAL_BYTES as f64).min(1.0);
            let progress = PHASE_DOWNLOAD_START
                + (PHASE_DOWNLOAD_END - PHASE_DOWNLOAD_START) * fraction;
            emit_speed_progress(
                &app,
                SpeedTestPhase::Download,
                progress,
                current_speed,
                SpeedDirection::Download,
            );
        }
    }

    let download_elapsed = download_start.elapsed().as_secs_f64();
    let download_speed = if download_elapsed > 0.0 {
        (received as f64 / download_elapsed * 8.0) as u64
    } else {
        0
    };
    log::info!(
        "[network] [2/3] 下载测速完成: {} 字节 / {:.2}s = {} bps",
        received,
        download_elapsed,
        download_speed
    );

    emit_speed_progress(&app, SpeedTestPhase::Download, PHASE_DOWNLOAD_END, download_speed, SpeedDirection::Download);

    // ── 阶段 3: 上传测速 (0.55 ~ 0.95) ── 流式发送 chunk，实时发送进度
    emit_speed_progress(&app, SpeedTestPhase::Upload, PHASE_UPLOAD_START, 0, SpeedDirection::Upload);

    let upload_speed = match try_upload(&app).await {
        Ok(speed) => speed,
        Err(e) => {
            log::warn!("[network] 上传测速失败，跳过: {}", e);
            emit_speed_progress(&app, SpeedTestPhase::Upload, PHASE_UPLOAD_END, 0, SpeedDirection::Upload);
            0
        }
    };

    log::info!("[network] [3/3] 上传测速完成: {} bps", upload_speed);

    // ── 完成 ──
    let timestamp = chrono::Utc::now().timestamp_millis() as u64;

    emit_speed_progress(&app, SpeedTestPhase::Done, 1.0, 0, SpeedDirection::Download);

    log::info!(
        "[network] ===== 测速完成: 下载 {} bps, 上传 {} bps, 延迟 {} ms, 抖动 {:.1} ms =====",
        download_speed,
        upload_speed,
        latency,
        jitter
    );

    Ok(SpeedTestResult {
        download_speed: download_speed,
        upload_speed: upload_speed,
        latency,
        jitter,
        packet_loss: 0.0,
        timestamp,
    })
}

/// 停止测速
#[tauri::command]
pub fn stop_speed_test() -> Result<(), String> {
    log::info!("[network] 用户请求停止测速");
    // 当前测速在单个 async 命令中执行，无法中断。
    // 后续可拆分为后台任务 + 取消令牌模式实现真正取消
    Ok(())
}

use serde::Serialize;
use std::process::Command;
use sysinfo::{CpuRefreshKind, Disks, MemoryRefreshKind, RefreshKind, System};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemInfo {
    pub model_name: String,
    pub model_identifier: String,
    pub chip: String,
    pub physical_cores: u32,
    pub logical_cores: u32,
    pub os_version: String,
    pub os_build: String,
    pub kernel_version: String,
    pub host_name: String,
    pub uptime_seconds: u64,
    pub cpu_usage: f32,
    pub total_memory: u64,
    pub used_memory: u64,
    pub volumes: Vec<VolumeInfo>,
    pub battery: Option<BatteryInfo>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeInfo {
    pub mount_point: String,
    pub total_space: u64,
    pub available_space: u64,
    pub file_system: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatteryInfo {
    pub cycle_count: Option<u32>,
    pub condition: String,
    pub charge_percent: u8,
    pub is_charging: bool,
}

fn run_cmd(args: &[&str]) -> String {
    Command::new(args[0])
        .args(&args[1..])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout).ok()
            } else {
                None
            }
        })
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

fn get_model_identifier() -> String {
    run_cmd(&["sysctl", "-n", "hw.model"])
}

fn get_chip_info() -> String {
    let brand = run_cmd(&["sysctl", "-n", "machdep.cpu.brand_string"]);
    if brand.is_empty() {
        let shell = run_cmd(&["sh", "-c", "sysctl -n sysctl.proc_translated 2>/dev/null"]);
        if shell.trim() == "1" {
            "Apple Silicon (Rosetta)".to_string()
        } else {
            "Unknown".to_string()
        }
    } else {
        brand
    }
}

fn get_os_version() -> String {
    let version = run_cmd(&["sw_vers", "-productVersion"]);
    let name = os_version_name(&version);
    if name.is_empty() {
        version
    } else {
        format!("macOS {} {}", name, version)
    }
}

fn get_os_build() -> String {
    run_cmd(&["sw_vers", "-buildVersion"])
}

fn get_kernel_version() -> String {
    run_cmd(&["uname", "-r"])
}

fn get_host_name() -> String {
    run_cmd(&["uname", "-n"])
}

fn os_version_name(version: &str) -> String {
    let parts: Vec<&str> = version.split('.').collect();
    let major = parts.first().unwrap_or(&"");
    match *major {
        "15" => "Sequoia",
        "14" => "Sonoma",
        "13" => "Ventura",
        "12" => "Monterey",
        "11" => "Big Sur",
        "10" => {
            let minor = parts.get(1).unwrap_or(&"");
            match *minor {
                "15" => "Catalina",
                "14" => "Mojave",
                "13" => "High Sierra",
                "12" => "Sierra",
                "11" => "El Capitan",
                _ => "",
            }
        }
        _ => "",
    }
    .to_string()
}

fn get_battery_info() -> Option<BatteryInfo> {
    let output = Command::new("pmset")
        .args(["-g", "batt"])
        .output()
        .ok()?;
    let stdout = String::from_utf8(output.stdout).ok()?;

    let charging = stdout.contains("AC Power") || stdout.contains("charging");
    let lines: Vec<&str> = stdout.lines().collect();
    let batt_line = lines.iter().find(|l| l.contains('%'))?;

    let charge_percent = batt_line
        .split('\t')
        .last()
        .unwrap_or("")
        .split(';')
        .next()
        .unwrap_or("")
        .trim()
        .trim_end_matches('%')
        .parse::<u8>()
        .unwrap_or(0);

    let condition = if stdout.contains("Condition") {
        stdout
            .lines()
            .find(|l| l.contains("Condition"))
            .and_then(|l| l.split(':').nth(1))
            .map(|s| s.trim().to_string())
            .unwrap_or_else(|| "Normal".to_string())
    } else {
        "Normal".to_string()
    };

    let cycle_count = stdout
        .lines()
        .find(|l| l.contains("CycleCount"))
        .and_then(|l| {
            l.split(':')
                .nth(1)
                .and_then(|s| s.trim().parse::<u32>().ok())
        });

    Some(BatteryInfo {
        cycle_count,
        condition,
        charge_percent,
        is_charging: charging,
    })
}

fn get_model_name(identifier: &str) -> String {
    match identifier {
        s if s.starts_with("MacBookPro") => {
            let num = s.trim_start_matches("MacBookPro");
            match num {
                "18,3" | "18,4" => "MacBook Pro (14/16-inch, 2021)".to_string(),
                "18,1" | "18,2" => "MacBook Pro (14/16-inch, 2021)".to_string(),
                "19,1" | "19,2" => "MacBook Pro (14/16-inch, 2023)".to_string(),
                "14,1" => "MacBook Pro (13-inch, M2, 2022)".to_string(),
                "14,3" => "MacBook Pro (14/16-inch, M3, 2023)".to_string(),
                "15,3" => "MacBook Pro (14/16-inch, M4, 2024)".to_string(),
                _ => {
                    let n: u32 = num.split(',').next().unwrap_or("0").parse().unwrap_or(0);
                    if n >= 13 {
                        format!("MacBook Pro (M-Series, {})", identifier)
                    } else {
                        format!("MacBook Pro (Intel, {})", identifier)
                    }
                }
            }
        }
        // MacBook Air
        s if s.starts_with("MacBookAir") => {
            let num = s.trim_start_matches("MacBookAir");
            match num {
                "15,2" => "MacBook Air (M2, 2022)".to_string(),
                "14,2" => "MacBook Air (M2, 2022)".to_string(),
                "15,3" => "MacBook Air (M3, 2024)".to_string(),
                _ => format!("MacBook Air ({})", identifier),
            }
        }
        // MacBook (pre-Air/Pro)
        s if s.starts_with("MacBook") => format!("MacBook ({})", identifier),
        // Mac mini
        s if s.starts_with("Macmini") => {
            if identifier.contains("Mac14") || identifier.contains("Mac15") {
                format!("Mac mini (M-Series, {})", identifier)
            } else {
                format!("Mac mini (Intel, {})", identifier)
            }
        }
        // Mac Studio
        s if s.starts_with("Mac13") && identifier.len() >= 5 => "Mac Studio (M1 Max/Ultra)".to_string(),
        s if s.starts_with("Mac14") && identifier.len() >= 5 => "Mac Studio (M2 Max/Ultra)".to_string(),
        s if s.starts_with("Mac Studio") => format!("Mac Studio ({})", identifier),
        // Mac Pro
        s if s.starts_with("MacPro") => format!("Mac Pro ({})", identifier),
        // iMac
        s if s.starts_with("iMac") => format!("iMac ({})", identifier),
        // Mac (Apple Silicon generic)
        s if s.starts_with("Mac") => format!("Mac ({})", identifier),
        _ => identifier.to_string(),
    }
}

#[tauri::command]
pub fn get_system_info() -> Result<SystemInfo, String> {
    log::info!("[system] 收到获取系统信息命令");
    let start = std::time::Instant::now();
    let model_identifier = get_model_identifier();
    let mut sys = System::new_with_specifics(
        RefreshKind::new()
            .with_cpu(CpuRefreshKind::new().with_cpu_usage())
            .with_memory(MemoryRefreshKind::everything()),
    );
    // CPU 使用率需要两次采样计算差值
    sys.refresh_cpu_usage();
    std::thread::sleep(std::time::Duration::from_millis(200));
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_usage = if sys.global_cpu_usage().is_nan() {
        0.0
    } else {
        sys.global_cpu_usage()
    };
    let total_memory = sys.total_memory();
    let used_memory = sys.used_memory();

    let physical_cores: u32 = run_cmd(&["sysctl", "-n", "hw.physicalcpu"])
        .parse()
        .unwrap_or(0);
    let logical_cores: u32 = run_cmd(&["sysctl", "-n", "hw.logicalcpu"])
        .parse()
        .unwrap_or(0);

    let disks = Disks::new_with_refreshed_list();
    let volumes: Vec<VolumeInfo> = disks
        .list()
        .iter()
        .filter(|d| {
            let mp = d.mount_point().to_string_lossy();
            // 跳过系统内部挂载点，只保留用户可见的卷
            !(mp == "/System/Volumes/Preboot"
                || mp == "/System/Volumes/Update"
                || mp == "/System/Volumes/iSCPreboot"
                || mp == "/System/Volumes/xarts"
                || mp == "/System/Volumes/Hardware"
                || mp.starts_with("/Library")
                || mp.starts_with("/usr")
                || mp.starts_with("/dev")
                || mp.starts_with("/private/var/vm")
                || mp.starts_with("/private/tmp")
                || mp.starts_with("/private/var/run"))
        })
        .map(|d| VolumeInfo {
            mount_point: d.mount_point().to_string_lossy().to_string(),
            total_space: d.total_space(),
            available_space: d.available_space(),
            file_system: d.file_system().to_string_lossy().to_string(),
        })
        .collect();

    let battery = get_battery_info();

    let model_name = get_model_name(&model_identifier);

    log::info!(
        "[system] 系统信息获取完成: {} / {} / CPU {:.1}% / 内存 {:.2} GB / {:.2}s",
        model_name,
        get_os_version(),
        cpu_usage,
        total_memory as f64 / 1_073_741_824.0,
        start.elapsed().as_secs_f64()
    );

    Ok(SystemInfo {
        model_name,
        model_identifier,
        chip: get_chip_info(),
        physical_cores,
        logical_cores,
        os_version: get_os_version(),
        os_build: get_os_build(),
        kernel_version: get_kernel_version(),
        host_name: get_host_name(),
        uptime_seconds: System::uptime(),
        cpu_usage,
        total_memory,
        used_memory,
        volumes,
        battery,
    })
}

#[tauri::command]
pub fn flush_dns() -> Result<String, String> {
    log::info!("[system] 收到刷新 DNS 缓存命令");
    let out1 = Command::new("dscacheutil")
        .args(["-flushcache"])
        .output()
        .map_err(|e| {
            log::error!("[system] 执行 dscacheutil 失败: {}", e);
            format!("执行命令失败: {}", e)
        })?;

    Command::new("killall")
        .args(["-HUP", "mDNSResponder"])
        .output()
        .ok();

    if out1.status.success() {
        log::info!("[system] DNS 缓存刷新成功");
        Ok("DNS 缓存已清除".to_string())
    } else {
        let msg = String::from_utf8_lossy(&out1.stderr).to_string();
        log::error!("[system] DNS 刷新失败: {}", msg);
        Err(format!("DNS 刷新失败: {}", msg))
    }
}

// ────────────────────────────────────────────────────────────────────────────
//  权限检查
// ────────────────────────────────────────────────────────────────────────────

/// 权限检查结果
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionStatus {
    /// 是否拥有完全磁盘访问权限
    pub has_full_disk_access: bool,
    /// 是否可以访问用户桌面目录
    pub can_access_desktop: bool,
    /// 是否可以访问用户下载目录
    pub can_access_downloads: bool,
    /// 是否可以访问用户文档目录
    pub can_access_documents: bool,
    /// 是否可以访问 /Library 目录（需要完全磁盘访问权限）
    pub can_access_library: bool,
    /// 缺失的权限列表（用于前端展示提示）
    pub missing_permissions: Vec<String>,
}

/// 检查应用是否拥有必要的系统权限
///
/// macOS 上，某些清理操作需要"完全磁盘访问权限"才能访问
/// ~/Library/Caches、~/Library/Application Support 绻目录。
/// 此命令通过尝试读取关键目录来判断权限状态。
#[tauri::command]
pub fn check_permissions() -> Result<PermissionStatus, String> {
    log::info!("[system] 检查系统权限...");

    let home = dirs::home_dir().unwrap_or_else(|| std::path::PathBuf::from("/tmp"));

    // 检查用户目录访问权限（通常不需要特殊权限）
    let desktop_path = home.join("Desktop");
    let downloads_path = home.join("Downloads");
    let documents_path = home.join("Documents");

    let can_access_desktop = can_read_dir(&desktop_path);
    let can_access_downloads = can_read_dir(&downloads_path);
    let can_access_documents = can_read_dir(&documents_path);

    // 检查 ~/Library 访问权限（需要完全磁盘访问权限）
    let library_path = home.join("Library");
    let can_access_library = can_read_dir(&library_path);

    // 完全磁盘访问权限：能读取 ~/Library 通常意味着已授权
    // 更精确的检查：尝试读取 ~/Library/Caches（TCC 保护目录）
    let caches_path = home.join("Library/Caches");
    let can_access_caches = can_read_dir(&caches_path);
    let has_full_disk_access = can_access_library && can_access_caches;

    let mut missing: Vec<String> = Vec::new();
    if !has_full_disk_access {
        missing.push("完全磁盘访问权限".to_string());
    }
    if !can_access_desktop {
        missing.push("桌面目录访问".to_string());
    }
    if !can_access_downloads {
        missing.push("下载目录访问".to_string());
    }
    if !can_access_documents {
        missing.push("文档目录访问".to_string());
    }

    log::info!(
        "[system] 权限检查完成: 完全磁盘访问={}, 缺失={:?}",
        has_full_disk_access,
        missing
    );

    Ok(PermissionStatus {
        has_full_disk_access,
        can_access_desktop,
        can_access_downloads,
        can_access_documents,
        can_access_library,
        missing_permissions: missing,
    })
}

/// 尝试读取目录，判断是否有访问权限
fn can_read_dir(path: &std::path::Path) -> bool {
    std::fs::read_dir(path).is_ok()
}

/// 打开 macOS 系统设置 — 隐私与安全性 > 完全磁盘访问权限
#[tauri::command]
pub fn open_system_settings() -> Result<(), String> {
    log::info!("[system] 打开系统设置：完全磁盘访问权限");
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
        .output()
        .map_err(|e| {
            log::error!("[system] 打开系统设置失败: {}", e);
            format!("打开系统设置失败: {}", e)
        })?;
    Ok(())
}

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Command;

use super::uninstall::extract_app_icon;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginItem {
    pub name: String,
    pub path: String,
    pub hidden: bool,
    pub icon_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackgroundItem {
    pub label: String,
    pub pid: Option<u32>,
    pub status: String,
    pub icon_path: String,
}

fn run_osascript(script: &str) -> Result<String, String> {
    log::debug!("[login_items] 执行 osascript: {}", script.split('\n').next().unwrap_or(""));
    Command::new("osascript")
        .args(["-e", script])
        .output()
        .map_err(|e| {
            log::error!("[login_items] 执行 osascript 失败: {}", e);
            format!("执行 osascript 失败: {}", e)
        })
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout)
                    .map(|s| s.trim().to_string())
                    .map_err(|_| "无法解析输出".to_string())
            } else {
                let msg = String::from_utf8_lossy(&o.stderr).to_string();
                log::error!("[login_items] osascript 返回错误: {}", msg);
                Err(if msg.is_empty() {
                    "未知错误".to_string()
                } else {
                    msg
                })
            }
        })
}

#[tauri::command]
pub fn list_login_items() -> Result<Vec<LoginItem>, String> {
    log::info!("[login_items] 收到列出登录项命令");
    let script = r#"tell application "System Events"
        set output to ""
        repeat with loginItem in every login item
            set output to output & name of loginItem & "|" & path of loginItem & "|" & (hidden of loginItem as string) & "\n"
        end repeat
        return output
    end tell"#;

    let output = run_osascript(script)?;
    if output.is_empty() {
        return Ok(vec![]);
    }

    let items: Vec<LoginItem> = output
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(3, '|').collect();
            if parts.len() < 3 {
                return None;
            }
            let app_path = PathBuf::from(parts[1]);
            let icon_path = extract_app_icon(&app_path);
            Some(LoginItem {
                name: parts[0].to_string(),
                path: parts[1].to_string(),
                hidden: parts[2] == "true",
                icon_path,
            })
        })
        .collect();

    log::info!("[login_items] 列出登录项完成: {} 个", items.len());
    Ok(items)
}

#[tauri::command]
pub fn add_login_item(path: String) -> Result<(), String> {
    log::info!("[login_items] 添加登录项: {}", path);
    let escaped_path = path.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        r#"tell application "System Events" to make login item at end with properties {{path:"{}", hidden:false}}"#,
        escaped_path
    );
    run_osascript(&script)?;
    log::info!("[login_items] 添加登录项成功");
    Ok(())
}

#[tauri::command]
pub fn remove_login_item(name: String) -> Result<(), String> {
    log::info!("[login_items] 移除登录项: {}", name);
    let escaped_name = name.replace('\\', "\\\\").replace('"', "\\\"");
    let script = format!(
        r#"tell application "System Events" to delete login item "{}""#,
        escaped_name
    );
    run_osascript(&script)?;
    log::info!("[login_items] 移除登录项成功");
    Ok(())
}

fn get_home_dir() -> String {
    Command::new("sh")
        .args(["-c", "echo $HOME"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

/// 批量扫描 /Applications + ~/Applications，构建 小写名→路径 映射
fn build_app_name_map() -> HashMap<String, PathBuf> {
    let home = get_home_dir();
    let cmd = format!(
        "find /Applications {}/Applications -maxdepth 3 -name '*.app' 2>/dev/null",
        home
    );
    let output = Command::new("sh")
        .args(["-c", &cmd])
        .output()
        .ok();
    let mut map = HashMap::new();
    if let Some(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            let p = PathBuf::from(line.trim());
            if let Some(name) = p.file_stem().and_then(|n| n.to_str()) {
                map.insert(name.to_lowercase(), p);
            }
        }
    }
    map
}

fn extract_icon_for_label(label: &str, bundle_id: Option<&str>, app_map: &HashMap<String, PathBuf>) -> String {
    // 从 bundle ID 查找（mdfind 可能慢，先走 app 映射）
    let keyword = label.split('.').last().unwrap_or(label).to_lowercase();

    // 精确匹配
    if let Some(app_path) = app_map.get(&keyword) {
        let icon = extract_app_icon(app_path);
        if !icon.is_empty() {
            return icon;
        }
    }

    // 模糊匹配：包含关键字
    for (name, app_path) in app_map {
        if name.contains(&keyword) {
            let icon = extract_app_icon(app_path);
            if !icon.is_empty() {
                return icon;
            }
        }
    }

    // 如果有 bundle_id 且以上匹配不到，尝试 mdfind
    if let Some(bid) = bundle_id {
        let query = format!("kMDItemCFBundleIdentifier == '{}'", bid);
        if let Ok(output) = Command::new("mdfind")
            .args(["-interpret", &query])
            .output()
        {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                if let Some(line) = stdout.lines().next().filter(|l| !l.is_empty()) {
                    let p = PathBuf::from(line.trim());
                    if p.exists() {
                        let icon = extract_app_icon(&p);
                        if !icon.is_empty() {
                            return icon;
                        }
                    }
                }
            }
        }
    }

    String::new()
}

#[tauri::command]
pub fn list_background_items() -> Result<Vec<BackgroundItem>, String> {
    log::info!("[login_items] 收到列出后台项命令");
    let home = get_home_dir();

    // 先构建 app 名称→路径映射（只执行一次）
    let app_map = build_app_name_map();

    // 尝试用 sqlite3 读取 backgroundtaskmanagement 数据库
    let db_path = format!(
        "{}/Library/Application Support/com.apple.backgroundtaskmanagement/backgrounditems.btm",
        home
    );

    let db_exists = std::path::Path::new(&db_path).exists();
    if db_exists {
        let sqlite_output = Command::new("sqlite3")
            .args([
                "-separator",
                "|",
                &db_path,
                "SELECT ZTEAMID, ZBUNDLEID, ZDISPLAYNAME FROM ZBACKGROUNDITEM;",
            ])
            .output()
            .ok();

        if let Some(output) = sqlite_output {
            if output.status.success() {
                let stdout = String::from_utf8_lossy(&output.stdout);
                let items: Vec<BackgroundItem> = stdout
                    .lines()
                    .filter(|l| !l.is_empty())
                    .filter_map(|line| {
                        let parts: Vec<&str> = line.splitn(3, '|').collect();
                        let bundle_id = parts.get(1).filter(|s| !s.is_empty());
                        let label = parts.get(2).or(parts.get(1)).unwrap_or(&"unknown").to_string();
                        if label.is_empty() || label == "unknown" {
                            return None;
                        }
                        let icon_path = extract_icon_for_label(&label, bundle_id.copied(), &app_map);
                        Some(BackgroundItem {
                            label,
                            pid: None,
                            status: "允许在后台".to_string(),
                            icon_path,
                        })
                    })
                    .collect();
                if !items.is_empty() {
                    log::info!("[login_items] 从 sqlite3 获取到 {} 个后台项", items.len());
                    return Ok(items);
                }
            }
        }
    }

    // 回退：用 launchctl list 列出用户级非 Apple 服务
    let launchctl_output = Command::new("sh")
        .args(["-c", "launchctl list 2>/dev/null | awk 'NR>1 && $3 !~ /^com\\.apple\\./ && $3 !~ /^application\\.com\\.apple\\./ && $3 != \"\" {print $1, $2, $3}'"])
        .output()
        .map_err(|e| format!("执行 launchctl 失败: {}", e))?;

    let stdout = String::from_utf8_lossy(&launchctl_output.stdout);
    let items: Vec<BackgroundItem> = stdout
        .lines()
        .filter(|l| !l.is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(3, ' ').collect();
            if parts.len() < 3 {
                return None;
            }
            let pid_str = parts.get(1).unwrap_or(&"-").trim();
            let pid = if pid_str == "-" {
                None
            } else {
                pid_str.parse::<u32>().ok()
            };
            let label = parts[2].to_string();
            let status = if pid.is_some() { "运行中" } else { "未运行" };
            let icon_path = extract_icon_for_label(&label, None, &app_map);
            Some(BackgroundItem {
                label,
                pid,
                status: status.to_string(),
                icon_path,
            })
        })
        .collect();

    log::info!("[login_items] 从 launchctl 获取到 {} 个后台项", items.len());
    Ok(items)
}

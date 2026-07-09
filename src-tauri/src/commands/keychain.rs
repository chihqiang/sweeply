use std::process::Command;

use crate::models::keychain::{KeychainFile, KeychainItem, KeychainListResult};

fn run_security(args: &[&str]) -> Result<String, String> {
    log::debug!("[keychain] 执行 security 命令: security {}", args.join(" "));
    let output = Command::new("security")
        .args(args)
        .output()
        .map_err(|e| {
            log::error!("[keychain] 执行 security 命令失败: {}", e);
            format!("执行 security 命令失败: {}", e)
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        if stderr.contains("error:") || stderr.contains("SecKeychainSearch") {
            log::warn!("[keychain] security 命令返回错误: {}", stderr.trim());
            return Err(stderr.trim().to_string());
        }
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn parse_item_block(block: &str) -> Option<KeychainItem> {
    let mut title = String::new();
    let mut account = String::new();
    let mut server_or_service = String::new();
    let mut kind = String::new();
    let mut modified = String::new();
    let mut raw_data = String::new();

    for line in block.lines() {
        raw_data.push_str(line);
        raw_data.push('\n');

        if let Some(val) = line.strip_prefix("keychain: ") {
            _ = val;
            continue;
        }

        if let Some(class_val) = line.strip_prefix("class: ") {
            kind = class_val.trim_matches('"').to_string();
            continue;
        }

        if let Some(attr_str) = line.strip_prefix("\"") {
            let parts: Vec<&str> = attr_str.splitn(2, '"').collect();
            if parts.len() < 2 {
                continue;
            }
            let key = parts[0];
            let rest = parts[1];
            let eq_idx = rest.find('=');
            let val_str = eq_idx.map(|i| rest[i + 1..].trim()).unwrap_or("");
            let value = if val_str.starts_with('"') && val_str.ends_with('"') && val_str.len() > 1 {
                val_str[1..val_str.len() - 1].to_string()
            } else if val_str == "<NULL>" {
                continue;
            } else {
                val_str.to_string()
            };

            match key {
                "acct" => account = value,
                "svce" | "srvr" => server_or_service = value,
                "desc" if title.is_empty() => title = value,
                "mdat" | "cdat" => modified = value,
                "labl" => title = value,
                _ => {}
            }
        }
    }

    if title.is_empty() {
        if !account.is_empty() {
            title = account.clone();
        } else if !server_or_service.is_empty() {
            title = server_or_service.clone();
        }
    }

    let id = format!("{}-{}", kind, title);

    let kind_display = match kind.as_str() {
        "genp" => "密码",
        "inet" => "网络密码",
        "cert" => "证书",
        "keys" => "密钥",
        _ => &kind,
    };

    Some(KeychainItem {
        id,
        title,
        kind: kind_display.to_string(),
        account,
        server_or_service,
        modified_date: modified,
        raw_data,
    })
}

fn parse_items(output: &str) -> Vec<KeychainItem> {
    let mut items = Vec::new();
    let mut current_block = String::new();

    for line in output.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            if !current_block.is_empty() {
                if let Some(item) = parse_item_block(&current_block) {
                    items.push(item);
                }
                current_block.clear();
            }
            continue;
        }
        current_block.push_str(line);
        current_block.push('\n');
    }

    if !current_block.is_empty() {
        if let Some(item) = parse_item_block(&current_block) {
            items.push(item);
        }
    }

    items
}

#[tauri::command]
pub fn open_keychain_access() -> Result<(), String> {
    log::info!("[keychain] 打开钥匙串访问应用");
    Command::new("open")
        .args(["-a", "Keychain Access"])
        .output()
        .map_err(|e| {
            log::error!("[keychain] 打开钥匙串访问失败: {}", e);
            format!("打开钥匙串访问失败: {}", e)
        })?;
    Ok(())
}

#[tauri::command]
pub fn list_keychains() -> Result<Vec<KeychainFile>, String> {
    log::info!("[keychain] 收到列出钥匙串命令");
    let output = run_security(&["list-keychains"])?;

    let keychains: Vec<KeychainFile> = output
        .lines()
        .filter_map(|line| {
            let path = line.trim().trim_matches('"').to_string();
            if path.is_empty() {
                return None;
            }
            let name = std::path::Path::new(&path)
                .file_stem()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());

            let is_login = name.contains("login");
            let is_system = name.contains("System") || name.contains("system");

            let status = if is_login { "unlocked" } else { "unknown" };

            Some(KeychainFile {
                path,
                name,
                is_login,
                is_system,
                status: status.to_string(),
            })
        })
        .collect();

    log::info!("[keychain] 列出钥匙串完成: {} 个", keychains.len());
    Ok(keychains)
}

#[tauri::command]
pub fn list_keychain_items() -> Result<KeychainListResult, String> {
    log::info!("[keychain] 收到列出钥匙串条目命令");
    let keychains = list_keychains()?;

    let mut all_items: Vec<KeychainItem> = Vec::new();

    if let Ok(output) = run_security(&["find-generic-password"]) {
        let items = parse_items(&output);
        log::debug!("[keychain] 通用密码条目: {} 个", items.len());
        all_items.extend(items);
    }

    if let Ok(output) = run_security(&["find-internet-password"]) {
        let items = parse_items(&output);
        log::debug!("[keychain] 网络密码条目: {} 个", items.len());
        all_items.extend(items);
    }

    let total_items = all_items.len() as u64;
    log::info!("[keychain] 列出条目完成: {} 个条目", total_items);

    Ok(KeychainListResult {
        keychains,
        total_items,
    })
}

#[tauri::command]
pub fn search_keychain_items(query: String) -> Result<Vec<KeychainItem>, String> {
    log::info!("[keychain] 收到搜索钥匙串条目命令: query=\"{}\"", query);
    let mut results: Vec<KeychainItem> = Vec::new();

    let q = query.to_lowercase();

    if let Ok(output) = run_security(&["find-generic-password"]) {
        let items = parse_items(&output);
        results.extend(items.into_iter().filter(|item| {
            item.title.to_lowercase().contains(&q)
                || item.account.to_lowercase().contains(&q)
                || item.server_or_service.to_lowercase().contains(&q)
        }));
    }

    if let Ok(output) = run_security(&["find-internet-password"]) {
        let items = parse_items(&output);
        results.extend(items.into_iter().filter(|item| {
            item.title.to_lowercase().contains(&q)
                || item.account.to_lowercase().contains(&q)
                || item.server_or_service.to_lowercase().contains(&q)
        }));
    }

    log::info!("[keychain] 搜索完成: 匹配 {} 个条目", results.len());
    Ok(results)
}

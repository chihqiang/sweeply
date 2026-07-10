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

fn extract_quoted_value(s: &str) -> Option<String> {
    let eq_pos = s.find('=')?;
    let after_eq = s[eq_pos + 1..].trim();
    if after_eq.starts_with('"') {
        let remaining = &after_eq[1..];
        // use rfind to handle octal escapes like \000 inside quoted strings
        if let Some(end) = remaining.rfind('"') {
            return Some(remaining[..end].to_string());
        }
    }
    if after_eq.starts_with("0x") {
        let rest = after_eq.trim_start_matches(|c: char| c.is_alphanumeric() || c == 'x');
        let rest = rest.trim();
        if rest.starts_with('"') {
            let remaining = &rest[1..];
            if let Some(end) = remaining.rfind('"') {
                return Some(remaining[..end].to_string());
            }
        }
    }
    None
}

fn parse_item_block(block: &str) -> Option<KeychainItem> {
    let mut title = String::new();
    let mut account = String::new();
    let mut server_or_service = String::new();
    let mut kind = String::new();
    let mut modified = String::new();
    let mut raw_data = String::new();
    let mut hex_label: Option<String> = None;
    let mut hex_key_name: Option<String> = None;

    for line in block.lines() {
        raw_data.push_str(line);
        raw_data.push('\n');
        let trimmed = line.trim();

        if let Some(class_val) = trimmed.strip_prefix("class: ") {
            kind = match class_val.trim_matches('"') {
                "0x0000000F" => "genp".to_string(),
                "0x00000010" => "inet".to_string(),
                s if s.starts_with("0x") => s.to_string(),
                s => s.to_string(),
            };
            continue;
        }

        // human-readable attributes: "acct"<blob>="value"
        if trimmed.starts_with('"') {
            if let Some(attr_str) = trimmed.strip_prefix('"') {
                let parts: Vec<&str> = attr_str.splitn(2, '"').collect();
                if parts.len() >= 2 {
                    let key = parts[0];
                    let rest = parts[1];
                    if let Some(value) = extract_quoted_value(rest) {
                        match key {
                            "acct" => account = value,
                            "svce" | "srvr" => server_or_service = value,
                            "labl" => title = value,
                            "desc" if title.is_empty() && account.is_empty() => title = value,
                            _ => {}
                        }
                    }
                    if key == "mdat" || key == "cdat" {
                        if let Some(ts) = extract_quoted_value(rest) {
                            modified = ts;
                        }
                    }
                }
            }
            continue;
        }

        // hex attributes: 0x00000007 <blob>="value"
        if trimmed.starts_with("0x") && trimmed.contains('=') {
            let hex_tag_str = trimmed.split(' ').next().unwrap_or("");
            if let Some(value) = extract_quoted_value(trimmed) {
                if let Ok(tag) = u32::from_str_radix(hex_tag_str.trim_start_matches("0x"), 16) {
                    match tag {
                        7 => { hex_label = Some(value); }
                        1 => { hex_key_name = Some(value); }
                        _ => {}
                    }
                }
            }
        }
    }

    // title priority: human-readable label/svce > hex label (tag 7) > hex key name (tag 1) > human-readable svce > account
    if title.is_empty() {
        if let Some(ref label) = hex_label {
            title = label.clone();
        }
    }
    if title.is_empty() {
        if let Some(ref key_name) = hex_key_name {
            if !key_name.starts_with('<') {
                title = key_name.clone();
            }
        }
    }
    if title.is_empty() && !server_or_service.is_empty() {
        title = server_or_service.clone();
    }
    if title.is_empty() && !account.is_empty() {
        title = account.clone();
    }

    let id = format!("{}-{}", kind, title);

    let raw_kind = kind.clone();
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
        raw_kind,
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
        if line.starts_with("keychain: ") && !current_block.is_empty() {
            if let Some(item) = parse_item_block(&current_block) {
                items.push(item);
            }
            current_block.clear();
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

fn search_all_items() -> Vec<KeychainItem> {
    let keychains = match list_keychains() {
        Ok(kc) => kc,
        Err(_) => return Vec::new(),
    };

    let mut all_items: Vec<KeychainItem> = Vec::new();

    for kc in &keychains {
        if let Ok(output) = run_security(&["dump-keychain", &kc.path]) {
            let items = parse_items(&output);
            all_items.extend(items);
        }
    }

    all_items.into_iter().filter(|item| {
        !item.title.is_empty() && !item.title.starts_with('<')
    }).collect()
}

#[tauri::command]
pub fn list_keychain_items() -> Result<KeychainListResult, String> {
    log::info!("[keychain] 收到列出钥匙串条目命令");
    let keychains = list_keychains()?;

    let all_items = search_all_items();

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

    let all_items = search_all_items();
    let q = query.to_lowercase();

    let results: Vec<KeychainItem> = if q.is_empty() {
        all_items
    } else {
        all_items.into_iter().filter(|item| {
            item.title.to_lowercase().contains(&q)
                || item.account.to_lowercase().contains(&q)
                || item.server_or_service.to_lowercase().contains(&q)
        }).collect()
    };

    log::info!("[keychain] 搜索完成: 匹配 {} 个条目", results.len());
    Ok(results)
}

#[tauri::command]
pub fn get_keychain_password(raw_kind: String, service: String, account: String) -> Result<String, String> {
    log::info!("[keychain] 获取密码: kind={} service={} account={}", raw_kind, service, account);

    let mut args: Vec<String> = match raw_kind.as_str() {
        "genp" => vec!["find-generic-password".into(), "-w".into()],
        "inet" => vec!["find-internet-password".into(), "-w".into()],
        _ => return Err(format!("不支持的钥匙串条目类型: {}", raw_kind)),
    };
    match raw_kind.as_str() {
        "genp" => { if !service.is_empty() { args.push("-l".into()); args.push(service.clone()); } }
        "inet" => { if !service.is_empty() { args.push("-s".into()); args.push(service.clone()); } }
        _ => {}
    }
    if !account.is_empty() { args.push("-a".into()); args.push(account.clone()); }

    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let password = run_security(&refs)?;
    let password = password.trim().to_string();
    if password.is_empty() {
        return Err("无法获取密码".to_string());
    }

    log::info!("[keychain] 获取密码成功: {} 字符", password.len());
    Ok(password)
}

#[tauri::command]
pub fn delete_keychain_item(raw_kind: String, service: String, account: String) -> Result<(), String> {
    log::info!("[keychain] 删除条目: kind={} service={} account={}", raw_kind, service, account);

    let mut args: Vec<String> = match raw_kind.as_str() {
        "genp" => vec!["delete-generic-password".into()],
        "inet" => vec!["delete-internet-password".into()],
        _ => return Err(format!("不支持的钥匙串条目类型: {}", raw_kind)),
    };
    match raw_kind.as_str() {
        "genp" => { if !service.is_empty() { args.push("-l".into()); args.push(service.clone()); } }
        "inet" => { if !service.is_empty() { args.push("-s".into()); args.push(service.clone()); } }
        _ => {}
    }
    if !account.is_empty() { args.push("-a".into()); args.push(account.clone()); }

    let refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    run_security(&refs)?;

    log::info!("[keychain] 删除条目成功");
    Ok(())
}


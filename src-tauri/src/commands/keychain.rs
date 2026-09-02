use std::path::Path;
use std::process::Command;

use security_framework::item::{CloudSync, ItemClass, ItemSearchOptions, Limit, SearchResult};
use security_framework::os::macos::keychain::{SecKeychain, SecPreferencesDomain};
use security_framework::os::macos::passwords::{
    find_internet_password, SecAuthenticationType, SecProtocolType,
};

use crate::models::keychain::{KeychainFile, KeychainItem, KeychainListResult};

fn err_msg(msg: &str, e: impl std::fmt::Display) -> String {
    format!("{}: {}", msg, e)
}

/// 按钥匙串域构造展示条目（不再依赖 `security list-keychains` 命令）
fn domain_keychain(domain: SecPreferencesDomain, path: &str, is_login: bool, is_system: bool) -> Option<KeychainFile> {
    SecKeychain::default_for_domain(domain).ok()?;
    let path_str = path.to_string();
    let name = Path::new(&path_str)
        .file_stem()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path_str.clone());
    Some(KeychainFile {
        path: path_str,
        name,
        is_login,
        is_system,
        status: if is_login { "unlocked".to_string() } else { "unknown".to_string() },
    })
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
    let mut keychains = Vec::new();
    if let Some(home) = dirs::home_dir() {
        let login_path = home.join("Library/Keychains/login.keychain-db");
        if let Some(kc) = domain_keychain(
            SecPreferencesDomain::User,
            login_path.to_string_lossy().as_ref(),
            true,
            false,
        ) {
            keychains.push(kc);
        }
    }
    if let Some(kc) = domain_keychain(
        SecPreferencesDomain::System,
        "/Library/Keychains/System.keychain",
        false,
        true,
    ) {
        keychains.push(kc);
    }

    log::info!("[keychain] 列出钥匙串完成: {} 个", keychains.len());
    Ok(keychains)
}

/// 基于 Security.framework 枚举指定类别的钥匙串条目（替代 `security dump-keychain`）
fn search_class(class: ItemClass) -> Vec<SearchResult> {
    let mut opts = ItemSearchOptions::new();
    opts.class(class)
        .limit(Limit::All)
        .load_attributes(true)
        .cloud_sync(CloudSync::MatchSyncAny);
    opts.search().unwrap_or_default()
}

/// 将单个条目的属性字典转换为统一展示结构
fn attrs_to_item(result: &SearchResult, raw_kind: &str, kind_display: &str) -> Option<KeychainItem> {
    let map = result.simplify_dict()?;

    let account = map.get("acct").cloned().unwrap_or_default();
    let server_or_service = map
        .get("svce")
        .or_else(|| map.get("srvr"))
        .cloned()
        .unwrap_or_default();
    let label = map.get("labl").cloned().unwrap_or_default();
    let modified = map
        .get("mdat")
        .or_else(|| map.get("cdat"))
        .cloned()
        .unwrap_or_default();

    let mut title = label;
    if title.is_empty() {
        title = server_or_service.clone();
    }
    if title.is_empty() {
        title = account.clone();
    }
    if title.is_empty() || title.starts_with('<') {
        return None;
    }

    let id = format!("{}-{}", raw_kind, title);
    let mut raw_data = format!("class: {} ({})\n", raw_kind, kind_display);
    for key in ["svce", "srvr", "acct", "labl", "mdat"] {
        if let Some(value) = map.get(key) {
            raw_data.push_str(&format!("\"{}\"=\"{}\"\n", key, value));
        }
    }

    Some(KeychainItem {
        id,
        title,
        kind: kind_display.to_string(),
        raw_kind: raw_kind.to_string(),
        account,
        server_or_service,
        modified_date: modified,
        raw_data,
    })
}

fn search_all_items() -> Vec<KeychainItem> {
    #[rustfmt::skip]
    let classes = [
        (ItemClass::generic_password(), "genp", "密码"),
        (ItemClass::internet_password(), "inet", "网络密码"),
        (ItemClass::certificate(), "cert", "证书"),
        (ItemClass::key(), "keys", "密钥"),
    ];

    let mut all_items = Vec::new();
    for (class, raw_kind, kind_display) in classes {
        for result in search_class(class) {
            if let Some(item) = attrs_to_item(&result, raw_kind, kind_display) {
                all_items.push(item);
            }
        }
    }
    all_items
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
        all_items
            .into_iter()
            .filter(|item| {
                item.title.to_lowercase().contains(&q)
                    || item.account.to_lowercase().contains(&q)
                    || item.server_or_service.to_lowercase().contains(&q)
            })
            .collect()
    };

    log::info!("[keychain] 搜索完成: 匹配 {} 个条目", results.len());
    Ok(results)
}

#[tauri::command]
pub fn get_keychain_password(
    raw_kind: String,
    service: String,
    account: String,
) -> Result<String, String> {
    log::info!(
        "[keychain] 获取密码: kind={} service={} account={}",
        raw_kind,
        service,
        account
    );

    let password_bytes: Vec<u8> = match raw_kind.as_str() {
        "genp" => {
            let mut opts = ItemSearchOptions::new();
            opts.class(ItemClass::generic_password())
                .service(&service)
                .account(&account)
                .limit(1)
                .load_data(true)
                .cloud_sync(CloudSync::MatchSyncAny);
            let results = opts.search().map_err(|e| err_msg("搜索钥匙串条目失败", e))?;
            let mut found = None;
            for result in results {
                if let SearchResult::Data(bytes) = result {
                    found = Some(bytes);
                    break;
                }
            }
            found.ok_or_else(|| "无法获取密码或密码为空".to_string())?
        }
        "inet" => {
            let (pw, _item) = find_internet_password(
                None,
                &service,
                None,
                &account,
                "",
                None,
                SecProtocolType::Any,
                SecAuthenticationType::Any,
            )
            .map_err(|e| err_msg("获取网络密码失败", e))?;
            pw.as_ref().to_vec()
        }
        _ => return Err(format!("不支持的钥匙串条目类型: {}", raw_kind)),
    };

    let password = String::from_utf8_lossy(&password_bytes).to_string();
    if password.is_empty() {
        return Err("无法获取密码或密码为空".to_string());
    }

    log::info!("[keychain] 获取密码成功: {} 字符", password.len());
    Ok(password)
}

#[tauri::command]
pub fn delete_keychain_item(
    raw_kind: String,
    service: String,
    account: String,
) -> Result<(), String> {
    log::info!(
        "[keychain] 删除条目: kind={} service={} account={}",
        raw_kind,
        service,
        account
    );

    match raw_kind.as_str() {
        "genp" => {
            let mut opts = ItemSearchOptions::new();
            opts.class(ItemClass::generic_password())
                .service(&service)
                .account(&account);
            opts.delete().map_err(|e| err_msg("删除条目失败", e))?;
        }
        "inet" => {
            let (_pw, item) = find_internet_password(
                None,
                &service,
                None,
                &account,
                "",
                None,
                SecProtocolType::Any,
                SecAuthenticationType::Any,
            )
            .map_err(|e| err_msg("查找网络密码条目失败", e))?;
            item.delete();
        }
        _ => return Err(format!("不支持的钥匙串条目类型: {}", raw_kind)),
    }

    log::info!("[keychain] 删除条目成功");
    Ok(())
}
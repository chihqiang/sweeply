//! 应用缓存分类
//!
//! 包含扫描目标：
//!   - 应用缓存目录（~/Library/Caches 下非浏览器子目录）
//!   - 沙箱应用缓存（~/Library/Containers 下各 App 的 Data/Library/Caches）
//!   - Steam 缓存
//!   - 邮件附件
use std::path::PathBuf;

use crate::clean::traits::{ScanCategory, ScanTarget, Target};
use crate::clean::utils::{existing_paths, home, named_dirs};
use crate::models::clean::CleanMethod;

/// 浏览器缓存目录前缀（用于从 ~/Library/Caches 中排除）
const BROWSER_CACHE_PREFIXES: &[&str] = &[
    "com.apple.Safari",
    "Google",
    "Firefox",
    "com.google.Chrome",
    "org.mozilla.firefox",
    "Chrome",
];

// ────────────────────────────────────────────────────────────────────────────
//  目录获取（私有函数）
// ────────────────────────────────────────────────────────────────────────────

/// 获取用户级缓存目录中非浏览器的应用缓存
fn get_application_cache_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![];
    if let Some(home) = home() {
        let user_caches = home.join("Library/Caches");
        if let Ok(entries) = std::fs::read_dir(&user_caches) {
            for entry in entries.filter_map(|e| e.ok()) {
                let name = entry.file_name().to_string_lossy().to_string();
                let is_browser = BROWSER_CACHE_PREFIXES
                    .iter()
                    .any(|prefix| name.starts_with(prefix));
                if is_browser {
                    continue;
                }
                let path = entry.path();
                if path.is_dir() {
                    dirs.push(path);
                }
            }
        }
    }
    dirs
}

/// 获取容器化应用缓存目录（~/Library/Containers 下各 App 的 Data/Library/Caches）
fn get_sandbox_cache_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![];
    if let Some(home) = home() {
        let containers = home.join("Library/Containers");
        if let Ok(entries) = std::fs::read_dir(&containers) {
            for entry in entries.filter_map(|e| e.ok()) {
                let cache_candidate = entry.path().join("Data/Library/Caches");
                if cache_candidate.is_dir() {
                    dirs.push(cache_candidate);
                }
            }
        }
    }
    dirs
}

// ────────────────────────────────────────────────────────────────────────────
//  ApplicationCategory
// ────────────────────────────────────────────────────────────────────────────

/// 应用缓存分类
pub struct ApplicationCategory;

impl ScanCategory for ApplicationCategory {
    fn category_id(&self) -> &str {
        "application"
    }

    fn title(&self) -> &str {
        "应用缓存"
    }

    fn tips(&self) -> &str {
        "应用缓存、沙箱应用、Steam、邮件附件等"
    }

    fn recommend(&self) -> bool {
        true
    }

    fn cautious(&self) -> bool {
        false
    }

    fn targets(&self) -> Vec<Box<dyn ScanTarget>> {
        vec![
            // 应用缓存目录
            Box::new(Target::new(
                "app_cache",
                "应用缓存目录",
                "用户在 ~/Library/Caches 下的缓存文件",
                true,
                false,
                CleanMethod::MoveTrash,
                || named_dirs(get_application_cache_dirs()),
            )),
            // 沙箱应用缓存
            Box::new(Target::new(
                "sandbox_cache",
                "沙箱应用缓存",
                "沙箱化应用的缓存（微信、QQ 等）",
                true,
                false,
                CleanMethod::MoveTrash,
                || named_dirs(get_sandbox_cache_dirs()),
            )),
            // Steam 缓存
            Box::new(Target::new(
                "steam_cache",
                "Steam 缓存",
                "Steam 游戏平台的应用缓存和下载临时文件",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            let steam = h.join("Library/Application Support/Steam");
                            existing_paths(vec![
                                steam.join("appcache"),
                                steam.join("package"),
                                steam.join("steamapps/downloading"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // 邮件附件
            Box::new(Target::new(
                "mail_downloads",
                "邮件附件",
                "Mail.app 下载的邮件附件缓存",
                false,
                true,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/Containers/com.apple.mail/Data/Library/Downloads"),
                                h.join(
                                    "Library/Containers/com.apple.mail/Data/Library/Mail Downloads",
                                ),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
        ]
    }
}

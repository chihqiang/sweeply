/**
 * 浏览器缓存分类
 *
 * 包含扫描目标：
 *   - Safari 缓存
 *   - Chrome 缓存
 *   - Firefox 缓存
 */
use crate::clean::traits::{ScanCategory, ScanTarget, Target};
use crate::clean::utils::{existing_paths, home, named_dirs};
use crate::models::clean::CleanMethod;

// ────────────────────────────────────────────────────────────────────────────
//  BrowserCategory
// ────────────────────────────────────────────────────────────────────────────

/// 浏览器缓存分类
pub struct BrowserCategory;

impl ScanCategory for BrowserCategory {
    fn category_id(&self) -> &str {
        "browser"
    }

    fn title(&self) -> &str {
        "浏览器缓存"
    }

    fn tips(&self) -> &str {
        "Safari、Chrome、Firefox 缓存文件"
    }

    fn recommend(&self) -> bool {
        true
    }

    fn cautious(&self) -> bool {
        false
    }

    fn targets(&self) -> Vec<Box<dyn ScanTarget>> {
        vec![
            // Safari 缓存
            Box::new(Target::new(
                "safari_cache",
                "Safari 缓存",
                "Safari 浏览器缓存和本地存储",
                true,
                false,
                CleanMethod::MoveTrash,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/Caches/com.apple.Safari"),
                                h.join("Library/Safari/LocalStorage"),
                                h.join("Library/Containers/com.apple.Safari/Data/Library/Caches"),
                                h.join("Library/WebKit/com.apple.Safari"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // Chrome 缓存
            Box::new(Target::new(
                "chrome_cache",
                "Chrome 缓存",
                "Chrome 浏览器缓存和代码缓存",
                true,
                false,
                CleanMethod::MoveTrash,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/Caches/Google/Chrome"),
                                h.join("Library/Application Support/Google/Chrome/Default/Cache"),
                                h.join(
                                    "Library/Application Support/Google/Chrome/Default/Code Cache",
                                ),
                                h.join("Library/Application Support/Google/Chrome/Default/GPUCache"),
                                h.join("Library/Application Support/Google/Chrome/Default/Service Worker/CacheStorage"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // Firefox 缓存
            Box::new(Target::new(
                "firefox_cache",
                "Firefox 缓存",
                "Firefox 浏览器缓存",
                true,
                false,
                CleanMethod::MoveTrash,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/Caches/Firefox"),
                                h.join("Library/Application Support/Firefox/Profiles"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
        ]
    }
}

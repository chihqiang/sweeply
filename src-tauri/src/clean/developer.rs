/**
 * 开发者缓存分类
 *
 * 包含扫描目标：
 *   - Xcode 开发缓存（DerivedData、设备支持文件等）
 *   - npm / yarn / pnpm 缓存
 *   - Homebrew / CocoaPods / SPM 缓存
 *   - pip / Cargo / Gradle 缓存
 *   - Xcode 设备日志 / Pub 缓存 / Android Studio 缓存
 */
use std::path::PathBuf;

use crate::clean::traits::{ScanCategory, ScanTarget, Target};
use crate::clean::utils::{existing_paths, home, named_dirs};
use crate::models::clean::CleanMethod;

// ────────────────────────────────────────────────────────────────────────────
//  目录获取（私有函数）
// ────────────────────────────────────────────────────────────────────────────

/// 获取 Android Studio 缓存目录
fn get_android_studio_cache_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![];
    if let Some(home) = home() {
        let cache_dir = home.join("Library/Caches/Google");
        if let Ok(entries) = std::fs::read_dir(&cache_dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with("AndroidStudio") || name == "Flutter" || name == "FlutterCommon" {
                    if entry.path().is_dir() {
                        dirs.push(entry.path());
                    }
                }
            }
        }
        let android_cache = home.join(".android/cache");
        if android_cache.exists() {
            dirs.push(android_cache);
        }
    }
    dirs
}

// ────────────────────────────────────────────────────────────────────────────
//  DeveloperCategory
// ────────────────────────────────────────────────────────────────────────────

/// 开发者缓存分类
pub struct DeveloperCategory;

impl ScanCategory for DeveloperCategory {
    fn category_id(&self) -> &str {
        "developer"
    }

    fn title(&self) -> &str {
        "开发者缓存"
    }

    fn tips(&self) -> &str {
        "Xcode、Homebrew、npm/yarn/pnpm、CocoaPods、SPM、pip、Cargo、Gradle、Pub、Android Studio 等开发工具缓存"
    }

    fn recommend(&self) -> bool {
        true
    }

    fn cautious(&self) -> bool {
        false
    }

    fn targets(&self) -> Vec<Box<dyn ScanTarget>> {
        vec![
            // Xcode 开发缓存
            Box::new(Target::new(
                "xcode_dev",
                "Xcode 开发缓存",
                "DerivedData、设备支持文件等",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/Developer/Xcode/DerivedData"),
                                h.join("Library/Developer/Xcode/iOS DeviceSupport"),
                                h.join("Library/Developer/CoreSimulator/Caches"),
                                h.join("Library/Developer/Xcode/Archives"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // npm 缓存
            Box::new(Target::new(
                "npm_cache",
                "npm 缓存",
                "npm 包管理器缓存",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| existing_paths(vec![h.join(".npm/_cacache")]))
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // yarn 缓存
            Box::new(Target::new(
                "yarn_cache",
                "yarn 缓存",
                "yarn 包管理器缓存",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/Caches/Yarn"),
                                h.join(".yarn/cache"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // pnpm 缓存
            Box::new(Target::new(
                "pnpm_store",
                "pnpm 缓存",
                "pnpm 包管理器 store",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/pnpm/store"),
                                h.join(".local/share/pnpm/store"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // Homebrew 缓存
            Box::new(Target::new(
                "dev_brew",
                "Homebrew 缓存",
                "Homebrew 包管理器下载的安装包缓存",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/Caches/Homebrew"),
                                h.join(".cache/Homebrew"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // CocoaPods 缓存
            Box::new(Target::new(
                "dev_cocoapods",
                "CocoaPods 缓存",
                "CocoaPods 依赖库缓存",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| existing_paths(vec![h.join("Library/Caches/CocoaPods")]))
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // SPM 缓存
            Box::new(Target::new(
                "dev_spm",
                "SPM 缓存",
                "Swift Package Manager 包缓存",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/Caches/org.swift.swiftpm"),
                                h.join("Library/Developer/Xcode/DerivedData/SourcePackages"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // pip 缓存
            Box::new(Target::new(
                "dev_pip",
                "pip 缓存",
                "Python pip 包管理器的下载缓存",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/Caches/pip"),
                                h.join(".cache/pip"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // Cargo 缓存
            Box::new(Target::new(
                "dev_cargo",
                "Cargo 缓存",
                "Rust Cargo 包管理器的注册表缓存",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| existing_paths(vec![h.join(".cargo/registry/cache")]))
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // Gradle 缓存
            Box::new(Target::new(
                "dev_gradle",
                "Gradle 缓存",
                "Android/Java Gradle 构建缓存",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| existing_paths(vec![h.join(".gradle/caches")]))
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // Xcode 设备日志
            Box::new(Target::new(
                "dev_xcode_logs",
                "Xcode 设备日志",
                "iOS 设备的连接日志",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![h.join("Library/Developer/Xcode/iOS Device Logs")])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // Pub 缓存
            Box::new(Target::new(
                "dev_pub",
                "Pub 缓存",
                "Dart/Flutter 包管理器的缓存",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join(".pub-cache"),
                                h.join("Library/Caches/pub"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // Android Studio 缓存
            Box::new(Target::new(
                "dev_android",
                "Android Studio 缓存",
                "Android Studio IDE 和 Android SDK 缓存",
                true,
                false,
                CleanMethod::Remove,
                || named_dirs(get_android_studio_cache_dirs()),
            )),
        ]
    }
}

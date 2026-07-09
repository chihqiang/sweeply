/**
 * 系统垃圾分类
 *
 * 包含扫描目标：
 *   - 系统缓存（/Library/Caches）
 *   - 临时文件（/tmp、/private/var/tmp）
 *   - 系统日志（/var/log、~/Library/Logs）
 *   - 废纸篓（~/.Trash）
 *   - 崩溃报告
 *   - Quick Look 缩略图缓存
 *   - 字体缓存
 *   - iOS 设备备份
 */
use std::path::PathBuf;

use crate::clean::traits::{ScanCategory, ScanTarget, Target};
use crate::clean::utils::{existing_paths, home, home_join, named_dirs};
use crate::models::clean::CleanMethod;

// ────────────────────────────────────────────────────────────────────────────
//  SystemCategory
// ────────────────────────────────────────────────────────────────────────────

/// 系统垃圾分类
pub struct SystemCategory;

impl ScanCategory for SystemCategory {
    fn category_id(&self) -> &str {
        "system"
    }

    fn title(&self) -> &str {
        "系统垃圾"
    }

    fn tips(&self) -> &str {
        "系统缓存、临时文件、日志、废纸篓、崩溃报告、iOS 备份等"
    }

    fn recommend(&self) -> bool {
        true
    }

    fn cautious(&self) -> bool {
        false
    }

    fn targets(&self) -> Vec<Box<dyn ScanTarget>> {
        vec![
            // 系统缓存
            Box::new(Target::new(
                "sys_cache",
                "系统缓存",
                "系统级缓存文件",
                true,
                false,
                CleanMethod::MoveTrash,
                || {
                    named_dirs(existing_paths(vec![PathBuf::from("/Library/Caches")]))
                },
            )),
            // 临时文件
            Box::new(Target::new(
                "sys_temp",
                "临时文件",
                "系统和应用临时文件",
                true,
                false,
                CleanMethod::Remove,
                || {
                    named_dirs(vec![
                        std::env::temp_dir(),
                        PathBuf::from("/private/var/tmp"),
                        PathBuf::from("/tmp"),
                    ])
                },
            )),
            // 系统日志
            Box::new(Target::new(
                "sys_log",
                "系统日志",
                "系统和应用日志文件",
                false,
                true,
                CleanMethod::Remove,
                || {
                    let mut dirs = vec![PathBuf::from("/var/log")];
                    if let Some(h) = home() {
                        dirs.push(h.join("Library/Logs"));
                    }
                    named_dirs(dirs)
                },
            )),
            // 废纸篓
            Box::new(Target::new(
                "sys_trash",
                "废纸篓",
                "已删除但未清空的文件",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home_join(&[".Trash"])
                        .map(|d| vec![d])
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // 崩溃报告
            Box::new(Target::new(
                "sys_crash",
                "崩溃报告",
                "系统和应用的崩溃日志及诊断报告",
                false,
                true,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/Application Support/CrashReporter"),
                                h.join("Library/Logs/DiagnosticReports"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // Quick Look 缓存
            Box::new(Target::new(
                "sys_quicklook",
                "Quick Look 缓存",
                "文件预览缩略图缓存",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home_join(&[
                        "Library",
                        "Caches",
                        "com.apple.QuickLook.thumbnails",
                    ])
                    .map(|d| existing_paths(vec![d]))
                    .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // 字体缓存
            Box::new(Target::new(
                "sys_font",
                "字体缓存",
                "系统字体渲染和字体服务缓存",
                true,
                false,
                CleanMethod::Remove,
                || {
                    let dirs = home()
                        .map(|h| {
                            existing_paths(vec![
                                h.join("Library/Caches/com.apple.ATS"),
                                h.join("Library/Caches/com.apple.FontServices"),
                            ])
                        })
                        .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
            // iOS 备份
            Box::new(Target::new(
                "sys_ios_backup",
                "iOS 备份",
                "iPhone/iPad 设备备份，可能包含大量个人数据",
                false,
                true,
                CleanMethod::Remove,
                || {
                    let dirs = home_join(&[
                        "Library",
                        "Application Support",
                        "MobileSync",
                        "Backup",
                    ])
                    .map(|d| existing_paths(vec![d]))
                    .unwrap_or_default();
                    named_dirs(dirs)
                },
            )),
        ]
    }
}

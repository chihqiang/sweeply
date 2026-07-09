/**
 * 路径辅助函数
 *
 * 提供通用的目录解析工具，减少各分类文件中的重复代码。
 */
use std::path::PathBuf;

// ────────────────────────────────────────────────────────────────────────────
//  路径过滤
// ────────────────────────────────────────────────────────────────────────────

/// 过滤出存在的路径
///
/// 用于候选路径列表中剔除不存在的目录。
pub fn existing_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    paths.into_iter().filter(|p| p.exists()).collect()
}

// ────────────────────────────────────────────────────────────────────────────
//  路径 → 命名条目
// ────────────────────────────────────────────────────────────────────────────

/// 将路径列表转换为 `(目录名, 路径)` 命名条目
///
/// 大多数扫描目标以目录名作为显示标题，使用此函数统一处理。
pub fn named_dirs(dirs: Vec<PathBuf>) -> Vec<(String, PathBuf)> {
    dirs.into_iter()
        .map(|d| {
            let title = d
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default();
            (title, d)
        })
        .collect()
}

// ────────────────────────────────────────────────────────────────────────────
//  Home 目录
// ────────────────────────────────────────────────────────────────────────────

/// 获取用户 Home 目录，若无法获取则返回空列表哨兵
///
/// 用于各分类文件中统一获取 `~/Library/...` 路径。
pub fn home() -> Option<PathBuf> {
    dirs::home_dir()
}

/// 以 Home 目录为基准拼接路径
///
/// # 示例
/// ```ignore
/// let caches = home_join(&["Library", "Caches"]);
/// ```
pub fn home_join(parts: &[&str]) -> Option<PathBuf> {
    home().map(|h| {
        let mut path = h;
        for part in parts {
            path = path.join(part);
        }
        path
    })
}

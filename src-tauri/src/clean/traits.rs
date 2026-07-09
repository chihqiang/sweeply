/**
 * 清理扫描接口定义
 *
 * 设计理念：面向接口编程，通过 trait 定义扫描契约
 * - ScanTarget: 单个扫描目标，对应一个 CleanSubcategory
 * - ScanCategory: 扫描分类，包含多个 ScanTarget，对应一个 CleanCategory
 *
 * 依赖注入：ScanTarget / ScanCategory 仅定义数据契约，
 * 实际扫描逻辑由 DirScanner 注入 ScanContext 后执行。
 */
use std::path::PathBuf;

use crate::models::clean::CleanMethod;

// ────────────────────────────────────────────────────────────────────────────
//  ScanTarget — 单个扫描目标接口
// ────────────────────────────────────────────────────────────────────────────

/// 单个扫描目标，对应一个 `CleanSubcategory`
///
/// 每个目标知道自己的元信息（ID、标题、提示等）和待扫描的目录条目。
/// 扫描器通过 `items()` 获取条目列表后执行实际遍历。
pub trait ScanTarget: Send + Sync {
    /// 子分类 ID（如 "sys_cache"、"safari_cache"）
    fn id(&self) -> &str;
    /// 子分类标题（如 "系统缓存"）
    fn title(&self) -> &str;
    /// 子分类提示
    fn tips(&self) -> &str;
    /// 是否推荐清理
    fn recommend(&self) -> bool;
    /// 是否需要谨慎操作
    fn cautious(&self) -> bool;
    /// 清理方式
    fn clean_method(&self) -> CleanMethod;
    /// 返回待扫描的命名条目列表 `(显示标题, 路径)`
    ///
    /// 大多数目标以目录名作为标题；
    /// 特殊目标（如 AI 工具）可自定义标题。
    fn items(&self) -> Vec<(String, PathBuf)>;
}

// ────────────────────────────────────────────────────────────────────────────
//  ScanCategory — 扫描分类接口
// ────────────────────────────────────────────────────────────────────────────

/// 扫描分类，对应一个 `CleanCategory`
///
/// 分类是一组 `ScanTarget` 的集合，提供分类级别的元信息。
/// 引擎通过 `targets()` 获取所有子目标并逐个扫描。
pub trait ScanCategory: Send + Sync {
    /// 分类 ID（如 "system"、"browser"）
    fn category_id(&self) -> &str;
    /// 分类标题（如 "系统垃圾"）
    fn title(&self) -> &str;
    /// 分类提示
    fn tips(&self) -> &str;
    /// 是否推荐清理
    fn recommend(&self) -> bool;
    /// 是否需要谨慎操作
    fn cautious(&self) -> bool;
    /// 返回该分类下的所有扫描目标
    fn targets(&self) -> Vec<Box<dyn ScanTarget>>;
}

// ────────────────────────────────────────────────────────────────────────────
//  Target — ScanTarget 的通用实现
// ────────────────────────────────────────────────────────────────────────────

/// `ScanTarget` 的通用实现，通过闭包动态解析目录条目
///
/// # 设计说明
/// - 静态目录目标：闭包返回固定路径列表
/// - 动态目录目标：闭包读取文件系统后返回路径列表
/// - 自定义标题目标（如 AI 工具）：闭包返回 `(名称, 路径)` 对
pub struct Target {
    id: &'static str,
    title: &'static str,
    tips: &'static str,
    recommend: bool,
    cautious: bool,
    clean_method: CleanMethod,
    items_fn: Box<dyn Fn() -> Vec<(String, PathBuf)> + Send + Sync>,
}

impl Target {
    /// 创建一个新的扫描目标
    ///
    /// # 参数
    /// - `id`: 子分类 ID
    /// - `title`: 子分类标题
    /// - `tips`: 子分类提示
    /// - `recommend`: 是否推荐清理
    /// - `cautious`: 是否需要谨慎
    /// - `clean_method`: 清理方式
    /// - `items_fn`: 返回 `(标题, 路径)` 列表的闭包
    pub fn new(
        id: &'static str,
        title: &'static str,
        tips: &'static str,
        recommend: bool,
        cautious: bool,
        clean_method: CleanMethod,
        items_fn: impl Fn() -> Vec<(String, PathBuf)> + Send + Sync + 'static,
    ) -> Self {
        Self {
            id,
            title,
            tips,
            recommend,
            cautious,
            clean_method,
            items_fn: Box::new(items_fn),
        }
    }
}

impl ScanTarget for Target {
    fn id(&self) -> &str {
        self.id
    }

    fn title(&self) -> &str {
        self.title
    }

    fn tips(&self) -> &str {
        self.tips
    }

    fn recommend(&self) -> bool {
        self.recommend
    }

    fn cautious(&self) -> bool {
        self.cautious
    }

    fn clean_method(&self) -> CleanMethod {
        self.clean_method.clone()
    }

    fn items(&self) -> Vec<(String, PathBuf)> {
        (self.items_fn)()
    }
}

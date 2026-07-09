/**
 * 垃圾清理引擎模块
 *
 * 面向对象的清理扫描架构：
 *
 * ```text
 * ┌─────────────┐    注入     ┌──────────────┐
 * │ CleanEngine │ ─────────▶ │  ScanContext  │  (emitter + cancel)
 * └──────┬──────┘            └──────┬───────┘
 *        │                          │ 注入
 *        ▼                          ▼
 * ┌──────────────┐          ┌──────────────┐
 * │ ScanCategory │ ──targets──▶  DirScanner │  (遍历 + 大小计算)
 * └──────┬───────┘          └──────────────┘
 *        │ targets
 *        ▼
 * ┌──────────────┐
 * │  ScanTarget  │  (元信息 + 目录条目)
 * └──────────────┘
 * ```
 *
 * 设计原则：
 *   1. 接口先行 — `traits.rs` 定义 `ScanTarget` / `ScanCategory` 契约
 *   2. 依赖注入 — `ScanContext` 携带共享依赖，注入到 `DirScanner`
 *   3. 单一职责 — 每个文件负责一个概念（分类、扫描器、进度等）
 *   4. 开闭原则 — 新增分类只需实现 `ScanCategory`，无需修改引擎
 */
pub mod aitools;
pub mod application;
pub mod browser;
pub mod cleaner;
pub mod context;
pub mod developer;
pub mod progress;
pub mod scanner;
pub mod system;
pub mod traits;
pub mod utils;

// 重新导出常用类型
pub use cleaner::Cleaner;
pub use context::ScanContext;
pub use progress::{CancelToken, ProgressEmitter};
pub use scanner::DirScanner;
#[allow(unused_imports)]
pub use traits::{ScanCategory, ScanTarget, Target};

use crate::models::clean::{CleanCategory, CleanScanSummary};

// ────────────────────────────────────────────────────────────────────────────
//  CleanEngine — 扫描引擎
// ────────────────────────────────────────────────────────────────────────────

/// 清理扫描引擎 — 编排所有分类的扫描流程
///
/// # 职责
/// - 管理扫描分类列表（可通过 `with_categories` 自定义）
/// - 计算进度区间并分配给各扫描目标
/// - 驱动 `DirScanner` 逐目标扫描
/// - 汇总结果为 `CleanScanSummary`
///
/// # 用法
/// ```ignore
/// let engine = CleanEngine::default();
/// let emitter = ProgressEmitter::new(app);
/// let cancel = CancelToken::global();
/// let summary = engine.scan(&emitter, &cancel)?;
/// ```
pub struct CleanEngine {
    categories: Vec<Box<dyn ScanCategory>>,
}

impl CleanEngine {
    /// 使用默认分类创建引擎
    pub fn new() -> Self {
        Self {
            categories: vec![
                Box::new(system::SystemCategory),
                Box::new(browser::BrowserCategory),
                Box::new(application::ApplicationCategory),
                Box::new(developer::DeveloperCategory),
                Box::new(aitools::AIToolsCategory),
            ],
        }
    }

    /// 使用自定义分类列表创建引擎（依赖注入）
    ///
    /// 允许外部注入分类列表，便于测试和扩展。
    #[allow(dead_code)]
    pub fn with_categories(categories: Vec<Box<dyn ScanCategory>>) -> Self {
        Self { categories }
    }

    /// 执行扫描
    ///
    /// # 参数
    /// - `emitter`: 进度发射器（注入）
    /// - `cancel`: 取消令牌（注入）
    ///
    /// # 返回
    /// 扫描结果汇总，或在取消/异常时返回错误
    pub fn scan(
        &self,
        emitter: &ProgressEmitter,
        cancel: &CancelToken,
    ) -> Result<CleanScanSummary, String> {
        let scan_start = std::time::Instant::now();
        log::info!("[clean] 开始扫描垃圾文件...");

        cancel.reset();

        if cancel.is_cancelled() {
            log::warn!("[clean] 扫描在开始前即被取消");
            return Err("扫描已取消".to_string());
        }

        // 构建扫描上下文（依赖注入）
        let ctx = ScanContext { emitter, cancel };
        let scanner = DirScanner::new(&ctx);

        // 统计总扫描目标数，用于均匀分配进度区间
        let all_targets: Vec<(&dyn ScanCategory, Vec<Box<dyn ScanTarget>>)> = self
            .categories
            .iter()
            .map(|cat| (cat.as_ref(), cat.targets()))
            .collect();

        let total_targets: usize = all_targets.iter().map(|(_, t)| t.len()).sum();
        if total_targets == 0 {
            return Ok(CleanScanSummary {
                categories: vec![],
                total_size: 0,
                selected_size: 0,
                total_file_count: 0,
                selected_file_count: 0,
            });
        }

        // 进度区间：0.02 ~ 0.98，均匀分配给所有目标
        let progress_start = 0.02;
        let progress_end = 0.98;
        let progress_span = progress_end - progress_start;

        let mut categories_result = Vec::with_capacity(self.categories.len());
        let mut total_size: u64 = 0;
        let mut total_file_count: u64 = 0;
        let mut target_index = 0usize;

        emitter.emit(progress_start, "初始化扫描...");

        for (category, targets) in &all_targets {
            let cat_target_count = targets.len();
            let mut subcategories = Vec::with_capacity(cat_target_count);
            let mut cat_total_size: u64 = 0;

            for target in targets {
                let phase_start =
                    progress_start + progress_span * (target_index as f64) / (total_targets as f64);
                let phase_end = progress_start
                    + progress_span * ((target_index + 1) as f64) / (total_targets as f64);

                emitter.emit(phase_start, &format!("正在扫描{}...", target.title()));

                let subcat = scanner.scan_target(target.as_ref(), phase_start, phase_end);

                total_file_count += subcat.results.len() as u64;
                cat_total_size += subcat.total_size;
                subcategories.push(subcat);

                cancel.check()?;
                target_index += 1;
            }

            total_size += cat_total_size;

            categories_result.push(CleanCategory {
                category_id: category.category_id().to_string(),
                title: category.title().to_string(),
                tips: category.tips().to_string(),
                recommend: category.recommend(),
                cautious: category.cautious(),
                subcategories,
                results: vec![],
                total_size: cat_total_size,
            });
        }

        emitter.emit(1.0, "扫描完成");

        let elapsed = scan_start.elapsed();
        log::info!(
            "[clean] 扫描完成: {} 个分类, {} 个文件项, 总计 {:.2} MB, 耗时 {:.2}s",
            categories_result.len(),
            total_file_count,
            total_size as f64 / 1_048_576.0,
            elapsed.as_secs_f64()
        );

        Ok(CleanScanSummary {
            categories: categories_result,
            total_size,
            selected_size: 0,
            total_file_count,
            selected_file_count: 0,
        })
    }
}

impl Default for CleanEngine {
    fn default() -> Self {
        Self::new()
    }
}

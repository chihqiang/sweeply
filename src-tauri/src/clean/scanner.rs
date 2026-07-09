/**
 * 目录扫描器 — 核心扫描引擎
 *
 * 通过依赖注入接收 ScanContext（进度发射器 + 取消令牌），
 * 对 ScanTarget 执行实际的文件系统遍历和大小计算。
 *
 * 核心职责：
 *   1. 遍历目标目录树（walkdir）
 *   2. 累加文件大小
 *   3. 定期发射进度事件
 *   4. 构建 CleanSubcategory 结果
 */
use std::path::Path;

use walkdir::WalkDir;

use crate::clean::context::ScanContext;
use crate::clean::traits::ScanTarget;
use crate::models::clean::{CleanResultItem, CleanSubcategory};

/// 每扫描多少个文件条目发送一次进度
const PROGRESS_EMIT_INTERVAL: u64 = 300;

// ────────────────────────────────────────────────────────────────────────────
//  DirScanner
// ────────────────────────────────────────────────────────────────────────────

/// 目录扫描器 — 接收注入的 `ScanContext`，执行实际扫描
pub struct DirScanner<'a> {
    ctx: &'a ScanContext<'a>,
}

impl<'a> DirScanner<'a> {
    /// 创建扫描器，注入扫描上下文
    pub fn new(ctx: &'a ScanContext<'a>) -> Self {
        Self { ctx }
    }

    /// 扫描一个 `ScanTarget`，返回对应的 `CleanSubcategory`
    ///
    /// # 参数
    /// - `target`: 扫描目标（定义了元信息和待扫描条目）
    /// - `phase_start` / `phase_end`: 该目标在整体进度中的区间 [0.0, 1.0]
    pub fn scan_target(
        &self,
        target: &dyn ScanTarget,
        phase_start: f64,
        phase_end: f64,
    ) -> CleanSubcategory {
        let items = target.items();
        let count = items.len();
        let mut results = Vec::with_capacity(count);
        let mut total_size: u64 = 0;

        for (idx, (title, path)) in items.iter().enumerate() {
            if !path.exists() {
                log::warn!("[clean] 目录不存在，跳过: {}", path.display());
                continue;
            }

            // 为每个子目录分配进度子区间
            let (sub_start, sub_end) = if count > 0 {
                let span = phase_end - phase_start;
                let s = phase_start + span * (idx as f64) / (count as f64);
                let e = phase_start + span * ((idx + 1) as f64) / (count as f64);
                (s, e)
            } else {
                (phase_start, phase_end)
            };

            let label = format!("{}/{}", target.title(), title);
            let size = self.calculate_path_size(path, sub_start, sub_end, &label);

            // 该目录扫描完成，发送区间终点进度
            self.ctx
                .emitter
                .emit(sub_end, &format!("{} · 完成", target.title()));

            // 只记录大小 > 0 的目录
            if size > 0 {
                total_size += size;
                let path_str = path.display().to_string();
                results.push(CleanResultItem {
                    id: format!("{}::{}", target.id(), path_str),
                    title: title.clone(),
                    path: path_str.clone(),
                    display_path: path_str,
                    size,
                    clean_method: target.clean_method(),
                    selected: false,
                    icon_path: None,
                });
            }
        }

        // 按大小降序排列，让用户优先看到占空间最大的项
        results.sort_by(|a, b| b.size.cmp(&a.size));

        CleanSubcategory {
            subcategory_id: target.id().to_string(),
            title: target.title().to_string(),
            tips: target.tips().to_string(),
            recommend: target.recommend(),
            cautious: target.cautious(),
            results,
            total_size,
        }
    }

    /// 带进度的路径大小计算
    ///
    /// 使用渐近曲线让进度在遍历过程中持续推进，但不超过 `phase_end`。
    /// 公式：`fraction = 1 - 1/(1 + n/k)`，n 越大越接近 1。
    fn calculate_path_size(
        &self,
        path: &Path,
        phase_start: f64,
        phase_end: f64,
        label: &str,
    ) -> u64 {
        // 单个文件直接返回
        if let Ok(meta) = path.metadata() {
            if meta.is_file() {
                return meta.len();
            }
        }

        let mut total_size: u64 = 0;
        let mut entry_count: u64 = 0;
        let mut last_emit: u64 = 0;

        for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                if let Ok(meta) = entry.metadata() {
                    total_size += meta.len();
                }
            }
            entry_count += 1;

            // 每隔一定数量发送一次进度 + 检查取消
            if entry_count - last_emit >= PROGRESS_EMIT_INTERVAL {
                last_emit = entry_count;

                // 响应用户取消（比原实现更及时）
                if self.ctx.cancel.is_cancelled() {
                    log::info!("[clean] 扫描在遍历 {} 时被取消", label);
                    break;
                }

                // 渐近曲线：只取区间的 90%，留 10% 给目录完成时
                let fraction = 1.0 - 1.0 / (1.0 + entry_count as f64 / 2000.0);
                let progress = phase_start + (phase_end - phase_start) * fraction * 0.9;
                let desc = format!("{} · {} 个文件", label, entry_count);
                self.ctx.emitter.emit(progress, &desc);
            }
        }

        total_size
    }
}

/**
 * AI 编程助手分类
 *
 * 扫描主流 AI 编程工具的家目录数据（缓存、会话历史等）。
 *
 * 特殊处理：每个 AI 工具的显示标题为工具名称（而非目录名），
 * 因此 `items()` 返回 `(名称, 路径)` 对而非普通命名目录。
 */
use std::path::PathBuf;

use crate::clean::traits::{ScanCategory, ScanTarget, Target};
use crate::clean::utils::home;
use crate::models::clean::CleanMethod;

// ────────────────────────────────────────────────────────────────────────────
//  目录获取（私有函数）
// ────────────────────────────────────────────────────────────────────────────

/// 获取 AI 编程助手目录列表 `(显示名称, 路径)`
///
/// 按热门程度排列，仅返回实际存在的目录。
fn get_ai_agent_dirs() -> Vec<(String, PathBuf)> {
    let mut dirs = vec![];
    if let Some(home) = home() {
        // (显示名称, 路径) — 按热门程度排列
        let candidates: Vec<(&str, PathBuf)> = vec![
            ("Claude Code", home.join(".claude")),
            ("Codex", home.join(".codex")),
            ("Cursor", home.join(".cursor")),
            ("GitHub Copilot", home.join(".copilot")),
            ("Windsurf", home.join(".codeium")),
            ("Continue", home.join(".continue")),
            ("Augment", home.join(".augment")),
            ("Gemini CLI", home.join(".gemini")),
            ("Goose", home.join(".config/goose")),
            ("OpenCode", home.join(".config/opencode")),
            ("OpenHands", home.join(".openhands")),
            ("Universal Agents", home.join(".agents")),
            ("Roo Code", home.join(".roo")),
            ("Kilo Code", home.join(".kilocode")),
            ("Factory Droid", home.join(".factory")),
            ("Kiro CLI", home.join(".kiro")),
            ("Qoder", home.join(".qoder")),
            ("Qwen Code", home.join(".qwen")),
            ("Trae", home.join(".trae")),
            ("Tabnine", home.join(".tabnine")),
            ("Zencoder", home.join(".zencoder")),
            ("Windsurf Alt", home.join(".windsurf")),
            ("Devin", home.join(".config/devin")),
            ("Crush", home.join(".config/crush")),
            ("DeepAgents", home.join(".deepagents")),
            ("ForgeCode", home.join(".forge")),
            ("Firebender", home.join(".firebender")),
            ("Cline", home.join(".cline")),
            ("Hermes Agent", home.join(".hermes")),
            ("Jazz", home.join(".jazz")),
            ("Junie", home.join(".junie")),
            ("iFlow CLI", home.join(".iflow")),
            ("Kode", home.join(".kode")),
            ("Lingma", home.join(".lingma")),
            ("MCPJam", home.join(".mcpjam")),
            ("Mistral Vibe", home.join(".vibe")),
            ("Moxby", home.join(".moxby")),
            ("Ona", home.join(".ona")),
            ("Pi", home.join(".pi")),
            ("Reasonix", home.join(".reasonix")),
            ("Rovo Dev", home.join(".rovodev")),
            ("Terramind", home.join(".terramind")),
            ("Tinycloud", home.join(".tinycloud")),
            ("Neovate", home.join(".neovate")),
            ("Pochi", home.join(".pochi")),
            ("AdaL", home.join(".adal")),
            ("AiderDesk", home.join(".aider-desk")),
            ("AstrBot", home.join(".astrbot")),
            ("Autohand", home.join(".autohand")),
            ("IBM Bob", home.join(".bob")),
            ("CodeArts", home.join(".codeartsdoer")),
            ("CodeBuddy", home.join(".codebuddy")),
            ("Codemaker", home.join(".codemaker")),
            ("Code Studio", home.join(".codestudio")),
            ("Command Code", home.join(".commandcode")),
            ("Cortex Code", home.join(".cortex")),
            ("inference.sh", home.join(".inferencesh")),
            ("OpenClaw", home.join(".openclaw")),
        ];

        for (name, path) in candidates {
            if path.exists() && path.is_dir() {
                dirs.push((name.to_string(), path));
            }
        }
    }
    dirs
}

// ────────────────────────────────────────────────────────────────────────────
//  AIToolsCategory
// ────────────────────────────────────────────────────────────────────────────

/// AI 编程助手分类
pub struct AIToolsCategory;

impl ScanCategory for AIToolsCategory {
    fn category_id(&self) -> &str {
        "aitools"
    }

    fn title(&self) -> &str {
        "AI 编程助手"
    }

    fn tips(&self) -> &str {
        "Claude Code、Cursor、Copilot 等 AI 工具的缓存和会话数据"
    }

    fn recommend(&self) -> bool {
        false
    }

    fn cautious(&self) -> bool {
        true
    }

    fn targets(&self) -> Vec<Box<dyn ScanTarget>> {
        vec![
            // AI Agent — 直接返回 (名称, 路径) 对
            Box::new(Target::new(
                "ai_agent",
                "Agent",
                "AI 编程助手的缓存、会话历史和技能文件",
                false,
                true,
                CleanMethod::MoveTrash,
                get_ai_agent_dirs,
            )),
        ]
    }
}

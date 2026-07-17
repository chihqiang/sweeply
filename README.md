# Sweeply

基于 Tauri 2.0 打造的轻量级 macOS 系统清理与优化工具。使用 Rust 后端 + React 前端，提供高效的垃圾清理、磁盘分析、重复文件查找等功能。

## 功能特性

### 核心功能

- **智能垃圾清理** — 扫描系统缓存、应用残留、浏览器缓存、AI 工具数据等，支持分类选择和推荐清理
- **应用卸载** — 扫描已安装应用及其残留文件，安全卸载并清理关联数据
- **磁盘空间分析** — 可视化展示磁盘使用分布，快速定位大文件和占用空间的目录
- **大文件查找** — 按大小阈值扫描目录中的大文件，支持在访达中定位
- **重复文件查找** — 基于 SHA-256 哈希检测重复文件，智能预选保留最新副本
- **网络测速** — 测试网络上下行速度，支持历史记录图表
- **钥匙串管理** — 查看和管理 macOS 钥匙串中的密码条目
- **系统信息** — 查看硬件信息、CPU/内存使用率、磁盘空间、电池状态
- **启动项管理** — 管理开机启动项和后台项目

### 技术亮点

- **并行扫描优化** — 使用 Rayon 并行计算文件哈希和目录大小，大幅加速扫描
- **虚拟列表渲染** — 长列表采用虚拟化渲染，仅渲染可见项，保持流畅交互
- **权限检查提示** — 自动检测完全磁盘访问权限，缺失时提供引导提示
- **进度可视化** — 圆形进度环 + 步骤指示器 + 扫描速度 + 预计剩余时间
- **深色模式** — 支持浅色/深色主题切换，跟随系统偏好
- **路由懒加载** — 页面按需加载，启动快速

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | Tauri 2.x |
| 前端 | React 19 + TypeScript 5.8 |
| 样式 | Tailwind CSS 4 |
| 路由 | React Router 7 |
| 图标 | Lucide React |
| 后端 | Rust (edition 2021) |
| 异步运行时 | Tokio |
| 文件遍历 | walkdir + rayon |
| 文件操作 | trash crate (移至废纸篓) |
| 系统信息 | sysinfo |
| 测试 | Vitest + Testing Library |

## 快速开始

### 环境要求

- **Node.js** >= 18
- **Rust** >= 1.70 (推荐通过 [rustup](https://rustup.rs/) 安装)
- **macOS** >= 12.0 (Monterey 及以上)

### 安装依赖

```bash
# 安装前端依赖
npm install

# Rust 依赖会在构建时自动安装
```

### 开发模式

```bash
# 启动 Tauri 开发服务器（前端 + 后端热重载）
npm run tauri dev
```

开发服务器启动后：
- 前端运行在 `http://localhost:1420`
- Rust 后端通过 Tauri IPC 与前端通信

### 构建发布

```bash
# 构建 DMG 安装包
npm run tauri build
```

构建产物位于 `src-tauri/target/release/bundle/`。

### 其他命令

```bash
npm run dev          # 仅启动前端开发服务器
npm run build        # 构建前端产物
npm run typecheck    # TypeScript 类型检查
npm run lint         # ESLint 代码检查
npm run test         # 运行单元测试
npm run test:watch   # 测试监听模式
```

本项目基于 [Apache License 2.0](LICENSE) 开源。

## 致谢

- [Tauri](https://tauri.app/) — 跨平台桌面应用框架
- [React](https://react.dev/) — UI 框架
- [Tailwind CSS](https://tailwindcss.com/) — 原子化 CSS 框架
- [walkdir](https://docs.rs/walkdir) — 目录遍历库
- [rayon](https://docs.rs/rayon) — 并行计算库
- [Lucide](https://lucide.dev/) — 图标库

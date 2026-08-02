# 笔记侠 AI 增强内容复盘工具 — Notesman Content Map

## 运行环境

- **Node.js** ≥ 18
- **pnpm**（推荐）或 npm
- **API Key**：DeepSeek 或 Anthropic 兼容的 API key

## 快速启动

```bash
git clone https://github.com/gao666-max/notesman-fde.git
cd notesman-fde

# 配置环境变量
cp .env.example .env.local
# 编辑 .env.local，填入你的 API key

pnpm install
pnpm dev
# 打开 http://localhost:3000
```

## 环境变量（.env.local）

```bash
# DeepSeek（推荐，国内直接访问）
LLM_BASE_URL=https://api.deepseek.com/anthropic
LLM_API_KEY=sk-your-deepseek-key
LLM_MODEL=deepseek-chat

# 或用 Anthropic 官方（需科学上网）
# LLM_BASE_URL=https://api.anthropic.com
# LLM_API_KEY=sk-ant-your-key
# LLM_MODEL=claude-sonnet-4-20250514
```

## 输入文件

| 文件 | 格式 | 说明 |
|------|------|------|
| 访谈逐字稿 | `.srt` | 带说话人和时间戳的 SRT 格式。打开页面后点「导入 SRT」选择文件（面试时由面试官现场提供） |
| 历史笔记 | `.jsonl` | 每行一个 JSON，含 标题/日期/主题/正文/适用读者/可引用范围（面试时由面试官现场提供） |
| 样稿参考 | `.docx` | 笔记侠已发布样稿 3 篇，用于 Agent 3 风格约束（面试时由面试官现场提供） |

## 输出位置

所有输出通过浏览器下载：

| 按钮 | 下载文件 | 内容 |
|------|---------|------|
| 生成全文草稿 | `draft_v0_5.txt` | 600-800字可编辑商业深度文章 |
| 事实核查 | `fact_check_report.txt` | 逐条核查报告+编辑行动建议 |
| 保存大纲 | `outline_backup.json` | 工作区完整状态 |
| 导出大纲 MD | `outline_structure.md` | 结构化大纲 |

## 使用流程

1. 打开页面 → 点「导入 SRT」→ 选择访谈逐字稿文件
2. 等待 Agent 1 分析（约 30-60 秒）→ 四象限和卡片库自动刷新
3. （可选）点「导入历史笔记」→ 选择 `.jsonl` 文件
4. 在左侧卡片库浏览观点 → 拖拽到右侧编辑工作区
5. 点击卡片查看详情弹窗（证据原文/置信度/编辑标注）
6. 点「生成全文草稿」→ 下载文章
7. 点「事实核查」→ 下载核查报告

## 四 Agent 架构

| Agent | API 路由 | 职责 |
|-------|---------|------|
| Agent 1 | POST /api/analyze | 逐字稿 → 结构化观点节点 JSON |
| Agent 2 | POST /api/reuse | 观点 + 历史笔记 → 复用判断 |
| Agent 3 | POST /api/generate | 选定观点 + 大纲 → 600-800字文章 |
| Agent 4 | POST /api/check | 文章 + 观点 → 事实核查报告 |

## 技术栈

Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui · DeepSeek API

## 预置演示数据

默认展示的 13 个观点节点是从素材 `samples/viewpoints.json` 自动生成的（Agent 1 对题目逐字稿的真实输出，与 `lib/mock-data.ts` 同步）。
来源：Agent 1 分析题目提供的 `interview_transcript.srt` 的真实输出结果。

**面试官可以用两种方式验证 AI 管线**：
1. **直接看 samples/**：所有静态交付物（观点/文章/核查报告）都在 `samples/` 目录
2. **导入 SRT 实时跑**：打开前端 → 导入面试官提供的 SRT 文件 → Agent 1-4 真实运行（不导入也可用预置演示数据体验完整流程）

`lib/mock-data.ts` 中的预置数据 = `samples/viewpoints.json` 的数据（同一份，来源于 Agent 1 对题目逐字稿的真实运行）。

## 交付物清单

| 产出 | 位置 | 格式 |
|------|------|------|
| 产出 1：需求澄清 | `docs/requirements_definition.docx` | Word |
| 产出 2：方案设计 | `docs/solution_design.docx` | Word |
| 产出 3：可运行原型 | 本目录（`pnpm dev` 启动）+ `samples/` 下的运行结果 | Next.js + Markdown |
| 产出 4：讲解视频 | `docs/8月2日.mp4` | MP4 |

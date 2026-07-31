# 产出文件说明

## 这个目录是什么

`outputs/` 是题目要求的**静态交付物**。所有文件均基于题目提供的 `interview_transcript.srt` + `historical_notes.jsonl` + `published_samples/` 实际运行生成。

## 与 Next.js 前端原型的关系

| | outputs/（本目录） | Next.js 前端 |
|------|------|------|
| 定位 | 静态交付物，面试官直接阅读 | 可运行原型，面试官亲自操作 |
| 启动 | 不需要，打开文件即看 | `pnpm dev` → http://localhost:3000 |
| AI 管线 | 预运行结果（DeepSeek Chat） | 实时调用 API，导入任意 SRT 重新分析 |
| 数据源 | 同一份 viewpoints.json | 默认加载同一份数据，导入 SRT 后替换 |

**outputs/ 和前端 mock-data.ts 使用的是同一份 viewpoints.json 数据**，通过 `scripts/sync_mock_data.py` 保持同步。

## 文件清单

| 文件 | 格式 | 对应题目要求 |
|------|------|------------|
| `requirements_definition.docx` | Word | 产出 1：需求澄清与问题定义 |
| `solution_design.docx` | Word | 产出 2：方案设计（四 Agent 架构） |
| `agent1_prompt.md` | Markdown | Agent 1 Prompt（可复现） |
| `viewpoints.json` | JSON | Agent 1 输出：13 个结构化观点节点 |
| `angles.md` | Markdown | 3 个切入角度备选 + 推荐理由 |
| `outline.md` | Markdown | 文章结构大纲 |
| `evidence.md` | Markdown | 14 条证据溯源表（含证据强度） |
| `reuse_suggestions.md` | Markdown | 8 篇历史笔记复用判断（含 note_02 陷阱分析） |
| `draft_v0_5.md` | Markdown | 约 800 字可编辑初稿 v0.5 |
| `editorial_checks.md` | Markdown | 6 大类 18 条编辑确认清单（🔴🟡🟢 优先级） |

## 数据来源

- 逐字稿：`data/interview_transcript.srt`（97 段 SRT，约 17KB）
- 历史笔记：`data/historical_notes.jsonl`（8 篇脱敏笔记）
- 样稿：`data/published_samples/`（3 篇 .docx）
- AI 引擎：DeepSeek Chat（通过 Anthropic 兼容协议调用）
- 预运行时间：2026-08-01

## 已实现 / 未实现

### 已实现
- ✅ Agent 1 观点提取+证据溯源+热点匹配（完整 Prompt + 运行结果）
- ✅ Agent 2 历史复用判断（API 已部署，导入 JSONL 即触发）
- ✅ Agent 3 草稿生成（API 已部署，前端点击按钮即触发）
- ✅ Agent 4 事实核查（API 已部署，前端点击按钮即触发）
- ✅ Next.js 交互式前端（四象限 + 抽屉卡片 + 拖拽编辑 + 详情弹窗）
- ✅ 前端导入真实 SRT → 实时重新分析
- ✅ README + .env.example（面试官可一键启动）

### 未实现
- ⬜ RAG 外检管道（方案设计中有，原型中用 LLM 内检替代）
- ⬜ 热点实时爬取（用预定义话题列表 + LLM 语义匹配替代）
- ⬜ 在线协同编辑（静态前端，单用户操作）

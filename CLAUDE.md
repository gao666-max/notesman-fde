# CLAUDE.md — 笔记侠 AI 增强内容复盘工具

## 项目定位

这不是一个泛泛的"AI 写稿工具"。它是专门为笔记侠编辑工作流设计的**内容素材预处理平台**——把访谈逐字稿拆成可拖拽排序的观点卡片，让编辑做判断和取舍，而不是让 AI 替编辑写稿。

核心设计原则：**AI 负责信息处理（提取、匹配、比对），编辑负责价值判断（什么值得写、什么不能写、怎么说才对）。**

## 架构

```
SRT 逐字稿 → Agent 1(观点提取) → Agent 2(复用判断) → [编辑拖拽选择] → Agent 3(草稿生成) → Agent 4(事实核查)
                                          │
                                  数据/hotspots.json   历史笔记 JSONL
```

四个 Agent 不是多 Agent 框架（LangGraph/CrewAI），而是**多步 Prompt 链**——每个模块有独立角色、独立 Prompt、独立输入输出契约、独立故障处理。选择 Prompt 链而非 Agent 框架的原因：输入输出确定性强，可调试性高，48 小时内可控。

## 技术栈

- Next.js 16 + React 19 + TypeScript + Tailwind v4 + shadcn/ui
- DeepSeek Chat（Anthropic SDK 兼容协议）
- 无向量数据库（Agent 2 用关键词相似度引擎 `lib/similarity.ts`）
- 无外部 API 依赖（热点数据在 `data/hotspots.json` 手动维护）

## 关键文件

| 文件 | 职责 |
|------|------|
| `app/api/analyze/route.ts` | Agent 1：SRT → 结构化观点 JSON |
| `app/api/reuse/route.ts` | Agent 2：观点 + 历史笔记 → 复用判断 + 置信度反馈 |
| `app/api/generate/route.ts` | Agent 3：选定观点 + 大纲 → 600-850 字文章 |
| `app/api/check/route.ts` | Agent 4：文章 + 证据 → 事实核查报告 |
| `lib/anthropic.ts` | LLM 调用封装 + extractJSON（多层 fallback） |
| `lib/viewpoint-normalizer.ts` | DeepSeek 字段映射层 |
| `lib/similarity.ts` | 关键词重叠 + 日期新鲜度相似度引擎 |
| `lib/local-generators.ts` | API 不可用时的离线 fallback |
| `lib/mock-data.ts` | 预置演示数据（从 outputs/viewpoints.json 同步） |
| `data/hotspots.json` | 2026 年 6-7 月 AI 行业热点时间线 |

## 已知局限与改进计划

| # | 局限 | 优先级 | 改进方案 | 预计工时 |
|---|------|--------|---------|---------|
| 1 | **零测试**：`extractJSON` 和 `normalizeViewpoints` 无单元测试 | P0 | 准备 20+ 个畸形 JSON 样本（时间范围、未转义引号、尾随逗号、字段缺失），用 vitest 覆盖所有 fallback 路径 | 4h |
| 2 | **Agent 2 相似度**：关键词匹配而非向量化语义搜索 | P1 | 引入 `text-embedding-3-small` 或 `bge-large-zh`，对历史笔记预建向量索引，查询时做余弦相似度检索。方案设计中已有完整架构 | 8h |
| 3 | **Agent 4 外检**：LLM 训练知识交叉验证，非实时网络搜索 | P1 | 搭建 RAG 管道：Embedding → 向量检索（Qdrant/Pinecone）→ Top-K=5 → LLM 判断。方案设计中已有技术路径 | 12h |
| 4 | **因果链提取**：方案设计中规划但未实现 | P1 | 在 Agent 1 输出中增加 `causalChain` 字段（premise/reasoning/conclusion/missingSteps），前端渲染为可折叠的推理链面板 | 6h |
| 5 | **编辑决策理由**：changeLog 记录了"做了什么"但没记录"为什么" | P2 | 在卡片详情弹窗增加"编辑备注"输入框，保存到 `editorNotes` 字段，随大纲一起导出 | 3h |
| 6 | **弱信号**：不可拖拽、无正常置信度字段 | P2 | 给弱信号增加"跟踪/忽略"状态切换，编辑标记为"跟踪"后自动创建带提醒的跟踪卡片 | 4h |
| 7 | **热点数据**：`data/hotspots.json` 手动维护，一个月后会过时 | P2 | 用 GitHub Actions 定时拉取 RSS/新闻 API 更新，或接入 Perplexity API 做实时热点检索 | 4h |

## 踩坑笔记

- DeepSeek JSON 输出不标准（时间范围格式 `"00:10:10 - 00:12:08"`、嵌套引号未转义、尾部截断），必须多层 fallback 解析
- DeepSeek 只在 `evidenceQuotes[*].timestamp` 放时间戳，不在顶层放，normalizer 需从证据引用中推导
- 热点 score 归一化必须做——DeepSeek 返回 0-100，前端按 0-1 展示，不归一化会出现 7500%
- 模板字符串中的 `>` 等字符在 Next.js 编译时会报错，API route 文件用普通字符串拼接
- `v1.0-snapshot` Git tag：运行 `git tag` 可查看。回滚：`git checkout v1.0-snapshot`

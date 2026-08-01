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

### 已完成的

| # | 事项 | 状态 |
|---|------|------|
| 1 | **单元测试**：`extractJSON`、`normalizeViewpoints`、`computeSimilarity`、`adjustConfidence`、`localGenerateDraft`、`localGenerateFactCheck` | ✅ 45 tests, 100% pass (`pnpm test`) |
| 2 | **因果链提取器**：Agent 1 输出 `causalChain` 字段，前端蓝色递进箭头 UI + 琥珀色断点面板 | ✅ |
| 3 | **编辑决策理由**：底部输入框，保存大纲时写入 `changeLog.editorReason` | ✅ |
| 4 | **离线 fallback 对齐**：`localGenerateDraft` 输出瘦初稿格式（核心观点+引用+备注区+待办清单），与 Agent 3 格式一致 | ✅ |

### 待完成（按优先级）

| # | 局限 | 优先级 | 改进方案 | 预计工时 |
|---|------|--------|---------|---------|
| A | **Agent 2 向量化**：关键词匹配在几十篇时可用，笔记侠历史文章多起来后召回率会断崖式下降 | P1 | 引入 `text-embedding-3-small` 或 `bge-large-zh`，对历史笔记预建向量索引，查询时做余弦相似度检索。方案设计中已有完整架构 | 8h |
| B | **Agent 4 RAG 外检**：事实核查全靠 LLM 训练知识做交叉验证，对嘉宾引用的具体研究（如"$12000 降到 $100"）LLM 可能不知道或编造 | P1 | 搭建 RAG 管道：Embedding → 向量检索（Qdrant/Pinecone）→ Top-K=5 → LLM 判断 + 来源链接。方案设计中已有技术路径 | 12h |
| C | **page.tsx 膨胀**（~250 行）：Agent 调用、SRT 解析、状态管理全在一个组件 | P2 | 抽 4 个 custom hooks：`useAgent1`、`useAgent2`、`useAgent3`、`useAgent4`，`page.tsx` 只做组合 | 3h |
| D | **弱信号**：不可拖拽、不可跟踪 | P2 | 增加"跟踪/忽略"状态切换，标记为"跟踪"后创建带提醒的卡片 | 4h |
| E | **热点自动化**：`data/hotspots.json` 手动维护 | P2 | GitHub Actions 定时拉取 RSS/新闻 API 更新 | 4h |

### 演示时如何说明

面试官问"为什么没做向量化/RAG"：**"48 小时内优先跑通核心管线——观点提取、证据溯源、拖拽编辑、草稿生成、事实核查——这五步已经完整闭环。向量化和 RAG 是成熟方案（方案设计文档有完整技术路径），加进去主要是工程时间问题，没有架构风险。如果你给我一周，RAG 外检和向量化匹配会是第一优先级。"**

## 踩坑笔记

- DeepSeek JSON 输出不标准（时间范围格式 `"00:10:10 - 00:12:08"`、嵌套引号未转义、尾部截断），必须多层 fallback 解析
- DeepSeek 只在 `evidenceQuotes[*].timestamp` 放时间戳，不在顶层放，normalizer 需从证据引用中推导
- 热点 score 归一化必须做——DeepSeek 返回 0-100，前端按 0-1 展示，不归一化会出现 7500%
- 模板字符串中的 `>` 等字符在 Next.js 编译时会报错，API route 文件用普通字符串拼接
- `v1.0-snapshot` Git tag：运行 `git tag` 可查看。回滚：`git checkout v1.0-snapshot`

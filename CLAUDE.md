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

Agent 2 是一个关键的架构决策——拆成两阶段 LLM 调用（Phase 1 同一场检测 → Phase 2 语义匹配），同一场检测结果在代码层面硬排除。这样避免了"同一个信号（内容高度匹配）同时触发加分和拒用两个相反动作"的 prompt 工程死结。详见"[踩坑笔记](#踩坑笔记)"第 6 条。

## 技术栈

- Next.js 16 + React 19 + TypeScript + Tailwind v4 + shadcn/ui
- DeepSeek Chat（Anthropic SDK 兼容协议）
- Agent 2 同一场检测：独立 LLM 调用 → 代码层硬排除 → Phase 2 LLM 语义匹配
- Agent 4 事实核查：LLM 训练知识交叉验证 + 三级能力声明（确认/细节存疑/无法判断），不冒充实时检索
- 无向量数据库、无外部 API 依赖（热点数据在 `data/hotspots.json` 手动维护）

## 关键文件

| 文件 | 职责 |
|------|------|
| `app/api/analyze/route.ts` | Agent 1：SRT → 结构化观点 JSON + 因果链 + counterpoint + 弱信号 |
| `app/api/reuse/route.ts` | Agent 2：两阶段 LLM 调用 → 复用判断 + 置信度反馈 |
| `app/api/generate/route.ts` | Agent 3：选定观点 + 大纲 → 瘦初稿骨架 |
| `app/api/check/route.ts` | Agent 4：文章 + 证据 → 三级核查报告 |
| `lib/anthropic.ts` | LLM 调用封装 + extractJSON（多层 fallback） |
| `lib/viewpoint-normalizer.ts` | DeepSeek 字段映射层 |
| `lib/similarity.ts` | 关键词相似度引（Agent 2 已改用 LLM 语义匹配，此模块保留为备选路径和测试覆盖） |
| `lib/local-generators.ts` | API 不可用时的离线 fallback（瘦初稿格式） |
| `lib/mock-data.ts` | 预置演示数据（从 viewpoints.json 同步，Agent 1 真实输出） |
| `data/hotspots.json` | 2026 年 6-7 月 AI 行业热点时间线 |
| `app/page.tsx` | 主页面组件（~440 行，包含 Agent 调用、SRT 解析、状态管理） |

## 当前状态与改进计划

### 已完成的

| # | 事项 | 状态 |
|---|------|------|
| 1 | **单元测试**：`extractJSON`、`normalizeViewpoints`、`computeSimilarity`、`adjustConfidence`、`localGenerateDraft`、`localGenerateFactCheck` | ✅ 45 tests, 100% pass (`pnpm test`) |
| 2 | **因果链提取器**：Agent 1 输出 `causalChain` 字段，前端蓝色递进箭头 UI + 琥珀色断点面板 | ✅ |
| 3 | **编辑决策理由**：底部输入框，保存大纲时写入 `changeLog.editorReason` | ✅ |
| 4 | **离线 fallback 对齐**：`localGenerateDraft` 输出瘦初稿格式（核心观点+引用+备注区+待办清单），与 Agent 3 格式一致 | ✅ |
| 5 | **Agent 2 架构升级**：从关键词匹配改为两阶段 LLM 语义匹配——Phase 1 同一场检测（代码层硬排除）→ Phase 2 语义匹配 | ✅ |
| 6 | **Agent 4 能力声明**：三级核查（确认/细节存疑/无法判断），诚实标注知识边界，不冒充实时检索 | ✅ |

### 待完成（按优先级）

| # | 局限 | 优先级 | 改进方案 | 预计工时 |
|---|------|--------|---------|---------|
| A | **Agent 2 规模化**：当前方案每次调两个 LLM 调用把全文塞入上下文，笔记量 >100 时超出上下文窗口 | P1 | 引入 `text-embedding-3-small` 或 `bge-large-zh`，对历史笔记预建向量索引，初筛候选（Top-20）后再用 LLM 做精细匹配。方案设计中已有完整架构 | 8h |
| B | **Agent 4 RAG 外检**：当前三级核查基于 LLM 训练数据交叉验证。对于"$12000 降到 $100"这类嘉宾引用特定研究的论断，LLM 可能不知道 | P1 | 搭建 RAG 管道：Embedding → 向量检索 → Top-K=5 → LLM 判断 + 来源链接。当前能力声明模式已覆盖诚实性问题，RAG 是补充外检能力的增强方案 | 12h |
| C | **page.tsx 膨胀**（~440 行）：Agent 调用、SRT 解析、状态管理全在一个组件 | P2 | 抽 4 个 custom hooks：`useAgent1`、`useAgent2`、`useAgent3`、`useAgent4`，`page.tsx` 只做组合 | 3h |
| D | **弱信号**：不可拖拽、不可跟踪 | P2 | 增加"跟踪/忽略"状态切换，标记为"跟踪"后创建带提醒的卡片 | 4h |
| E | **热点自动化**：`data/hotspots.json` 手动维护 | P2 | GitHub Actions 定时拉取 RSS/新闻 API 更新 | 4h |
| F | **Agent 2 置信度调整**：Phase 2 目前靠正则从文本报告里抓分数来调整置信度——能跑但不稳健。输出格式变动会导致静默失效 | P2 | Phase 2 要求 LLM 在输出末尾附一段结构化 JSON（仅分数和 ID），与正文分开解析 | 2h |

### 演示时如何说明

面试官问"为什么没做向量化/RAG"：**"48 小时内优先跑通核心管线——观点提取、证据溯源、拖拽编辑、草稿生成、事实核查——这五步已经完整闭环。Agent 2 当前用两阶段 LLM 调用做语义匹配（不是关键词），笔记量少时完全够用。向量化和 RAG 是规模化方案，加进去主要是工程时间问题，没有架构风险。如果你给我一周，这两项是第一优先级。"**

面试官追问同一场检测："Agent 2 之前确实有这个问题——LLM 认出了同一场但还给 95 分判复用。后来我把架构改成两阶段 LLM 调用：Phase 1 只做同一场检测，结果在代码层面硬排除，Phase 2 再对剩余笔记做语义匹配。这样同一个信号不会同时触发加分和拒用两个相反动作"

## 踩坑笔记

1. DeepSeek JSON 输出不标准（时间范围格式 `"00:10:10 - 00:12:08"`、嵌套引号未转义、尾部截断），必须多层 fallback 解析
2. DeepSeek 只在 `evidenceQuotes[*].timestamp` 放时间戳，不在顶层放，normalizer 需从证据引用中推导
3. 热点 score 归一化必须做——DeepSeek 返回 0-100，前端按 0-1 展示，不归一化会出现 7500%
4. 模板字符串中的 `>` 等字符在 Next.js 编译时会报错，API route 文件用普通字符串拼接
5. 中文引号 `""` 在 Turbopack 里导致编译失败——全项目至少改过 4 次。API route 文件只用 ASCII 字符
6. **Agent 2 的同一场矛盾**（最关键的一条）：同一个 LLM 调用里让它既判语义相关性给高分（"内容匹配"）又判同一场给 0 分（"内容匹配但拒用"），LLM 必然 hedging——它认出了同一场但仍给 95 分。根因不是 prompt 不够强，是把两个互斥任务塞进了一个调用。修法是拆成两阶段 LLM 调用，代码层保证排除。**教训：不要靠 prompt 死磕一个内在矛盾的判断——改架构。**
7. `v1.0-snapshot` / `v2.0-snapshot` / `v3.0-snapshot` Git tags 可用。回滚：`git checkout v3.0-snapshot`

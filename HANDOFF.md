# 笔记侠 FDE 项目 — AI 接手提示词

## 项目位置

项目代码在：`C:\Users\TX\Desktop\FDE_outputs\v0_output`
GitHub 仓库：`https://github.com/gao666-max/notesman-fde`（私密）
交付文档在：`C:\Users\TX\Desktop\FDE_outputs\`（outputs 目录，存放产出 1/2/3/4 的文件）

## 每次开机后启动

```bash
cd "C:\Users\TX\Desktop\FDE_outputs\v0_output"
pnpm dev
```
浏览器打开 http://localhost:3000

如果端口被占（打不开）：
```bash
taskkill -F -IM node.exe
cd "C:\Users\TX\Desktop\FDE_outputs\v0_output"
pnpm dev
```

如果 Turbopack 编译错误（通常不是代码问题，是缓存）：
```bash
rm -rf "C:\Users\TX\Desktop\FDE_outputs\v0_output\.next"
taskkill -F -IM node.exe
cd "C:\Users\TX\Desktop\FDE_outputs\v0_output"
pnpm dev
```

运行测试：
```bash
pnpm --dir "C:\Users\TX\Desktop\FDE_outputs\v0_output" test
```

## 这是什么项目

笔记侠 FDE 加速营第二轮面试题。题目要求：做一个"AI 增强内容复盘工具"，把访谈逐字稿拆成观点卡片，编辑拖拽排版后生成文章。

核心设计原则：**AI 负责信息处理（提取、匹配、比对），编辑负责价值判断。**

## 技术栈

- Next.js 16 + React 19 + TypeScript + Tailwind v4 + shadcn/ui
- DeepSeek Chat（通过 Anthropic 兼容 SDK 调用）
- 无向量数据库、无外部 API 依赖
- API key 配置在 `.env.local`（DeepSeek 的 key，不会上传到 GitHub）

## 四 Agent 架构

```
SRT 逐字稿 → Agent 1(观点提取) → Agent 2(复用判断) → [编辑拖拽选择] → Agent 3(草稿生成) → Agent 4(事实核查)
```

| Agent | API 路由 | 做什么 |
|-------|---------|--------|
| Agent 1 | POST /api/analyze | SRT → 15 个观点节点 JSON（含时间戳、置信度、热点匹配、因果链、counterpoint、弱信号） |
| Agent 2 | POST /api/reuse | 两阶段 LLM：Phase 1 检测同一场访谈 → Phase 2 语义匹配历史笔记 |
| Agent 3 | POST /api/generate | 选定观点 + 大纲 → 瘦初稿骨架（核心观点+引用+编辑备注区+待办清单） |
| Agent 4 | POST /api/check | 文章 + 证据 → 三级核查（确认/细节存疑/无法判断） |

## 关键文件

| 文件 | 干什么 |
|------|--------|
| `app/api/analyze/route.ts` | Agent 1——SRT 预处理 + Prompt + 调 DeepSeek |
| `app/api/reuse/route.ts` | Agent 2——两阶段 LLM 同一场检测 + 语义匹配 |
| `app/api/generate/route.ts` | Agent 3——瘦初稿生成 |
| `app/api/check/route.ts` | Agent 4——三级核查 |
| `lib/anthropic.ts` | LLM 调用封装 + extractJSON（多层 fallback 解析） |
| `lib/viewpoint-normalizer.ts` | DeepSeek 字段映射（它返回的字段名不标准） |
| `lib/similarity.ts` | 关键词相似度引擎（Agent 2 已改用 LLM，此模块保留为备选） |
| `lib/local-generators.ts` | API 不可用时的本地离线生成 |
| `lib/mock-data.ts` | 预置演示数据（Agent 1 的真实输出，面试官打开页面就能看到交互） |
| `lib/types.ts` | 所有 TypeScript 类型定义 |
| `data/hotspots.json` | 2026 年 6-7 月 AI 行业热点时间线（手动维护） |
| `app/page.tsx` | 主页面（~440 行，包含所有 Agent 调用逻辑） |
| `components/` | 7 个 React 组件（四象限、卡片库、编辑工作区、详情弹窗等） |
| `CLAUDE.md` | 完整的项目文档——架构、关键文件、已完成事项、踩坑笔记 |

## 前端交互

- **四象限图**：纵轴置信度 × 横轴热点相关性，气泡大小=证据条数，绿色=高置信/黄色=中/红色=低
- **左侧抽屉卡片库**：观点按维度分类（高维思想/当下解答/信息差/弱信号/仅低置信）
- **右侧编辑工作区**：拖拽卡片到章节区域，排序拼接成文章大纲
- **详情弹窗**：点击卡片→证据原文+时间戳+因果链面板+原文上下文面板+反观点
- **底部按钮**：生成全文草稿、事实核查、保存大纲、导出大纲

## 已知踩过的坑（千万不要再犯）

1. **DeepSeek JSON 不标准**：时间格式是 `"00:10:10 - 00:12:08"`（时间范围），不是单个时间戳。不要在 JSON 里用中文引号 `""`——Turbopack 编译直接报错。
2. **DeepSeek 不在顶层放 timestamp**：只在 `evidenceQuotes[*].timestamp` 里放，normalizer 需要从第一份证据引用推导顶层时间戳。
3. **热点 score 必须归一化**：DeepSeek 返回 0-100 的 score，前端展示 0-1，不归一化会出现 "7500% 相关度"。
4. **API route 文件不要用模板字符串放用户提示词**：`>` 等字符在 Next.js 编译时报错。用普通字符串拼接。
5. **Agent 2 不能用单个 prompt 同时判断"同一场"和"语义匹配"**：这是同一个信号触发两个相反动作的矛盾。必须拆成两个 LLM 调用，代码层硬排除。
6. **Git 快照标签**：`v1.0-snapshot`（最早能跑的版本）、`v2.0-snapshot`、`v3.0-snapshot`（当前版本）。回滚：`git checkout v3.0-snapshot`

## 当前状态

**全部完成，只剩录视频。** 45 个单元测试 100% 通过。面试官 clone 下来，配好 `.env.local`，`pnpm install && pnpm dev` 就能跑。

视频脚本在 `docs/video_script.md`，分 5 个段落：看到了什么→设计了什么→Demo 演示→关键取舍→如果有更多时间。

## 用户的信息

- 用户叫佳慧（高佳慧），软件工程本科生，天津
- 正在面试笔记侠 FDE 加速营
- 不擅长纯编码，擅长用 AI 工具辅助开发
- DeepSeek API key 配好了（在 `.env.local`，不提交）
- GitHub：gao666-max
- 沟通风格：直接、口语化，不要大段技术方案轰炸，每步拆成能做完的小任务

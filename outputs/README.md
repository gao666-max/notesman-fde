# 笔记侠 AI 增强内容复盘工具 — 最小可运行原型

## 运行环境
- Claude Code（或任何支持长文本处理的 LLM）
- Python 3.10+（数据处理辅助脚本）

## 文件结构
```
outputs/
├── agent1_prompt.md          # Agent 1（观点提取）完整 Prompt
├── viewpoints.json            # Agent 1 输出：13个结构化观点节点
├── angles.md                  # 3个内容标题/切入角度备选
├── outline.md                 # 文章结构与关键要点
├── reuse_suggestions.md       # 8篇历史笔记复用判断
├── evidence.md               # 14条关键论述的证据溯源表
├── draft_v0_5.md             # 500-800字内容初稿（含时间戳标注）
├── editorial_checks.md       # 编辑人工确认清单（6大类18条）
└── README.md                 # 本文件
```

## 运行方式

### 步骤1：观点提取（Agent 1）
将 `agent1_prompt.md` 作为 System Prompt，把 `interview_transcript.srt` 作为输入，LLM 输出结构化 JSON。
```
在 Claude Code 中：
> 按 agent1_prompt.md 的要求，读取 interview_transcript.srt，
> 输出结构化 viewpoints.json
```

### 步骤2-6：后续处理
每个步骤读上一步的输出文件，按对应 Prompt 处理。
完整 Prompt 链见方案设计文档。

## 已实现范围
- ✅ Agent 1（观点提取+证据溯源+热点匹配）完整 Prompt 及运行结果
- ✅ 13个观点节点，每个附带时间戳证据、置信度标签、编辑标注
- ✅ 3个切入角度 + 推荐理由
- ✅ 文章结构大纲
- ✅ 8篇历史笔记逐一复用判断（含 note_02 陷阱识别）
- ✅ 14条证据溯源表（标注证据强度）
- ✅ 500-800字可编辑初稿 v0.5
- ✅ 6大类18条编辑确认清单

## 尚未实现
- ⬜ Agent 2/3/4 的独立 Prompt 及运行
- ⬜ 前端知识图谱可视化（交互式可拖拽界面）
- ⬜ 热点实时爬取与匹配
- ⬜ 在线协同编辑能力

## 第三方工具与模型
- Claude Code（Anthropic）：Prompt 执行与内容生成
- 本原型所有 Prompt 为原创设计

## 关键取舍
1. 选择多步Prompt链而非多Agent实时编排——48小时内可控性优先
2. 观点节点数量控制在13个而非穷举——质量>数量
3. 热点匹配采用预定义话题列表而非实时爬取——可复现性优先
4. note_02 明确标注为"同一场/不复用"——展示了复用判断能力

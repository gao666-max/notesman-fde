# 产出文件说明

## 目录结构

```
├── docs/              ← 题目交付文档
│   ├── requirements_definition.md  产出1：需求澄清
│   ├── requirements_definition.docx
│   ├── solution_design.md          产出2：方案设计
│   ├── solution_design.docx
│   ├── video_script.md             产出4：视频脚本
│   └── compliance_checklist.md     题目要求符合度自评
│
├── samples/           ← AI 管线运行结果样本
│   ├── viewpoints.json        Agent 1 输出：13 个观点节点
│   ├── agent1_prompt.md       Agent 1 完整 Prompt
│   ├── angles.md              3 个切入角度
│   ├── outline.md             文章结构大纲
│   ├── evidence.md            14 条证据溯源表
│   ├── reuse_suggestions.md   8 篇历史笔记复用判断
│   ├── draft_v0_5.md          约 800 字可编辑初稿
│   └── editorial_checks.md    6 大类 18 条编辑确认清单
│
└── outputs/           ← 本文件（目录说明）
    └── README.md
```

## 面试官快速索引

| 交付物 | 在哪里 |
|--------|--------|
| 产出 1：需求澄清 | `docs/requirements_definition.docx` |
| 产出 2：方案设计 | `docs/solution_design.docx` |
| 产出 3：可运行原型 | 根目录 `pnpm dev` 启动 + `samples/` 下的运行结果 |
| 产出 4：讲解视频 | 待录制（脚本在 `docs/video_script.md`） |

## 数据来源

- 逐字稿：题目材料包提供的 `interview_transcript.srt`（97 段 SRT，面试时由面试官现场提供导入）
- 历史笔记：题目材料包提供的 `historical_notes.jsonl`（8 篇脱敏笔记，面试时由面试官现场提供导入）
- 样稿：题目材料包 `published_samples/`（3 篇 .docx，用于 Agent 3 风格约束）
- AI 引擎：DeepSeek Chat（Anthropic 兼容协议）
- 预运行时间：2026-08-01

## LLM 非确定性说明

`samples/` 里的静态交付物和前端实时导入 SRT 后跑出来的结果不完全一样——Agent 1 对同一份 SRT 的两次运行在观点选择和措辞上会有差异。这不是 bug，是 LLM 本身的特性。更重要的是，**这证明了编辑判断不可替代**：如果同一个工具输出两次不同结果，"最终采用哪个观点、以什么顺序呈现、哪些证据需要核实"这些判断就必须由人来完成。

面试中想验证：导入 SRT → 记录第一组观点 → 点"重新分析" → 对比差异。

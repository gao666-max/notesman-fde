# 架构图 · Notesman Content Map

## 数据流

```mermaid
flowchart LR
    A[访谈逐字稿 .srt] --> B[Agent 1<br/>观点提取]
    H[历史笔记 .jsonl] --> C[Agent 2<br/>复用判断]
    B --> C
    C --> D[编辑拖拽选择<br/>人工判断]
    D --> E[Agent 3<br/>草稿生成]
    E --> F[Agent 4<br/>事实核查]
    F --> G[最终文章<br/>+ 核查报告]
    X[样稿 .docx] --> E
    Y[热点时间线<br/>hotspots.json] --> B
```

## 四 Agent 职责与契约

```mermaid
flowchart TD
    subgraph AG1[Agent 1 观点提取]
        A1[输入: SRT 逐字稿] --> A2[输出: 15 个观点节点 JSON<br/>含时间戳/置信度/因果链/counterpoint/弱信号]
    end
    subgraph AG2[Agent 2 复用判断]
        B1[输入: 观点 + 历史笔记] --> B2[Phase 1 同一场检测<br/>代码层硬排除]
        B2 --> B3[Phase 2 语义匹配<br/>LLM]
        B3 --> B4[输出: 复用建议 + 置信度]
    end
    subgraph AG3[Agent 3 草稿生成]
        C1[输入: 选定观点 + 大纲 + 样稿] --> C2[输出: 600-800字瘦初稿骨架]
    end
    subgraph AG4[Agent 4 事实核查]
        D1[输入: 文章 + 证据] --> D2[三级核查<br/>确认/存疑/无法判断]
    end
    AG1 --> AG2 --> AG3 --> AG4
```

## 技术决策：为什么用 Prompt 链而非 Agent 框架

```mermaid
flowchart TD
    Q[多步 AI 处理流程] --> P1{选型}
    P1 -->|方案A| M[多 Agent 框架<br/>LangGraph/CrewAI]
    P1 -->|方案B| PC[多步 Prompt 链<br/>每模块独立角色/契约/故障处理]
    PC --> R1[输入输出确定性强]
    PC --> R2[可调试性高]
    PC --> R3[48小时可控]
    M --> R4[更灵活但不可控]
    R1 & R2 & R3 --> WIN[✅ 选择 Prompt 链]
```

## 关键架构决策

| 决策 | 原因 | 位置 |
|------|------|------|
| Agent 2 拆两阶段 | 同一场检测和语义匹配是互斥任务，塞一个调用会 hedging | `app/api/reuse/route.ts` |
| 多层 JSON fallback | DeepSeek 输出不标准（时间范围/嵌套引号/截断） | `lib/anthropic.ts` |
| 离线 fallback | API 不可用时不阻塞演示 | `lib/local-generators.ts` |
| 预置演示数据 | 面试官打开即看交互，不需现场配 API | `lib/mock-data.ts` |

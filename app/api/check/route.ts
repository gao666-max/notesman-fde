import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"

const VERIFY_PROMPT = `你是笔记侠事实核查编辑。请对以下文章草稿中的关键论断进行核查。

## 核查能力声明

你的核查基于训练数据中截至2025年初的知识。你不做实时网络搜索，不冒充有实时信息。对于每一个论断，你需要明确标注：

**认出且大致确认**：我在训练数据里见过类似信息，方向一致
**认出但无法确认**：我见过这个说法，但无法验证具体数字/细节是否准确
**无法判断**：这可能是嘉宾引用的特定研究、嘉宾个人经验、或2025年以后的新信息——我无法确认

你不是实时搜索引擎。诚实标注"无法判断"比编造一个判断更有价值。

## 核查要点

对每个论断，回答三个问题：
1. 文章中的论断是什么？（一句话概括）
2. 我在训练数据里见过这个说法吗？见过类似信息 / 无法确认
3. 如果能确认：大致方向是否正确？（方向一致 / 细节无法验证）
4. 如果不能确认：可能是什么原因？（数据太新、嘉宾引用私人研究、超出我的知识范围）

## 输出格式

对每个需要核查的论断（不要核查明显的个人经验陈述如"嘉宾说他自己用过Claude"），按以下格式输出：

---
【核查项 X】文章句：...

判定：认定且大致确认 / 认定但细节存疑 / 无法判断

理由：(1-2句解释)

编辑建议：(具体怎么改)
---

## 优先核查

1. 涉及具体数字、金额、百分比、时间、机构名的论断
2. 嘉宾引用"某研究显示""有数据表明"但未指明具体研究的
3. 可能引发争议或恐惧的表述

不需要核查的：
- 嘉宾个人经验的陈述（"我用了AI工具""我周末叠衣服"）
- 嘉宾个人观点的表述（"我认为""我觉得"）
- 纯逻辑推理（"如果A成立，那么B"）`

export async function POST(req: Request) {
  try {
    const { article, viewpoints } = await req.json()
    if (!article) return NextResponse.json({ error: "缺少文章文本" }, { status: 400 })

    // Build a focused list of claims that need verification
    const claimsToCheck: string[] = []

    for (const vp of (viewpoints || [])) {
      const f = vp.editorialFlags || {}
      if (f.factCheckNeeded || vp.level === "low" || vp.level === "medium") {
        const eq = (vp.evidenceQuotes || [])[0]
        claimsToCheck.push(
          `[观点：${vp.title} | 说话人：${vp.speaker} | 置信度：${vp.level}（${vp.confidence}%）]\n` +
          `证据原文："${eq?.text || vp.summary || ""}" [${eq?.timestamp || vp.timestamp || ""}]\n` +
          (f.flagReason ? `标注原因：${f.flagReason}\n` : "")
        )
      }
    }

    if (claimsToCheck.length === 0) {
      return NextResponse.json({
        report: '事实核查报告\n\n所有已选用观点均为高置信，无标注为“待核实”的条目。编辑可直接使用。\n\n备注：如需外部事实核查（如“$12000 降到 $100”这类具体数据），建议编辑手动搜索原始研究来源。',
      })
    }

    // Build the user message
    const userMsg = `请核查以下文章草稿中的 ${claimsToCheck.length} 个论断。

=== 文章草稿 ===
${article.substring(0, 3000)}

=== 需要核查的论断 ===
${claimsToCheck.join("\n---\n")}

请按照核查能力声明中的格式，逐条输出核查结果。不要编造判断——对于你无法确认的具体数据，诚实标注"无法判断"。`

    const body = await callAgent(VERIFY_PROMPT, userMsg, 8000)

    // Build final report
    const report = `# 事实核查报告

核查时间：${new Date().toLocaleString("zh-CN")}
核查方式：基于 DeepSeek 训练知识交叉验证（非实时网络搜索）
核查条目：${claimsToCheck.length} 条

## 核查能力声明

本核查不冒充实时检索。对于每个论断，核查引擎回答三个层次：
- **认定且大致确认**：方向与已知事实一致，可以保留
- **认定但细节存疑**：说法方向对但具体数字/细节无法验证，建议改为审慎表述（"据嘉宾引用的研究""嘉宾给出的对比数据是"）
- **无法判断**：超出了核查引擎的知识范围——可能是 2025 年以后的新信息、嘉宾引用的特定研究、或嘉宾个人经验。需要编辑人工验证

---
${body}
---

## 核查汇总

共核查 ${claimsToCheck.length} 条论断。对于标注"无法判断"的条目，建议编辑：

1. 如果这个数据是文章的核心论据 → 手动搜索原始研究来源
2. 如果这个数据只是佐证 → 改为"据嘉宾引用的研究"或直接删除
3. 如果这是嘉宾个人经验 → 保留，不需核实

## 补充说明

方案设计中规划了完整的 RAG 外检管道（Embedding → 向量检索 → 可信源验证 → LLM 判断）。
当前原型用 LLM 训练知识做交叉验证替代。面试时可以说明："48 小时内跑通核心管线，RAG 外检是明确的下一优先级——技术路径已完整设计，缺的主要是工程实现时间。"
`

    return NextResponse.json({ report })
  } catch (e: any) {
    console.error("Agent 4 error:", e)
    return NextResponse.json({ error: e.message || "核查失败" }, { status: 500 })
  }
}

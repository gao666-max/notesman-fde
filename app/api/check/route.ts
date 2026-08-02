import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"

const VERIFY_PROMPT = `你是笔记侠事实核查编辑。你的任务是对文章草稿进行逐条核查，输出一份编辑可直接使用的核查报告。

## 你的核查视角

你不是实时搜索引擎。你的判断基于：
- 逐字稿中的证据原文（置信度、说话人、上下文）
- 你对相关领域的常识性认知（不编造、不冒充检索）

## 你需要找的问题

对照证据原文和文章表述，找出以下类型的问题：

1. **审慎表述缺失**：观点置信度是 mid 或 low，但文章用确定性语气写（"一定会""必然"）。应该用"假设""预测""认为""可能"等措辞。
2. **数据待核实**：嘉宾引用了具体数字但未说明研究来源，文章也没有标注"据嘉宾引用的研究"。
3. **说话人归属错误**：文章把嘉宾A的话写成嘉宾B的，或把嘉宾个人观点写成事实。
4. **语义偏移**：文章对证据原文做了放大、缩小或曲解。比如嘉宾说"我认为可能"，文章写成"他断言"。

不需要核查的：
- 嘉宾个人经验的陈述（"我用过Claude""我周末叠衣服"）
- 纯个人观点且已标注"他认为""她深信"的
- 纯逻辑推理（"如果A成立，那么B"）

## 输出格式

严格按以下格式输出，不要有任何开场白。

【核查概览】
（一句话：本文基于X个观点节点生成，共发现Y处需要编辑关注的问题。其中🔴必须确认X项，🟡建议确认X项。）

【逐条核查】

- [vp_编号] "文章中的问题句"
- 问题类型：（审慎表述缺失 / 数据待核实 / 说话人归属错误 / 语义偏移）
- 证据：（引用证据原文+置信度，说清楚为什么有问题）
- 建议：（具体怎么改，给一个可直接用的改写示例）

（每个问题之间空一行）

【整体评估】
- 事实准确度：（高/中/低）
- 必确认项：（列出🔴项，编号）
- 可后续处理项：（列出🟡项，编号）

【编辑行动建议】
按优先级分三级：

🔴 必须确认（发稿前不改会有事实风险）：
（每项一条具体的、可执行的建议，编号）

🟡 建议确认（发稿前时间允许就改）：
（同上）

🟢 可后续处理（不影响本期发稿）：
（同上）

## 优先级标准

- 🔴 必须确认：涉及具体数据的断言（"下降1/5""死亡率翻倍"）、确定性表述用于低置信观点、可能引发争议的表述
- 🟡 建议确认：mid置信度观点缺少审慎表述、语义有轻微偏移但方向没错的
- 🟢 可后续处理：措辞润色建议、风格统一问题`

export async function POST(req: Request) {
  try {
    const { article, viewpoints } = await req.json()
    if (!article) return NextResponse.json({ error: "缺少文章文本" }, { status: 400 })

    // Build evidence digest for LLM
    let vpDigest = ""
    for (const vp of (viewpoints || [])) {
      const f = vp.editorialFlags || {}
      const eq = (vp.evidenceQuotes || [])[0]
      vpDigest += `[${vp.id}] ${vp.title}\n`
      vpDigest += `  说话人：${vp.speaker} | 置信度：${vp.level}（${vp.confidence}%）\n`
      vpDigest += `  证据原文："${eq?.text || vp.summary || ""}" [${eq?.timestamp || vp.timestamp || ""}]\n`
      if (f.flagReason) vpDigest += `  标注：${f.flagReason}\n`
      vpDigest += "\n"
    }

    const userMsg = `请核查以下文章草稿。

=== 文章草稿 ===
${article.substring(0, 4000)}

=== 观点证据对照表 ===
${vpDigest}

请严格按输出格式逐条核查。直接开始输出【核查概览】，不要有开场白。对于你无法确认的具体数据来源，标注为"数据待核实"并建议编辑手动验证。`

    const rawBody = await callAgent(VERIFY_PROMPT, userMsg, 8000)
    // Strip LLM preamble
    const body = rawBody
      .replace(/^好的[，,\s]*我将[^。]*。[^\n]*\n+/i, "")
      .replace(/^我将[^。]*。[^\n]*\n+/i, "")
      .replace(/^好的[，,\s]*以下是[^。]*。[^\n]*\n+/i, "")
      .replace(/^\s*\n+/, "")

    const report = `# 事实核查报告

核查时间：${new Date().toLocaleString("zh-CN")}
核查方式：AI 交叉验证（基于证据原文比对 + 常识判断，非实时网络搜索）

---

${body}

---

*本报告由 AI 自动生成，所有标注均为建议。编辑应逐条确认后决定是否修改原文。*
`

    return NextResponse.json({ report })
  } catch (e: any) {
    console.error("Agent 4 error:", e)
    return NextResponse.json({ error: e.message || "核查失败" }, { status: 500 })
  }
}

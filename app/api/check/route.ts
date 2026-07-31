import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"

const VERIFY_SYSTEM = `你是笔记侠事实核查编辑。你会收到一篇文章草稿和观点证据数据，逐条核查。

## 核查清单（每条必须覆盖）

1. **数据论断**：文章中出现的具体数字、金额、百分比、时间、机构名——是否有证据支撑？证据来自嘉宾还是嘉宾引用的外部研究？
2. **置信度交叉检查**：所有低置信和中置信度的观点节点，在文章中的表述是否做了审慎处理（"据嘉宾引用的研究""嘉宾提出一个假设"等），还是写成了确定事实？
3. **说话人归属**：文章中的引用和归因是否正确？
4. **缺失检查**：编辑大纲中选定的观点节点，有没有在文章中被遗漏？
5. **表述风险**：有没有可能引发争议、恐惧或误解的表述？

## 输出格式（纯文本）

【核查概览】
本文基于X个观点节点生成，共发现Y处需要编辑关注的问题。其中🔴必须确认Z项，🟡建议确认W项。

【逐条核查】
对每个问题：
- [观点编号] [文章相关句子的前10字]
- 问题类型：数据待核实/审慎表述缺失/说话人错误/观点遗漏/表述风险
- 证据：原始数据中的对应内容
- 建议：具体怎么修

【整体评估】
- 事实准确度：高/中/低
- 必确认项：列出
- 可后续处理项：列出

【编辑行动建议】
按优先级（🔴🟡🟢）列出每项应该怎么改。`

export async function POST(req: Request) {
  try {
    const { article, viewpoints } = await req.json()
    if (!article) return NextResponse.json({ error: "缺少文章文本" }, { status: 400 })

    // Build comprehensive evidence context
    let evidenceCtx = "## 观点证据数据\n\n"
    const flaggedVps: any[] = []
    for (const vp of (viewpoints || [])) {
      evidenceCtx += `[${vp.id}] ${vp.title}\n`
      evidenceCtx += `说话人：${vp.speaker} | 置信度：${vp.level}（${vp.confidence}%）\n`
      evidenceCtx += `摘要：${vp.summary}\n`
      for (const eq of (vp.evidenceQuotes || [])) {
        evidenceCtx += `证据：[${eq.speaker} ${eq.timestamp}] "${eq.text}"\n`
      }
      const f = vp.editorialFlags || {}
      if (f.factCheckNeeded) {
        evidenceCtx += `⚠ 需事实核查：${f.flagReason}\n`
        flaggedVps.push(vp)
      }
      if (f.needsHumanJudgment) {
        evidenceCtx += `⚠ 需编辑判断：${f.flagReason}\n`
        if (!flaggedVps.includes(vp)) flaggedVps.push(vp)
      }
      if (f.sensitiveContent) evidenceCtx += `⚡ 含敏感内容：${f.flagReason}\n`
      if (vp.level === "low" || vp.level === "mid") {
        if (!flaggedVps.includes(vp)) flaggedVps.push(vp)
        evidenceCtx += `注意：此观点置信度为${vp.confidence}%，应在文章中用审慎表述\n`
      }
      evidenceCtx += `\n`
    }

    // Prioritize: put flagged viewpoints first
    const priorityNote = flaggedVps.length > 0
      ? `特别提醒：以下${flaggedVps.length}个观点节点标注了需核查，请重点检查文章中对这些观点的表述：\n${flaggedVps.map((v: any) => `- ${v.id} ${v.title}`).join('\n')}\n\n`
      : ""

    const userMsg = `请核查以下文章：\n\n=== 文章 ===\n${article}\n\n=== 证据数据 ===\n${priorityNote}${evidenceCtx}\n\n请逐条核查，确保覆盖所有标注了"需事实核查""需编辑判断"和置信度低于high的观点节点。`

    const report = await callAgent(VERIFY_SYSTEM, userMsg, 8000)

    return NextResponse.json({ report })
  } catch (e: any) {
    console.error("Agent 4 error:", e)
    return NextResponse.json({ error: e.message || "核查失败" }, { status: 500 })
  }
}

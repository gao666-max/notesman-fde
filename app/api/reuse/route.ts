import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"

export async function POST(req: Request) {
  try {
    const { viewpoints, notes } = await req.json()
    if (!viewpoints) return NextResponse.json({ error: "缺少数据" }, { status: 400 })

    const notesArray: any[] = Array.isArray(notes) ? notes : []

    if (notesArray.length === 0) {
      return NextResponse.json({
        report: "无历史笔记数据，跳过复用判断。",
        confidenceAdjustments: {},
      })
    }

    // ══════ Phase 1: Same-field detection ══════
    // LLM only answers one question: which notes are from the same interview?
    // Output is a simple list of note indices — no scores, no hedging.
    const noteDigests = notesArray.map((n: any, i: number) => {
      const title = n.标题 || n.title || `笔记${i + 1}`
      const body = (n.正文 || n.body || "").substring(0, 800)
      return `[笔记${i + 1}] ${title}\n${body.substring(0, 500)}`
    }).join("\n\n---\n\n")

    const detectPrompt = `以下是当前访谈逐字稿和 ${notesArray.length} 篇历史笔记。

你的任务只有一个：找出哪些历史笔记和当前逐字稿是同一场访谈。

判断标准：笔记内容和当前逐字稿讨论的是同一场对话——嘉宾相同、话题相同、原文几乎逐句对应。如果只是主题相似但嘉宾不同、或对话完全不同，就不是同一场。

输出格式：只输出笔记编号，用逗号分隔。如果一篇都不是同一场，输出"无"。

笔记编号示例：1,3（表示笔记1和笔记3是同一场访谈）`

    let sameFieldIds = new Set<number>()
    try {
      const detectionResult = await callAgent(
        detectPrompt,
        `当前访谈：AI、工作方式变化与个体能动性的深度对话\n\n历史笔记：\n${noteDigests}`,
        2000
      )
      const numbers = detectionResult.match(/\d+/g)
      if (numbers) {
        for (const n of numbers) {
          const idx = parseInt(n)
          if (idx >= 1 && idx <= notesArray.length) sameFieldIds.add(idx)
        }
      }
    } catch (e: any) {
      console.error("Phase 1 detection failed:", e.message)
    }

    // ══════ Phase 2: Semantic matching (same-field notes EXCLUDED) ══════
    const excludedLabels = sameFieldIds.size > 0
      ? Array.from(sameFieldIds).map(i => `笔记${i}`).join("、")
      : "无"

    const vpList = (viewpoints || []).map((v: any) =>
      `[${v.id}] ${v.title}\n  摘要：${v.summary || ""}\n  说话人：${v.speaker || ""}\n  关键词：${(v.keywords || []).join("、")}`
    ).join("\n\n")

    const remainingNotes = notesArray.map((n: any, i: number) => {
      const idx = i + 1
      if (sameFieldIds.has(idx)) return null
      const title = n.标题 || n.title || `笔记${idx}`
      const date = n.日期 || n.date || ""
      const topic = n.主题 || n.topic || ""
      const body = (n.正文 || n.body || "").substring(0, 500)
      const readers = n.适用读者 || n.readers || ""
      const scope = n.可引用范围 || n.quoteScope || ""
      return `[笔记${idx}] 标题：${title}\n  日期：${date}\n  主题：${topic}\n  适用读者：${readers}\n  可引用范围：${scope}\n  正文摘要：${body}`
    }).filter(Boolean).join("\n\n")

    const matchPrompt = `你是笔记侠资料编辑。

关键前提：以下笔记已被代码层面排除（同一场访谈）：${excludedLabels}。你不要再匹配这些笔记。

## 任务
对每个观点，从剩余的 ${notesArray.length - sameFieldIds.size} 篇笔记中找最相关的 0-3 篇。

## 判断维度
1. 语义相关性：笔记核心论述和当前观点在说同一件事吗？
2. 观点增强/矛盾：笔记能补充、强化、或反驳当前观点吗？
3. 时效性：日期过时了吗？（2023年以前 → 仅背景参考）
4. 可引用性：引用范围允许吗？

## 输出规则
直接开始输出匹配结果，不要有任何开场白、问候语或自我介绍。不要说"好的""我将作为"这类话。第一个字符就应该是"观点 vp_"。

## 输出格式（每个观点单独一段）
观点 vp_01 【标题】
  笔记3（82分·明确复用）：理由...
  笔记5（65分·有限复用）：理由...
  无显著匹配的话写"无显著匹配"

## 观点列表
${vpList}

## 剩余历史笔记
${remainingNotes || "（无）"}

请逐观点分析。`

    let matchReport = ""
    try {
      const rawReport = await callAgent(matchPrompt, "", 8000)
      // Strip LLM preamble
      matchReport = rawReport
        .replace(/^好的[，,\s]*我将[^。]*。[^\n]*\n+/i, "")
        .replace(/^我将[^。]*。[^\n]*\n+/i, "")
        .replace(/^好的[，,\s]*以下是[^。]*。[^\n]*\n+/i, "")
        .replace(/^\s*\n+/, "")
    } catch (e: any) {
      matchReport = "（AI 判断暂时不可用）"
    }

    // ══════ Phase 3: Build report ══════
    let report = "# 历史素材复用判断报告\n\n"

    report += "## Phase 1: 同一场检测\n\n"
    if (sameFieldIds.size > 0) {
      for (const idx of sameFieldIds) {
        const n = notesArray[idx - 1]
        const title = n?.标题 || n?.title || `笔记${idx}`
        report += `- 笔记${idx}：「${title}」 → 同一场·不复用。已从 Phase 2 匹配中排除。\n`
      }
    } else {
      report += "- 未检测到同一场访谈的历史笔记。\n"
    }

    report += "\n## Phase 2: 语义匹配（已排除同一场笔记）\n\n"
    report += "匹配方式：AI 语义理解（非简单关键词匹配），逐篇阅读笔记内容后判断相关性。\n\n"
    report += "---\n\n"
    report += "## 逐观点匹配\n\n"
    report += matchReport
    report += "\n\n---\n\n"
    report += "## 说明\n\n"
    report += "- 同一场检测已自动完成——系统先判断哪些笔记和当前逐字稿是同一场访谈，这些笔记不会出现在下方匹配结果中\n"
    report += '- "有限复用"的笔记可作为概念佐证或风格参考，不应直接拼接原文\n'
    report += '- 标注"过时"的笔记仅限背景参考\n'

    // Confidence adjustments — only from Phase 2 matches (non-same-field)
    const confidenceAdjustments: Record<string, number> = {}
    for (const vp of (viewpoints || [])) {
      const escapedId = vp.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const section = matchReport.match(new RegExp(`观点\\s*${escapedId}\\s*【`))
      if (section) {
        const scores = [...matchReport.matchAll(new RegExp(`（(\\d+)分`, 'g'))].map(m => parseInt(m[1]))
        if (scores.length > 0) {
          const maxScore = Math.max(...scores)
          if (maxScore >= 80) {
            confidenceAdjustments[vp.id] = Math.min(95, (vp.confidence || 70) + 5)
          } else if (maxScore >= 65) {
            confidenceAdjustments[vp.id] = Math.min(95, (vp.confidence || 70) + 2)
          }
        }
      }
    }

    return NextResponse.json({
      report,
      confidenceAdjustments,
    })
  } catch (e: any) {
    console.error("Agent 2 error:", e)
    return NextResponse.json({ error: e.message || "复用判断失败" }, { status: 500 })
  }
}

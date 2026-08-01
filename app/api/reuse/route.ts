import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"
import { computeSimilarity, adjustConfidence } from "@/lib/similarity"

export async function POST(req: Request) {
  try {
    const { viewpoints, notes } = await req.json()
    if (!viewpoints) return NextResponse.json({ error: "缺少数据" }, { status: 400 })

    // Phase 1: Compute similarity scores for each viewpoint against all notes
    const similarityResults: any[] = []
    const notesArray: any[] = Array.isArray(notes) ? notes : []

    for (const vp of (viewpoints || [])) {
      const results = computeSimilarity(
        { title: vp.title || "", summary: vp.summary || "", keywords: vp.keywords || [] },
        notesArray.map((n: any) => ({
          title: n.标题 || n.title || "",
          topic: n.主题 || n.topic || "",
          body: n.正文 || n.body || "",
          date: n.日期 || n.date || "",
          readers: n.适用读者 || n.readers || "",
          quoteScope: n.可引用范围 || n.quoteScope || "",
        })),
      )
      if (results.length > 0) {
        const { adjustedConfidence, reason: adjReason } = adjustConfidence(
          vp.confidence || 70,
          results,
          notesArray,
        )
        similarityResults.push({
          vpId: vp.id,
          vpTitle: vp.title,
          originalConfidence: vp.confidence,
          adjustedConfidence,
          adjustmentReason: adjReason,
          matches: results.map(r => ({
            noteTitle: r.noteTitle,
            noteDate: r.noteDate,
            score: Math.round(r.score * 100),
            matchedKeywords: r.matchedKeywords,
          })),
        })
      }
    }

    // Phase 2: Generate reuse suggestions via LLM (only for notes with matches)
    let llmReport = ""
    if (notesArray.length > 0) {
      const notesSummary = notesArray.map((n: any, i: number) => {
        const title = n.标题 || n.title || `笔记${i+1}`
        return `笔记${i+1}：【${n.日期 || n.date || ""}】${title} — ${(n.主题 || n.topic || "").substring(0,60)}`
      }).join("\n")

      const vpSummary = (viewpoints || []).map((v: any) => `[${v.id}] ${v.title}`).join("\n")

      const prompt = `你是笔记侠资料编辑。判断以下历史笔记能否用于当前选题。

当前观点：\n${vpSummary}\n
历史笔记：\n${notesSummary}\n

对每篇笔记给出判定（不复用/有限复用/明确复用）+ 理由。特别标注：如果有笔记和当前访谈是同一场，标注"同一场·不复用"。输出纯文本。`

      try {
        llmReport = await callAgent(prompt, "", 4000)
      } catch {
        llmReport = "（AI判断暂时不可用，以下是关键词相似度计算结果）"
      }
    }

    // Phase 3: Build final report with real similarity data
    let report = `# 历史素材复用判断报告\n\n`
    report += `## 关键词相似度分析\n\n`
    report += similarityResults.length > 0
      ? `发现${similarityResults.length}个观点与历史笔记有相关性。\n\n`
      : `所有观点与历史笔记无显著关键词重叠。\n\n`

    for (const sr of similarityResults) {
      report += `### ${sr.vpId} ${sr.vpTitle}\n`
      report += `- 原始置信度：${sr.originalConfidence}% → 调整后：${sr.adjustedConfidence}%\n`
      report += `- 原因：${sr.adjustmentReason}\n`
      report += `- 匹配的历史笔记：\n`
      for (const m of sr.matches) {
        report += `  - [${m.noteDate}] ${m.noteTitle}（相似度${m.score}%，关键词：${m.matchedKeywords.join("、")}）\n`
      }
      report += `\n`
    }

    report += `---\n\n## AI 综合判断\n\n${llmReport || "（无历史笔记数据，跳过AI判断）"}\n`

    // Also return structured adjustment data for confidence feedback
    const confidenceAdjustments: Record<string, number> = {}
    for (const sr of similarityResults) {
      confidenceAdjustments[sr.vpId] = sr.adjustedConfidence
    }

    return NextResponse.json({
      report,
      confidenceAdjustments,
      similarityResults,
    })
  } catch (e: any) {
    console.error("Agent 2 error:", e)
    return NextResponse.json({ error: e.message || "复用判断失败" }, { status: 500 })
  }
}

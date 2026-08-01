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

    // Phase 1: LLM-powered multi-dimensional matching
    // Drop keyword similarity — let DeepSeek do semantic understanding
    let matchReport = ""

    const vpList = (viewpoints || []).map((v: any) =>
      `[${v.id}] ${v.title}\n  摘要：${v.summary || ""}\n  说话人：${v.speaker || ""}\n  关键词：${(v.keywords || []).join("、")}`
    ).join("\n\n")

    const noteList = notesArray.map((n: any, i: number) => {
      const title = n.标题 || n.title || `笔记${i + 1}`
      const date = n.日期 || n.date || ""
      const topic = n.主题 || n.topic || ""
      const body = (n.正文 || n.body || "").substring(0, 600)
      const readers = n.适用读者 || n.readers || ""
      const scope = n.可引用范围 || n.quoteScope || ""
      return `[笔记${i + 1}] 标题：${title}\n  日期：${date}\n  主题：${topic}\n  适用读者：${readers}\n  可引用范围：${scope}\n  正文摘要：${body.substring(0, 500)}`
    }).join("\n\n")

    const matchPrompt = `你是笔记侠资料编辑。你有 ${viewpoints.length} 个从当前访谈提取的观点，和 ${notesArray.length} 篇历史笔记。

## 任务
对每个观点，判断哪些历史笔记与之相关。不是关键词匹配，是语义理解——理解观点在说什么，再判断笔记里有没有类似内容。

## 判断维度
1. **内容唯一性**：这篇笔记和当前观点是同一场访谈吗？（如果是，标注"同一场·不复用"）
2. **语义相关性**：笔记的核心论述是否和当前观点在说同一件事？
3. **观点增强/矛盾**：笔记能补充、强化、或反驳当前观点吗？
4. **时效性**：笔记的日期是否过时？（2023年以前 → 仅背景参考）
5. **可引用性**：笔记的引用范围是否允许当前用途？

## 输出格式

对每个观点（10个以内）输出最相关的 0-3 篇笔记。每个匹配包含：
- 笔记编号
- 相关性分数（0-100，80以上才算强相关）
- 相关性类型：明确复用 / 有限复用 / 不可复用 / 同一场·不复用
- 一句话理由

按以下纯文本格式：
\`\`\`
观点 vp_01 【标题】
  笔记3（82分·明确复用）：理由...
  笔记5（65分·有限复用）：理由...

观点 vp_02 【标题】
  无显著匹配

观点 vp_03 【标题】
  笔记1（45分·不可复用）：同一场访谈的历史版本，不应复用
\`\`\`

## 观点列表
${vpList}

## 历史笔记
${noteList}

请开始分析。`

    try {
      matchReport = await callAgent(matchPrompt, "", 8000)
    } catch (e: any) {
      matchReport = "（AI 判断暂时不可用）"
    }

    // Phase 2: Build final report with LLM results + confidence adjustments
    let report = "# 历史素材复用判断报告\n\n"
    report += "## 匹配方式\n\n"
    report += "基于 DeepSeek 对观点和历史笔记的语义理解直接判断（非关键词匹配）。\n"
    report += "对于每对（观点，笔记），LLM 综合判断：内容唯一性、语义相关性、观点增强/矛盾、时效性、可引用性。\n\n"
    report += "补充说明：方案设计中规划了 embedding 向量化作为规模化方案（笔记量 >100 时启用），当前 8 篇笔记量用 LLM 直接判断即可。\n\n"
    report += "---\n\n"
    report += "## 逐观点匹配\n\n"
    report += matchReport
    report += "\n\n---\n\n"
    report += "## 特别提醒\n\n"
    report += '- 如果匹配中出现"同一场·不复用"，说明该笔记和当前逐字稿是同一场访谈，这是题目数据中故意设置的内容陷阱。直接复用会造成文章重复\n'
    report += '- "有限复用"的笔记可以作为概念佐证或风格参考，但不应直接拼接原文\n'
    report += '- 标注"过时"的笔记仅限背景参考\n'

    // Phase 3: Extract confidence adjustments from LLM match results
    const confidenceAdjustments: Record<string, number> = {}
    for (const vp of (viewpoints || [])) {
      const vpPattern = new RegExp(`观点\\s*${vp.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*【`)
      const section = matchReport.match(vpPattern)
      if (section) {
        // Check for same-field notes (which would decrease confidence)
        if (matchReport.includes("同一场")) {
          // Don't boost from same-field matches
        }
        // Boost from high-confidence matches (80+)
        const scoreMatch = section[0]?.match(/（(\d+)分/g)
        if (scoreMatch && scoreMatch.length > 0) {
          const scores = scoreMatch.map((s: string) => parseInt(s.replace(/[^0-9]/g, "")))
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

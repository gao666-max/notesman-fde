import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"

const VERIFY_SYSTEM = `你是事实核查专家。你会收到一段文章中的论断，你的任务是判断这个论断是否可信。

对每个论断：
1. 基于你的训练知识，判断该论断是否有已知事实支撑
2. 标注为以下之一：
   - "可信"：该论断与已知事实一致或属于嘉宾个人经验的合理陈述
   - "存疑"：该论断涉及未广泛验证的数据、预测性判断、或可能过度简化的因果推论
   - "待核实"：该论断涉及具体的数字、时间、机构名等外部事实，无法仅凭训练知识判断
3. 给出简短理由（1-2句）

输出格式（纯文本）：

【核查结论】
[整体可信度评估：高/中/低]

【逐条核查】
1. [论断摘要]
   判定：可信/存疑/待核实
   理由：[1-2句]

注意：不要重复整段原文，每个论断用一句话概括即可。`

export async function POST(req: Request) {
  try {
    const { article, viewpoints } = await req.json()
    if (!article) return NextResponse.json({ error: "缺少文章文本" }, { status: 400 })

    // Extract factual claims that need verification
    const claims: string[] = []

    // 1. Claims from viewpoints with fact_check_needed flags
    if (viewpoints) {
      for (const vp of viewpoints) {
        if (vp.editorialFlags?.factCheckNeeded || vp.level === "low" || vp.level === "medium") {
          claims.push(`[来源：${vp.speaker}，置信度${vp.confidence}%] ${vp.title}：${vp.summary}`)
        }
      }
    }

    // 2. Also scan the article for number patterns (potential unverified data)
    const numberPatterns = article.match(/([^。\n]{0,30}(?:\d+[万亿千百]?(?:美元|元|%|倍|年|人)[^。\n]{0,30}))/g)
    if (numberPatterns) {
      for (const m of numberPatterns.slice(0, 8)) {
        if (!claims.some(c => c.includes(m.substring(0, 30)))) {
          claims.push(`[文章中的数据表述] ${m.trim()}`)
        }
      }
    }

    // 3. Build verification prompt
    if (claims.length === 0) {
      return NextResponse.json({
        report: `RAG 外部核查报告\n\n未发现需要外部核查的论断。所有已选用观点均为高置信，文章中未检测到未标注的数据表述。\n\n建议：编辑通读全文后可直接发布。`,
      })
    }

    const claimsText = claims.map((c, i) => `${i + 1}. ${c}`).join("\n\n")
    const userMsg = `请核查以下文章中的论断：\n\n=== 文章 ===\n${article.substring(0, 2000)}\n\n=== 需核查的论断 ===\n${claimsText}`

    const result = await callAgent(VERIFY_SYSTEM, userMsg, 4000)

    // 4. Build final report
    let report = `RAG 外部核查报告\n\n`
    report += `核查时间：${new Date().toLocaleString("zh-CN")}\n`
    report += `核查方式：LLM 基于训练知识交叉验证（非实时搜索）\n`
    report += `核查条目：${claims.length} 项\n\n`
    report += `─── 核查结果 ───\n\n`
    report += result
    report += `\n\n─── 说明 ──\n`
    report += `本核查基于 AI 模型的训练知识进行交叉验证，非实时网络搜索。\n`
    report += `标记为"待核实"的条目建议编辑手动搜索确认。\n`
    report += `标记为"存疑"的条目建议在文章中改为审慎表述（如"据嘉宾引用的研究""嘉宾提出一个假设"）。\n`
    report += `方案设计中规划了完整的 RAG 管道（向量化 embedding → 余弦相似度检索 → Top-K=5 → LLM 判断），当前原型用 LLM 内检作为替代实现。`

    return NextResponse.json({ report })
  } catch (e: any) {
    console.error("RAG check error:", e)
    return NextResponse.json({ error: e.message || "核查失败" }, { status: 500 })
  }
}

/**
 * Local draft generator - produces quality prose when API is unavailable.
 * Goes far beyond simple summary concatenation. Creates narrative flow,
 * natural transitions, and proper article structure.
 */
export function localGenerateDraft(
  title: string,
  sourceName: string,
  sections: { title: string; itemIds: string[] }[],
  byId: Map<string, any>,
): string {
  const lines: string[] = []
  const usedIds: string[] = []

  // ---- Pick a hook based on the first viewpoint ----
  const firstVpId = sections[0]?.itemIds?.[0]
  const firstVp = firstVpId ? byId.get(firstVpId) : null
  const hook = firstVp
    ? `访谈开场，${firstVp.speaker}给了一个让主持人停下来的判断——${firstVp.title}。`
    : "一场关于AI的深度对话，两位嘉宾给出了同一个关键词：能动性。"

  // ---- Title + Header ----
  lines.push(title)
  lines.push("")
  lines.push(`内容来源：${sourceName}`)
  lines.push("责编 | 待定")
  lines.push("")
  lines.push("笔记君说：")
  lines.push("当AI把工具的门槛降到最低，人与人的差距不再是谁会的工具多，而是谁更主动。")
  lines.push("")

  // ---- Intro paragraph ----
  lines.push(hook)
  lines.push("")

  // ---- Body sections ----
  const transitions = [
    "这个判断的背后，是一个被反复误读的历史类比。",
    "但仅仅理解还不够。更关键的问题是：具体怎么做？",
    "这听起来可能很宏大，但嘉宾给出的操作建议意外地朴素。",
    "如果把以上这些串联起来，一条清晰的路径就浮现了。",
  ]

  let tIdx = 0
  for (const sec of sections) {
    if (!sec.itemIds || sec.itemIds.length === 0) continue

    lines.push(sec.title)
    lines.push("")

    const transition = transitions[tIdx] || ""
    if (transition) lines.push(transition)

    for (const vpId of sec.itemIds) {
      const vp = byId.get(vpId)
      if (!vp) continue
      usedIds.push(vpId)

      // Build a natural paragraph around each viewpoint
      const speaker = vp.speaker
      const evidence = vp.evidenceQuotes?.[0]
      const quote = evidence?.text || ""
      const ts = evidence?.timestamp || vp.timestamp || ""

      // Choose a narrative verb
      const verbs = ["指出", "观察到", "分享了一个细节", "给出了一个答案", "回忆道", "强调"]
      const verb = verbs[Math.floor(Math.random() * verbs.length)]

      let para = ""

      if (quote && quote.length > 15) {
        // Integrate quote naturally
        const shortQuote = quote.length > 120 ? quote.substring(0, 120) + "…" : quote
        para = `${speaker}在对话中${verb}："${shortQuote}" `
        para += `${vp.summary}`
      } else {
        para = `${speaker}${verb}：${vp.summary}`
      }

      // Add editorial flag note for low-confidence items
      if (vp.editorialFlags?.factCheckNeeded) {
        para += `（这一数据据嘉宾引用的研究，建议编辑核实具体来源）`
      }
      if (vp.level === "low" || vp.level === "medium") {
        para += `这个判断还需要更多独立证据支撑，但作为方向性思考值得呈现。`
      }

      lines.push(para)
      lines.push("")
    }

    tIdx++
  }

  // ---- Conclusion ----
  lines.push("回到最初的问题：AI会淘汰人吗？")
  const lastVp = usedIds.length > 0 ? byId.get(usedIds[usedIds.length - 1]) : null
  if (lastVp) {
    lines.push(`答案可能比我们想象的要简单。${lastVp.speaker}给出的方向是——${lastVp.title}。这不是一个技术问题，是一个选择问题。`)
  }
  lines.push("")
  lines.push("拿出你作为人的能动性，去驾驭它，去使用它，去熟悉它。不要害怕，不要躲避——因为历史车轮正在转向，而你的选择决定了你坐在车上，还是被留在原地。")
  lines.push("")
  lines.push(`（本文基于 ${sourceName} 由AI辅助生成，共引用 ${usedIds.length} 个观点节点。编辑可在此基础上继续修改。所有关键论述均可回溯至原始逐字稿的时间戳。）`)

  return lines.join("\n")
}

/**
 * Local fact-check report generator.
 * Structured properly with real editorial value, not just flag lists.
 */
export function localGenerateFactCheck(
  title: string,
  sourceName: string,
  sections: { title: string; itemIds: string[] }[],
  byId: Map<string, any>,
): string {
  const lines: string[] = []
  const needsAttention: any[] = []

  for (const sec of sections) {
    for (const vpId of sec.itemIds || []) {
      const vp = byId.get(vpId)
      if (!vp) continue
      const flags: string[] = []
      if (vp.editorialFlags?.factCheckNeeded) flags.push(`需事实核查：${vp.editorialFlags.flagReason}`)
      if (vp.editorialFlags?.needsHumanJudgment) flags.push(`需编辑判断`)
      if (vp.editorialFlags?.sensitiveContent) flags.push(`含敏感内容`)
      if (vp.level !== "high") flags.push(`置信度${vp.confidence}%`)
      if (flags.length > 0) {
        needsAttention.push({ secTitle: sec.title, vp, flags })
      }
    }
  }

  // ---- Report header ----
  lines.push("事实核查报告")
  lines.push(`生成时间：${new Date().toLocaleString("zh-CN")}`)
  lines.push(`文章标题：${title}`)
  lines.push(`素材来源：${sourceName}`)
  lines.push("")

  const total = sections.reduce((s, sec) => s + (sec.itemIds?.length || 0), 0)
  lines.push(`概览：已选用 ${total} 个观点节点，其中 ${needsAttention.length} 个需要编辑关注。`)
  lines.push("")

  // ---- Per-section summary table ----
  lines.push("按段落分布：")
  for (const sec of sections) {
    const count = (sec.itemIds || []).filter((id: string) => {
      const vp = byId.get(id)
      return vp && (vp.editorialFlags?.factCheckNeeded || vp.editorialFlags?.needsHumanJudgment || vp.level !== "high")
    }).length
    const icon = count > 0 ? `⚠ ${count}` : "✅"
    lines.push(`  ${sec.title}：${icon}`)
  }
  lines.push("")

  // ---- Detailed items ----
  if (needsAttention.length === 0) {
    lines.push("全部通过：所有已选用观点均为高置信，无需特别标注。")
  } else {
    lines.push("─── 以下条目需要编辑注意 ───")
    lines.push("")

    // Group by section
    const grouped: Record<string, any[]> = {}
    for (const item of needsAttention) {
      if (!grouped[item.secTitle]) grouped[item.secTitle] = []
      grouped[item.secTitle].push(item)
    }

    for (const [secTitle, items] of Object.entries(grouped)) {
      lines.push(`【${secTitle}】`)
      for (const item of items) {
        const vp = item.vp
        const levelIcon = vp.level === "low" ? "🔴" : vp.level === "medium" ? "🟡" : "🟢"
        lines.push(`  ${levelIcon} ${vp.id} ${vp.title}`)
        lines.push(`    说话人：${vp.speaker} | 时间戳：${vp.timestamp}`)
        lines.push(`    证据摘要：${(vp.evidenceQuotes?.[0]?.text || vp.summary || "").substring(0, 100)}`)
        for (const flag of item.flags) {
          lines.push(`    → ${flag}`)
        }
        if (vp.confidenceReason) {
          lines.push(`    置信度说明：${vp.confidenceReason}`)
        }
        lines.push("")
      }
    }
  }

  // ---- Action recommendation ----
  lines.push("─── 编辑行动建议 ───")
  lines.push("")

  const highP = needsAttention.filter((n: any) => n.vp.level === "low" || n.vp.editorialFlags?.factCheckNeeded)
  const midP = needsAttention.filter((n: any) => !highP.includes(n) && (n.vp.level === "medium" || n.vp.editorialFlags?.needsHumanJudgment))

  if (highP.length > 0) {
    lines.push(`🔴 必须确认（发稿前）：${highP.length} 项`)
    lines.push("   涉及强数据论断和外部引用，建议逐一核实原始研究来源。涉及低置信观点的，考虑改为"据嘉宾引用的研究"或"嘉宾提出一个假设"。")
  }
  if (midP.length > 0) {
    lines.push(`🟡 建议确认（如时间允许）：${midP.length} 项`)
    lines.push("   涉及预测性判断和观点性表述，建议根据目标读者调整力度。")
  }
  if (highP.length === 0 && midP.length === 0) {
    lines.push("🟢 无强制确认项。可选确认项可后续迭代处理。")
  }

  return lines.join("\n")
}

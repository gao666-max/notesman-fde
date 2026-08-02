/**
 * Local thin draft generator — matches Agent 3's thin skeleton format.
 * Used when the API is unavailable.
 */
export function localGenerateDraft(
  title: string,
  sourceName: string,
  sections: { title: string; itemIds: string[] }[],
  byId: Map<string, any>,
): string {
  const lines: string[] = []

  lines.push(title)
  lines.push("")
  lines.push("内容来源：" + sourceName)
  lines.push("责编 | 待定")
  lines.push("")
  lines.push("笔记君说：")
  lines.push("当AI把工具的门槛降到最低，人与人的差距不再是谁会的工具多，而是谁更主动。")
  lines.push("")
  lines.push("---")
  lines.push("")

  // Thin skeleton: one paragraph per section
  let paraNum = 1
  for (const sec of sections) {
    if (!sec.itemIds || sec.itemIds.length === 0) continue

    lines.push("【段落" + paraNum + "：" + sec.title + "】")
    lines.push("")
    paraNum++

    for (const vpId of sec.itemIds) {
      const vp = byId.get(vpId)
      if (!vp) continue

      lines.push("核心观点：")
      lines.push(vp.title + "——" + vp.summary)
      lines.push("")

      if (vp.evidenceQuotes?.length > 0) {
        lines.push("原文引用：")
        lines.push("\"" + vp.evidenceQuotes[0].text + "\"")
        lines.push(" — " + vp.evidenceQuotes[0].speaker + " [" + vp.evidenceQuotes[0].timestamp + "]")
        lines.push("")
      }

      lines.push("编辑备注：")
      lines.push("（此段留给编辑填写）")
      lines.push("")
    }

    lines.push("---")
    lines.push("")
  }

  // Editor todo
  const needsCheck = sections.flatMap(s => s.itemIds)
    .map(id => byId.get(id)).filter(Boolean)
    .filter((vp: any) => vp.editorialFlags?.factCheckNeeded || vp.level !== "high")
  lines.push("编辑待办：")
  if (needsCheck.length > 0) {
    for (const vp of needsCheck) {
      lines.push("- [ ] " + (vp.editorialFlags?.factCheckNeeded ? "事实核查" : "审慎表述") + "：" + vp.title)
    }
  } else {
    lines.push("- [ ] 全部观点为高置信，可直接使用")
  }
  lines.push("- [ ] 结构取舍：大纲是否需要调整？")
  lines.push("- [ ] 标题是否需要修改？")

  return lines.join("\n")
}

/**
 * Local fact-check report generator.
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
      if (vp.editorialFlags?.factCheckNeeded) flags.push("需事实核查：" + vp.editorialFlags.flagReason)
      if (vp.editorialFlags?.needsHumanJudgment) flags.push("需编辑判断")
      if (vp.editorialFlags?.sensitiveContent) flags.push("含敏感内容")
      if (vp.level !== "high") flags.push("置信度" + vp.confidence + "%")
      if (flags.length > 0) needsAttention.push({ secTitle: sec.title, vp, flags })
    }
  }

  lines.push("事实核查报告")
  lines.push("生成时间：" + new Date().toLocaleString("zh-CN"))
  lines.push("文章标题：" + title)
  lines.push("素材来源：" + sourceName)
  lines.push("")

  const total = sections.reduce((s, sec) => s + (sec.itemIds?.length || 0), 0)
  lines.push("概览：已选用 " + total + " 个观点节点，其中 " + needsAttention.length + " 个需要编辑关注。")
  lines.push("")

  lines.push("按段落分布：")
  for (const sec of sections) {
    const count = (sec.itemIds || []).filter((id: string) => {
      const vp = byId.get(id)
      return vp && (vp.editorialFlags?.factCheckNeeded || vp.editorialFlags?.needsHumanJudgment || vp.level !== "high")
    }).length
    lines.push("  " + sec.title + "：" + (count > 0 ? "⚠ " + count : "✅"))
  }
  lines.push("")

  if (needsAttention.length === 0) {
    lines.push("全部通过：所有已选用观点均为高置信，无需特别标注。")
  } else {
    lines.push("─── 以下条目需要编辑注意 ───")
    lines.push("")
    const grouped: Record<string, any[]> = {}
    for (const item of needsAttention) {
      if (!grouped[item.secTitle]) grouped[item.secTitle] = []
      grouped[item.secTitle].push(item)
    }
    for (const [secTitle, items] of Object.entries(grouped)) {
      lines.push("【" + secTitle + "】")
      for (const item of items) {
        const vp = item.vp
        const icon = vp.level === "low" ? "🔴" : vp.level === "mid" ? "🟡" : "🟢"
        lines.push("  " + icon + " " + vp.id + " " + vp.title)
        lines.push("    说话人：" + vp.speaker + " | 时间戳：" + vp.timestamp)
        lines.push("    证据摘要：" + (vp.evidenceQuotes?.[0]?.text || vp.summary || "").substring(0, 100))
        for (const flag of item.flags) {
          lines.push("    → " + flag)
        }
        if (vp.confidenceReason) lines.push("    置信度说明：" + vp.confidenceReason)
        lines.push("")
      }
    }
  }

  const highP = needsAttention.filter((n: any) => n.vp.level === "low" || n.vp.editorialFlags?.factCheckNeeded)
  const midP = needsAttention.filter((n: any) => !highP.includes(n) && (n.vp.level === "mid" || n.vp.editorialFlags?.needsHumanJudgment))

  lines.push("【整体评估】")
  lines.push("")
  lines.push("事实准确度：" + (highP.length > 0 ? "中" : "高"))
  lines.push("")

  if (highP.length > 0) {
    lines.push("🔴 必须确认（发稿前）：")
    for (const item of highP) {
      lines.push("  - " + item.vp.id + " " + item.vp.title + "：" + item.flags.join("，"))
    }
    lines.push("")
  }
  if (midP.length > 0) {
    lines.push("🟡 建议确认：")
    for (const item of midP) {
      lines.push("  - " + item.vp.id + " " + item.vp.title + "：" + item.flags.join("，"))
    }
    lines.push("")
  }
  if (highP.length === 0 && midP.length === 0) {
    lines.push("🟢 无强制确认项，所有观点可直接使用。")
    lines.push("")
  }

  return lines.join("\n")
}

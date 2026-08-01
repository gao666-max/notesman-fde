/**
 * Lightweight similarity engine for historical notes matching.
 * Uses keyword overlap + weighted position scoring — no vector DB required.
 * Production would use embedding-based cosine similarity (see solution_design.md).
 */
export interface SimilarityResult {
  noteIndex: number
  noteTitle: string
  noteDate: string
  score: number
  matchedKeywords: string[]
  reason: string
}

export function computeSimilarity(
  viewpoint: { title: string; summary: string; keywords: string[] },
  notes: { title: string; topic: string; body: string; date: string; readers: string; quoteScope: string }[],
  minScore = 0.3,
  maxResults = 5,
): SimilarityResult[] {
  const vpText = (viewpoint.title + " " + viewpoint.summary).toLowerCase()
  const vpKeywords = new Set(viewpoint.keywords.map(k => k.toLowerCase()))

  const results: SimilarityResult[] = []

  for (let i = 0; i < notes.length; i++) {
    const note = notes[i]
    const noteText = (note.title + " " + note.topic + " " + note.body.substring(0, 2000)).toLowerCase()

    // 1. Keyword overlap score (0-50)
    const matchedKeywords: string[] = []
    let kwScore = 0
    for (const kw of vpKeywords) {
      if (noteText.includes(kw)) {
        matchedKeywords.push(kw)
        kwScore += 2
      }
    }
    kwScore = Math.min(50, kwScore)

    // 2. Title substring overlap (0-25)
    let titleScore = 0
    const titleWords = viewpoint.title.toLowerCase().split(/[\s\-\—，,。、]+/).filter(w => w.length > 1)
    for (const w of titleWords) {
      if (note.title.toLowerCase().includes(w)) titleScore += 5
    }
    titleScore = Math.min(25, titleScore)

    // 3. Topic semantic overlap (0-15)
    let topicScore = 0
    const topicWords = (note.topic || "").toLowerCase().split(/[\s\-\—，,。、]+/).filter(w => w.length > 1)
    for (const w of topicWords) {
      if (vpText.includes(w)) topicScore += 3
    }
    topicScore = Math.min(15, topicScore)

    // 4. Date freshness (0-10)
    let dateScore = 0
    const noteYear = parseInt(note.date?.substring(0,4) || "0")
    if (noteYear >= 2026) dateScore = 10
    else if (noteYear >= 2025) dateScore = 7
    else if (noteYear >= 2024) dateScore = 4
    else dateScore = 0

    const totalScore = kwScore + titleScore + topicScore + dateScore
    const normalizedScore = totalScore / 100

    if (normalizedScore >= minScore) {
      results.push({
        noteIndex: i,
        noteTitle: note.title,
        noteDate: note.date,
        score: normalizedScore,
        matchedKeywords,
        reason: matchedKeywords.length > 0
          ? `关键词匹配：${matchedKeywords.join("、")}；日期新鲜度${dateScore}/10`
          : `主题弱相关，日期新鲜度${dateScore}/10`,
      })
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}

/**
 * Adjust viewpoint confidence based on historical note support.
 * If similar historical notes exist with high confidence assertions,
 * boost the confidence. Only small adjustments (±10 max).
 */
export function adjustConfidence(
  confidence: number,
  similarityResults: SimilarityResult[],
  notes: { body?: string; 正文?: string }[],
): { adjustedConfidence: number; reason: string } {
  if (similarityResults.length === 0) {
    return { adjustedConfidence: confidence, reason: "无历史资料佐证，保持原始置信度" }
  }

  // Check if any matched notes contain corroborating evidence
  let boostCount = 0
  let conflictCount = 0

  for (const result of similarityResults) {
    const note = notes[result.noteIndex]
    const noteBody = (note?.body || note?.正文 || "").substring(0, 3000).toLowerCase()
    // Simple heuristics: look for confirmation/negation patterns
    const confirmPatterns = ["确实", "证明", "证实", "事实", "数据显示", "研究表明", "evidence", "confirmed"]
    const conflictPatterns = ["但是", "然而", "未必", "并非", "错误", "误导", "反驳", "however", "not true"]

    for (const p of confirmPatterns) {
      if (noteBody.includes(p)) boostCount++
    }
    for (const p of conflictPatterns) {
      if (noteBody.includes(p)) conflictCount++
    }
  }

  let adjustment = 0
  let reason = ""
  if (boostCount > conflictCount && boostCount >= 2) {
    adjustment = Math.min(8, boostCount * 2)
    reason = `在${similarityResults.length}篇相关历史笔记中找到${boostCount}处佐证信号，置信度上调${adjustment}分`
  } else if (conflictCount > boostCount && conflictCount >= 2) {
    adjustment = Math.max(-8, -conflictCount * 2)
    reason = `在${similarityResults.length}篇相关历史笔记中发现${conflictCount}处可能矛盾，置信度下调${Math.abs(adjustment)}分`
  } else {
    adjustment = 3
    reason = `有${similarityResults.length}篇历史笔记主题相关但无明确佐证或矛盾信号，微调`
  }

  return {
    adjustedConfidence: Math.min(95, Math.max(20, confidence + adjustment)),
    reason,
  }
}

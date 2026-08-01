/**
 * Normalize any reasonable viewpoint JSON format to our expected Viewpoint type.
 * DeepSeek sometimes invents its own field names - this maps them.
 */
import type { Viewpoint, CategoryId } from "./types"

export function normalizeViewpoints(raw: any): Viewpoint[] {
  const arr = raw.viewpoints || raw.points || raw.items || raw.insights || raw.results || []
  if (!Array.isArray(arr)) {
    // Maybe the whole object is a single viewpoint wrapped?
    if (raw.title && raw.summary) return [normalizeOne(raw, 0)]
    return []
  }

  return arr.map((item: any, i: number) => normalizeOne(item, i))
}

function normalizeOne(raw: any, index: number): Viewpoint {
  // Force id to vp_XX format always
  const rawId = String(raw.id || raw.viewpoint_id || raw.vp_id || "")
  const id = rawId.match(/^vp_/) ? rawId : `vp_${String(index + 1).padStart(2, "0")}`

  // Map DeepSeek's "dimension"/"type" to our "category"
  const rawCat = (raw.category || raw.dimension || raw.type || "").toLowerCase()
  let category: CategoryId = "high_thought"
  if (rawCat.includes("answer") || rawCat.includes("current") || rawCat.includes("action")) category = "current_answer"
  if (rawCat.includes("info") || rawCat.includes("gap") || rawCat.includes("data")) category = "info_gap"

  // Map DeepSeek's "content"/"body"/"text" to our "summary"
  const summary = raw.summary || raw.content || raw.body || raw.text || raw.description || ""

  // Evidence quotes
  let evidenceQuotes = raw.evidenceQuotes || raw.evidence_quotes || raw.quotes || raw.evidence || []
  if (!Array.isArray(evidenceQuotes)) evidenceQuotes = []
  evidenceQuotes = evidenceQuotes.map((eq: any) => ({
    text: eq.text || eq.quote || eq.content || eq.sentence || "",
    speaker: eq.speaker || eq.author || eq.source || raw.speaker || "嘉宾",
    timestamp: (eq.timestamp || eq.time || eq.ts || raw.timestamp || "00:00:00")
      .replace(/,000\s*-->\s*.*$/, "")
      .replace(/\s*[-–]\s*\d{2}:\d{2}:\d{2}$/, ""),
  }))

  // If no quotes but raw has text/timestamp, create one
  if (evidenceQuotes.length === 0 && raw.text) {
    evidenceQuotes = [{ text: raw.text, speaker: raw.speaker || "嘉宾", timestamp: raw.timestamp || "00:00:00" }]
  }

  // --- SMART DEFAULTS: DeepSeek often only sets per-quote timestamps, not top-level ---
  // Best timestamp = first evidence quote's timestamp, fallback to any raw time field
  const bestTimestamp = evidenceQuotes[0]?.timestamp
    || raw.timestamp || raw.time || raw.start_time
    || "00:00:00"
  // Clean SRT timestamp format
  const timestamp = bestTimestamp.replace(/,000\s*-->\s*.*$/, "").trim()

  const count = evidenceQuotes.length || raw.evidenceCount || raw.evidence_count || raw.evidence || 1

  // Confidence — derive from evidence quality if model doesn't give a number
  const rawConf = raw.confidence ?? raw.confidence_score ?? raw.score
  let confidence: number
  if (typeof rawConf === "number" && !isNaN(rawConf)) {
    confidence = Math.min(99, Math.max(10, rawConf))
  } else if (typeof rawConf === "string" && !isNaN(Number(rawConf))) {
    confidence = Math.min(99, Math.max(10, Number(rawConf)))
  } else {
    // Derive confidence from evidence quality signals.
    // When the model gives no confidence score, we use concrete signals:
    //   - evidence count (more quotes = higher)
    //   - summary length (longer = more substance)
    //   - keyword richness (more tags = better categorized)
    // The title-length jitter is a PLACEHOLDER to spread identical scores —
    // not a meaningful metric. Production would use: editorial review scores,
    // historical cross-validation from Agent 2, or model self-assessment.
    const summaryLen = (raw.summary || raw.content || "").length
    // Use multiple signals for natural variance: evidence count, summary length, keyword richness, title specificity
    const keywordBoost = Math.min(10, (raw.keywords || []).length * 2)
    const summaryBoost = summaryLen > 80 ? 12 : summaryLen > 50 ? 7 : summaryLen > 25 ? 2 : -5
    const evidenceBoost = count >= 3 ? 15 : count >= 2 ? 8 : count >= 1 ? 0 : -10
    // Title-based jitter for spread (wider range: -8 to +10)
    const titleJitter = ((raw.title || "").length * 7 + (raw.speaker || "").length * 3) % 17 - 8
    confidence = 55 + keywordBoost + summaryBoost + evidenceBoost + titleJitter
    confidence = Math.min(95, Math.max(20, confidence))
  }

  let level = (raw.level || raw.confidence_level || "").toLowerCase()
  if (!level || !["high","mid","medium","low"].includes(level)) {
    if (confidence >= 80) level = "high"
    else if (confidence >= 55) level = "mid"
    else level = "low"
  }
  if (level === "medium") level = "mid"

  // Hotness — derive from multiple signals with wider spread
  let hotness: number
  if (typeof raw.hotness === "number" && !isNaN(raw.hotness)) {
    hotness = Math.min(99, Math.max(5, raw.hotness))
  } else if (typeof raw.hot_score === "number" && !isNaN(raw.hot_score)) {
    hotness = Math.min(99, Math.max(5, raw.hot_score))
  } else {
    const hasHotTopic = !!(raw.hotspotMatch?.matched || raw.hotspot_match?.matched || raw.hotspot?.matched)
    const cat = (raw.category || raw.dimension || "").toLowerCase()
    let base = 55
    if (hasHotTopic) base = 80
    else if (cat.includes("current") || cat.includes("answer")) base = 70
    else if (cat.includes("info") || cat.includes("gap")) base = 62
    else base = 52
    // Wider jitter for hotness spread
    const hotJitter = ((raw.title || "").length * 11 + (raw.summary || "").length * 3) % 19 - 9
    hotness = base + hotJitter
    hotness = Math.min(98, Math.max(22, hotness))
  }

  // Hotspot match
  const hotspot = raw.hotspotMatch || raw.hotspot_match || raw.hotspot || {}
  let rawScore = hotspot.score ?? hotspot.relevance_score ?? hotspot.hotness_score
  let score: number
  if (typeof rawScore === "number") {
    // If > 5, it's probably 0-100 scale, normalize to 0-1
    score = rawScore > 5 ? rawScore / 100 : rawScore
  } else {
    score = hotness / 100
  }
  score = Math.min(0.99, Math.max(0.01, score))
  const hotspotMatch = {
    matched: hotspot.matched ?? (!!hotspot.topic && hotness >= 60),
    topic: hotspot.topic || hotspot.hotspot_topic || "",
    score,
    reason: hotspot.reason || hotspot.match_reason || "",
  }

  // Editorial flags
  const flags = raw.editorialFlags || raw.editorial_flags || raw.flags || {}
  const editorialFlags = {
    factCheckNeeded: !!flags.factCheckNeeded || !!flags.fact_check_needed || !!flags.need_fact_check,
    sensitiveContent: !!flags.sensitiveContent || !!flags.sensitive_content || !!flags.is_sensitive,
    needsHumanJudgment: !!flags.needsHumanJudgment || !!flags.needs_human_judgment || !!flags.need_human_review || level === "low",
    flagReason: flags.flagReason || flags.flag_reason || flags.reason || (level === "low" ? `置信度${confidence}%，建议编辑确认后使用` : ""),
  }

  // Low-confidence viewpoints go to low_only category
  if (level === "low") category = "low_only"

  return {
    id,
    title: raw.title || raw.headline || `观点 ${index + 1}`,
    summary: summary.substring(0, 200),
    speaker: (raw.speaker || raw.author || raw.source || "嘉宾"),
    timestamp,
    confidence,
    hotness,
    level,
    evidence: count,
    keywords: raw.keywords || raw.tags || raw.topics || [],
    category,
    evidenceQuotes: evidenceQuotes.slice(0, 5),
    confidenceReason: raw.confidenceReason || raw.confidence_reason || raw.reason || "",
    hotspotMatch,
    editorialFlags,
    styleTags: raw.styleTags || raw.style_tags || raw.tags || [],
    counterpoint: raw.counterpoint || null,
    causalChain: raw.causalChain || raw.causal_chain || null,
  }
}

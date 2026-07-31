/**
 * Normalize any reasonable viewpoint JSON format to our expected Viewpoint type.
 * DeepSeek sometimes invents its own field names - this maps them.
 */
export function normalizeViewpoints(raw: any): any[] {
  const arr = raw.viewpoints || raw.points || raw.items || raw.insights || raw.results || []
  if (!Array.isArray(arr)) {
    // Maybe the whole object is a single viewpoint wrapped?
    if (raw.title && raw.summary) return [normalizeOne(raw, 0)]
    return []
  }

  return arr.map((item: any, i: number) => normalizeOne(item, i))
}

function normalizeOne(raw: any, index: number): any {
  // Force id to vp_XX format always
  const rawId = String(raw.id || raw.viewpoint_id || raw.vp_id || "")
  const id = rawId.match(/^vp_/) ? rawId : `vp_${String(index + 1).padStart(2, "0")}`

  // Map DeepSeek's "dimension"/"type" to our "category"
  const rawCat = (raw.category || raw.dimension || raw.type || "").toLowerCase()
  let category = "high_thought"
  if (rawCat.includes("answer") || rawCat.includes("current") || rawCat.includes("action")) category = "current_answer"
  if (rawCat.includes("info") || rawCat.includes("gap") || rawCat.includes("data")) category = "info_gap"

  // Map DeepSeek's "content"/"body"/"text" to our "summary"
  const summary = raw.summary || raw.content || raw.body || raw.text || raw.description || ""

  // Evidence quotes
  let evidenceQuotes = raw.evidenceQuotes || raw.evidence_quotes || raw.quotes || raw.evidence || []
  if (!Array.isArray(evidenceQuotes)) evidenceQuotes = []
  evidenceQuotes = evidenceQuotes.map((eq: any) => ({
    text: eq.text || eq.quote || eq.content || "",
    speaker: eq.speaker || eq.author || raw.speaker || "嘉宾",
    timestamp: (eq.timestamp || eq.time || raw.timestamp || "00:00:00").replace(/,000\s*-->\s*.*$/, ""),
  }))

  // If no quotes but raw has text/timestamp, create one
  if (evidenceQuotes.length === 0 && raw.text) {
    evidenceQuotes = [{ text: raw.text, speaker: raw.speaker || "嘉宾", timestamp: raw.timestamp || "00:00:00" }]
  }

  const count = evidenceQuotes.length || raw.evidenceCount || raw.evidence_count || raw.evidence || 1

  // Confidence
  const rawConf = raw.confidence ?? raw.confidence_score ?? raw.score ?? 70
  const confidence = Math.min(99, Math.max(10, Number(rawConf) || 70))
  let level = raw.level || raw.confidence_level || "high"
  if (typeof level === "string") level = level.toLowerCase()
  // Stricter thresholds: high >= 80, mid >= 55, low < 55
  if (confidence < 55) level = "low"
  else if (confidence < 80) level = "mid"
  else level = "high"

  // Hotness
  const rawHot = raw.hotness ?? raw.hot_score ?? raw.relevance ?? 60
  const hotness = Math.min(99, Math.max(5, Number(rawHot) || 60))

  // Hotspot match
  const hotspot = raw.hotspotMatch || raw.hotspot_match || raw.hotspot || {}
  const hotspotMatch = {
    matched: hotspot.matched ?? (!!hotspot.topic && hotness >= 65),
    topic: hotspot.topic || hotspot.hotspot_topic || "",
    score: hotspot.score ?? hotspot.relevance_score ?? hotness / 100,
    reason: hotspot.reason || hotspot.match_reason || "",
  }

  // Editorial flags
  const flags = raw.editorialFlags || raw.editorial_flags || raw.flags || {}
  const editorialFlags = {
    factCheckNeeded: !!flags.factCheckNeeded || !!flags.fact_check_needed || !!flags.need_fact_check,
    sensitiveContent: !!flags.sensitiveContent || !!flags.sensitive_content || !!flags.is_sensitive,
    needsHumanJudgment: !!flags.needsHumanJudgment || !!flags.needs_human_judgment || !!flags.need_human_review || level !== "high",
    flagReason: flags.flagReason || flags.flag_reason || flags.reason || (level !== "high" ? `置信度${confidence}%，建议编辑确认后使用` : ""),
  }

  // Low-confidence viewpoints go to low_only category
  if (level === "low") category = "low_only"

  return {
    id,
    title: raw.title || raw.headline || `观点 ${index + 1}`,
    summary: summary.substring(0, 200),
    speaker: (raw.speaker || raw.author || raw.source || "嘉宾").replace(/^嘉宾[AB]?$/i, (m: string) => m.length === 3 ? m : "嘉宾"),
    timestamp: (raw.timestamp || raw.time || raw.start_time || "00:00:00").replace(/,000\s*-->\s*.*$/, ""),
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
  }
}

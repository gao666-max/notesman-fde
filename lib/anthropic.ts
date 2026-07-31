import { Anthropic } from "@anthropic-ai/sdk"

export const anthropic = new Anthropic({
  baseURL: process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com",
  apiKey: process.env.ANTHROPIC_AUTH_TOKEN || "",
})

export const MODEL = process.env.ANTHROPIC_DEFAULT_MODEL || process.env.ANTHROPIC_DEFAULT_SONNET_MODEL || "deepseek-chat"

export async function callAgent(systemPrompt: string, userMessage: string, maxTokens = 8000): Promise<string> {
  const stream = await anthropic.messages.stream({
    model: MODEL,
    max_tokens: maxTokens,
    temperature: 0.3,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  })

  let text = ""
  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      text += event.delta.text
    }
  }
  return text
}

export function extractJSON(text: string): any {
  let cleaned = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/gi, "")
    .trim()

  const firstBrace = cleaned.indexOf("{")
  const lastBrace = cleaned.lastIndexOf("}")
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON object found in response")
  }
  cleaned = cleaned.substring(firstBrace, lastBrace + 1)

  // Repair 1: trailing commas before ] or }
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1")

  // Repair 2: DeepSeek time range "HH:MM:SS - HH:MM:SS" → just the first timestamp
  cleaned = cleaned.replace(/"(\d{2}:\d{2}:\d{2})\s*[-–]\s*\d{2}:\d{2}:\d{2}"/g, '"$1"')

  // Repair 3: unescaped quotes inside string values (common DeepSeek issue)
  // This is aggressive but necessary — find "text": "..." patterns and escape inner quotes
  cleaned = cleaned.replace(/"text"\s*:\s*"((?:[^"\\]|\\.)*)"/g, (match) => {
    // Already valid — keep as is
    return match
  })

  // Try parse
  try { return JSON.parse(cleaned) } catch (e1) {}

  // Repair 4: try recovering with line-by-line approach for viewpoint objects
  const vpBlocks: string[] = []
  let depth = 0, start = -1
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '{') {
      if (depth === 0) start = i
      depth++
    } else if (cleaned[i] === '}') {
      depth--
      if (depth === 0 && start !== -1) {
        vpBlocks.push(cleaned.substring(start, i + 1))
        start = -1
      }
    }
  }

  // If we found viewpoint objects, try to parse each one individually
  if (vpBlocks.length >= 3) {
    const viewpoints = vpBlocks.map((block) => {
      // Try JSON.parse first for each block
      try { return JSON.parse(block) } catch (_) {}
      // Fallback: extract ALL fields we need
      return extractViewpointFields(block)
    }).filter((v: any) => v.title && v.title.length > 1)

    if (viewpoints.length >= 5) return { viewpoints }
  }

  throw new Error(`JSON解析失败，无法提取观点（仅找到${vpBlocks.length}个块）`)
}

/** Extract viewpoint fields from a raw JSON block that failed to parse */
function extractViewpointFields(block: string): any {
  const g = (key: string, fb = "") => {
    // Try multiple patterns for each key
    const patterns = [
      new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's'),
      new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`, 's'),
    ]
    for (const re of patterns) {
      const m = block.match(re)
      if (m) return m[1].replace(/\\"/g, '"').replace(/\\n/g, ' ')
    }
    return fb
  }
  const gn = (key: string, fb = 60) => {
    const m = block.match(new RegExp(`"${key}"\\s*:\\s*(\\d+\\.?\\d*)`))
    return m ? parseFloat(m[1]) : fb
  }
  const ga = (key: string): string[] => {
    const m = block.match(new RegExp(`"${key}"\\s*:\\s*\\[([^\\]]*)\\]`, 's'))
    if (!m) return []
    const items: string[] = []
    const r = /"([^"]*)"/g
    let mm
    while ((mm = r.exec(m[1])) !== null) items.push(mm[1])
    return items
  }

  // Evidence quotes — crucial field, try hard
  let eqs: any[] = []
  const eqBlock = block.match(/"evidenceQuotes"\s*:\s*\[([\s\S]*?)\](?=\s*[,}])/)
  if (eqBlock) {
    const inner = eqBlock[1]
    const objs = inner.match(/\{[^}]*\}/g) || []
    eqs = objs.map(o => ({
      text: g2(o, "text") || g2(o, "quote") || "",
      speaker: g2(o, "speaker") || "嘉宾",
      timestamp: g2(o, "timestamp") || "00:00:00",
    })).filter((e: any) => e.text.length > 5)
  }

  function g2(inner: string, key: string, fb = "") {
    const m = inner.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)"`))
    return m ? m[1] : fb
  }

  const confidence = gn("confidence", 70)
  const hotness = gn("hotness", 65)
  const levelStr = g("level", "")

  return {
    id: g("id", `vp_01`),
    title: g("title", ""),
    summary: g("summary", g("content", g("body", ""))),
    speaker: g("speaker", "嘉宾"),
    timestamp: g("timestamp", g("time", "00:00:00")),
    confidence,
    hotness,
    level: levelStr || (confidence >= 70 ? "high" : confidence >= 45 ? "mid" : "low"),
    evidence: eqs.length || gn("evidence", 1),
    keywords: ga("keywords"),
    category: g("category", g("dimension", "high_thought")),
    evidenceQuotes: eqs.length > 0 ? eqs : [{ text: g("summary", ""), speaker: g("speaker", "嘉宾"), timestamp: g("timestamp", "00:00:00") }],
    confidenceReason: g("confidenceReason", g("confidence_reason", "")),
    hotspotMatch: {
      matched: block.includes('"matched": true') || !!g("topic"),
      topic: g("topic", ""),
      score: gn("score", gn("relevance_score", hotness / 100)),
      reason: g("reason", g("match_reason", "")),
    },
    editorialFlags: {
      factCheckNeeded: block.includes('"factCheckNeeded": true') || block.includes('"fact_check_needed": true'),
      sensitiveContent: block.includes('"sensitiveContent": true') || block.includes('"sensitive_content": true'),
      needsHumanJudgment: block.includes('"needsHumanJudgment": true') || block.includes('"needs_human_judgment": true'),
      flagReason: g("flagReason", g("flag_reason", "")),
    },
    styleTags: ga("styleTags").length > 0 ? ga("styleTags") : ga("style_tags"),
  }
}

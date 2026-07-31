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

  // Repair trailing commas
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1")

  // Repair DeepSeek time range: "00:57:42 - 00:29:08" -> "00:57:42"
  cleaned = cleaned.replace(/"(\d{2}:\d{2}:\d{2})\s*[-–]\s*\d{2}:\d{2}:\d{2}"/g, '"$1"')

  // Try direct parse
  try { return JSON.parse(cleaned) } catch (_) {}

  // Aggressive repair: find all viewpoint-level JSON objects via regex
  // Match objects that have "id" or "title" as a key
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

  if (vpBlocks.length >= 5) {
    const viewpoints = vpBlocks.map((block) => {
      // Extract fields with regex (resilient to minor JSON issues)
      const getStr = (key: string, fallback = "") => {
        const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`)
        const m = block.match(re)
        return m ? m[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : fallback
      }
      const getNum = (key: string, fallback = 60) => {
        const re = new RegExp(`"${key}"\\s*:\\s*(\\d+\\.?\\d*)`)
        const m = block.match(re)
        return m ? parseFloat(m[1]) : fallback
      }
      const getBool = (key: string) => {
        const re = new RegExp(`"${key}"\\s*:\\s*(true|false)`)
        const m = block.match(re)
        return m ? m[1] === "true" : false
      }
      const getArray = (key: string): string[] => {
        const re = new RegExp(`"${key}"\\s*:\\s*\\[(.*?)\\]`, 's')
        const m = block.match(re)
        if (!m) return []
        // Extract all quoted strings from array
        const arr: string[] = []
        const strRe = /"((?:[^"\\\\]|\\\\.)*)"/g
        let match
        while ((match = strRe.exec(m[1])) !== null) {
          arr.push(match[1].replace(/\\"/g, '"'))
        }
        return arr
      }
      // Evidence quotes - try to parse as JSON array, fallback to regex
      let evidenceQuotes: any[] = []
      const eqRe = new RegExp(`"evidenceQuotes"\\s*:\\s*\\[(.*?)\\]`, 's')
      const eqMatch = block.match(eqRe)
      if (eqMatch) {
        const eqStr = `[${eqMatch[1]}]`
        try { evidenceQuotes = JSON.parse(eqStr) } catch {
          // Extract individual quote objects via regex
          const quoteBlocks = eqMatch[1].match(/\{[^}]*\}/g) || []
          evidenceQuotes = quoteBlocks.map(qb => {
            const textRe = /"(?:text|quote)"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/s
            const tm = qb.match(textRe)
            const spRe = /"speaker"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/
            const sm = qb.match(spRe)
            const tsRe = /"timestamp"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/
            const tsm = qb.match(tsRe)
            return {
              text: tm ? tm[1].replace(/\\"/g, '"') : "",
              speaker: sm ? sm[1] : "",
              timestamp: tsm ? tsm[1] : "00:00:00"
            }
          })
        }
      }

      const id = getStr("id", `vp_01`) || `vp_01`
      const title = getStr("title", "观点")
      const summary = getStr("summary", getStr("content", ""))
      const speaker = getStr("speaker", "嘉宾")
      const timestamp = getStr("timestamp", "00:00:00")
      const confidence = getNum("confidence", 70)
      const hotness = getNum("hotness", getNum("hotness", 60))
      const levelStr = getStr("level", "high")
      const level = ["high","mid","low"].includes(levelStr) ? levelStr : confidence > 75 ? "high" : confidence > 45 ? "mid" : "low"
      const keywords = getArray("keywords")
      const catStr = getStr("category", getStr("dimension", "high_thought"))
      const category = ["high_thought","current_answer","info_gap","low_only"].includes(catStr) ? catStr : level === "low" ? "low_only" : "high_thought"

      return {
        id, title, summary, speaker, timestamp,
        confidence, hotness, level,
        evidence: evidenceQuotes.length || getNum("evidence", 1),
        keywords,
        category,
        evidenceQuotes: evidenceQuotes.length > 0 ? evidenceQuotes : [{ text: summary, speaker, timestamp }],
        confidenceReason: getStr("confidenceReason", getStr("confidence_reason", "")),
        hotspotMatch: {
          matched: getBool("matched") || !!getStr("topic", ""),
          topic: getStr("topic", getStr("hotspot_topic", "")),
          score: getNum("score", getNum("relevance_score", hotness / 100)),
          reason: getStr("reason", getStr("match_reason", "")),
        },
        editorialFlags: {
          factCheckNeeded: getBool("factCheckNeeded") || getBool("fact_check_needed"),
          sensitiveContent: getBool("sensitiveContent") || getBool("sensitive_content"),
          needsHumanJudgment: getBool("needsHumanJudgment") || getBool("needs_human_judgment") || level !== "high",
          flagReason: getStr("flagReason", getStr("flag_reason", level !== "high" ? `置信度${confidence}%` : "")),
        },
        styleTags: getArray("styleTags").length > 0 ? getArray("styleTags") : getArray("style_tags"),
      }
    })

    return { viewpoints }
  }

  throw new Error(`JSON 解析失败，无法提取足够观点节点（仅找到 ${vpBlocks.length} 个JSON块）`)
}

import { NextResponse } from "next/server"
import { callAgent, extractJSON } from "@/lib/anthropic"
import { normalizeViewpoints } from "@/lib/viewpoint-normalizer"
import hotspotsData from "@/data/hotspots.json"

const SYSTEM_PROMPT = `你是笔记侠首席内容编辑。处理访谈逐字稿，提取结构化观点素材。

## 三个提取维度（每个维度至少2条，总数8-14条）

1. **high_thought（高维思想）**：嘉宾与主流观点有明显差异的洞察。
2. **current_answer（当下解答）**：嘉宾给出的具体建议或思考框架。
3. **info_gap（信息差）**：行业内部数据、具体案例、前沿实践。

## 反观点检测（counterpoint）
对每个观点，检查全文中是否有其他说话人的矛盾或不同意见。有就填，没有填null。

## 弱信号提取（weakSignals）
逐字稿中嘉宾随口提到但没有展开、但可能值得后续追踪的话题点。2-5个。

## 置信度标准
- high（85-95分）：原文逐句可回溯，有具体例子或数据。
- medium（45-65分）：嘉宾确实说了这个意思，但措辞含糊或引用未指明的外部数据。
- low（25-45分）：AI推测了未明说的含义，或原文极度含糊。

## 数量要求
8-14个观点。每个维度至少2条。`

function preprocessSRT(srt: string): string {
  const lines = srt.split("\n")
  const out: string[] = []
  let pendingTS = ""
  for (const line of lines) {
    const t = line.trim()
    if (/^\d+$/.test(t)) continue
    const tsMatch = t.match(/^(\d{2}:\d{2}:\d{2}),\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}$/)
    if (tsMatch) { pendingTS = tsMatch[1]; continue }
    if (pendingTS && t.length > 0) { out.push(`[${pendingTS}] ${line}`); pendingTS = "" }
    else if (t.length > 0) out.push(line)
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim()
}

export async function POST(req: Request) {
  try {
    const { srt } = await req.json()
    if (!srt) return NextResponse.json({ error: "缺少 SRT 文本" }, { status: 400 })

    // Build real hotspot context from timeline data
    const hotspots = hotspotsData.timeline
      .sort((a,b) => b.intensity - a.intensity)
      .map(h => `[${h.date}] ${h.event}（话题：${h.topics.join("、")}）`)
      .join("\n")

    const userMsg = `下面是访谈逐字稿：

${preprocessSRT(srt)}

## 2026年6-7月AI行业真实热点时间线（用于热点匹配）

${hotspots}

## 输出要求
请提取8-14个观点，每个维度至少2条。同时提取2-5个弱信号。输出完整JSON。

格式：{"viewpoints":[...],"suggestedTitle":"标题","suggestedSections":[...],"weakSignals":[...],"meta":{...}}

热点匹配要求：不是每个观点都要匹配，但要给出hotspotMatch字段。如果观点与上述热点时间线中的某个事件直接相关，matched填true，topic填具体事件（如"2026-07-28 Sam Altman预测2027年AGI雏形引发争论"），不要只写笼统词如"AI替代工作"。`

    const result = await callAgent(SYSTEM_PROMPT, userMsg, 32000)
    const data = extractJSON(result)
    const viewpoints = normalizeViewpoints(data)

    const suggestedTitle = data.suggestedTitle || ""
    const suggestedSections = data.suggestedSections || []
    const weakSignals = data.weakSignals || []

    if (viewpoints.length < 5) {
      return NextResponse.json({ error: `观点不足：仅${viewpoints.length}个`, viewpoints }, { status: 500 })
    }

    return NextResponse.json({ viewpoints, suggestedTitle, suggestedSections, weakSignals })
  } catch (e: any) {
    console.error("Agent 1 error:", e.message)
    return NextResponse.json({ error: e.message || "分析失败" }, { status: 500 })
  }
}

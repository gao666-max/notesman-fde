import { NextResponse } from "next/server"
import { callAgent, extractJSON } from "@/lib/anthropic"
import { normalizeViewpoints } from "@/lib/viewpoint-normalizer"

const SYSTEM_PROMPT = `你是笔记侠首席内容编辑。处理访谈逐字稿，提取结构化观点素材。

## 三个提取维度（每个维度至少2条，总数8-14条）

1. **high_thought（高维思想）**：嘉宾与主流观点有明显差异的洞察。别人说不出来的东西。
2. **current_answer（当下解答）**：嘉宾给出的具体建议或思考框架。读者看完能说"我知道该怎么做了"。
3. **info_gap（信息差）**：行业内部数据、具体案例、前沿实践。行外人不知道的东西。

强制要求：三个维度每个至少2条。如果某个维度真的找不到，在输出JSON的meta里标注原因。

## 反观点检测（counterpoint）

对每个观点，检查全文中是否有其他说话人的矛盾或不同意见。不要求每条都有。
- 嘉宾A说X，嘉宾B有没有说非X或对X有保留？
- 同一个嘉宾有没有在别处说了和这个观点不完全一致的话？
- 如果有，在 counterpoint 字段记录（说话人+原文摘要）。没有就填 null。

## 弱信号提取（weakSignals）

逐字稿中嘉宾随口提到但没有展开、但可能值得后续追踪的话题点。标准：
- 嘉宾提了一嘴但主持人没追问、嘉宾自己也没展开
- 置信度低但方向上有意思
- 可能是未来选题或延伸报道的线索
在输出的 weakSignals 数组中记录，格式：{topic:"话题", speaker:"说话人", timestamp:"时间戳", why:"为什么值得关注"}

## 置信度标准

- **high（85-95分）**：原文逐句可回溯，有具体例子或数据。
- **medium（45-65分）**：嘉宾确实说了这个意思，但措辞含糊或引用未指明的外部数据。
- **low（25-45分）**：AI推测了未明说的含义，或原文极度含糊。

## 热点匹配

对照以下热点判断相关性（0-100分）：AI替代工作/白领失业、AI编程工具改变了什么、AI教育：学校该禁AI还是拥抱AI、空间智能/具身智能/机器人、AI创业/融资/估值、AI时代的个人成长/职业规划、大模型价格战/开源vs闭源。70分以上才算匹配。

## 数量要求
8-14个观点。每个维度至少2条。宁可少不凑数。

## 输出格式（合法JSON，无包裹文字）

{"viewpoints":[...],"suggestedTitle":"12-20字有判断力的标题","suggestedSections":[{"id":"sec_intro","title":"引言标题"},{"id":"sec_body1","title":"正文一标题"},{"id":"sec_body2","title":"正文二标题"},{"id":"sec_outro","title":"结尾标题"},{"id":"sec_weak","title":"弱信号"}],"weakSignals":[{"topic":"话题","speaker":"说话人","timestamp":"00:00:00","why":"值得关注的原因"}],"meta":{"categoryCounts":{"high_thought":0,"current_answer":0,"info_gap":0}}}

suggestedTitle：有判断力，12-20字。
suggestedSections：5个章节（含弱信号专区），标题6-12字。
weakSignals：2-5个，嘉宾提过但没展开的有趣话题。`

const USER_TEMPLATE = `下面是访谈逐字稿（每段带时间戳和说话人）：

%s

请提取8-14个观点，确保三个维度每个至少2条。同时提取2-5个弱信号话题。输出完整JSON。每个观点必须有evidenceQuotes（至少1条原文引用+时间戳），如果有反观点填counterpoint字段（没有填null）。`

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

    const processed = preprocessSRT(srt)
    const result = await callAgent(SYSTEM_PROMPT, USER_TEMPLATE.replace("%s", processed), 32000)
    const data = extractJSON(result)
    const viewpoints = normalizeViewpoints(data)

    const suggestedTitle = data.suggestedTitle || data.suggested_title || ""
    const suggestedSections = data.suggestedSections || data.suggested_sections || []
    const weakSignals = data.weakSignals || data.weak_signals || []

    // Validate category distribution
    const cats: Record<string,number> = {}
    for (const vp of viewpoints) { cats[vp.category] = (cats[vp.category]||0)+1 }
    if (!cats["current_answer"] || cats["current_answer"] < 1) {
      console.warn(`Category imbalance: ${JSON.stringify(cats)}`)
    }

    if (viewpoints.length < 5) {
      return NextResponse.json({ error: `观点不足：仅${viewpoints.length}个`, viewpoints }, { status: 500 })
    }

    return NextResponse.json({ viewpoints, suggestedTitle, suggestedSections, weakSignals })
  } catch (e: any) {
    console.error("Agent 1 error:", e.message)
    return NextResponse.json({ error: e.message || "分析失败" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { callAgent, extractJSON } from "@/lib/anthropic"
import { normalizeViewpoints } from "@/lib/viewpoint-normalizer"
import hotspotsData from "@/data/hotspots.json"

const SYSTEM_PROMPT = `你是笔记侠首席内容编辑。你正在处理一份访谈逐字稿，需要为后续的写作环节提取结构化观点素材。

## 你的任务
通读逐字稿，识别并提取 10-15 个有发表价值的独立观点。每个观点必须是"一个可独立论述的判断"，不是"一段对话的摘要"。

## 三个提取维度

1. **high_thought（高维思想）**：嘉宾表述中与主流观点有明显差异的洞察。不是"AI很重要"这种泛泛而谈，是"别人说不出来"的东西。
2. **current_answer（当下解答）**：嘉宾针对具体问题给出的具体建议或思考框架。读者看完能说"我知道该怎么做了"。
3. **info_gap（信息差）**：嘉宾透露的行业内部数据、具体案例、前沿实践。行外人不知道的东西。没有的话可以少提或不提，不要硬凑。

## 因果链提取（causalChain）

对话中一个观点的完整逻辑往往是散落的——前5分钟讲现象，中间插例子，后面给结论。AI摘要容易把推理步骤丢掉，只剩"现象→结论"。

对每个观点，如果嘉宾的表述中包含因果推理，提取 causalChain。**要求至少 5 个观点带有 causalChain——大多数嘉宾观点都包含因果推理。** 只有纯事实陈述（"我用过Claude""我在硅谷待了17年"）或纯粹的行动建议（"你应该找年轻人做引路人"）才填null。

一个观点里到底有没有因果？检查标准：
- 嘉宾说"因为X，所以Y"→ 有因果
- 嘉宾说"如果不X，就会Y"→ 有因果
- 嘉宾说"X导致了Y，所以我们需要Z"→ 有因果
- 嘉宾说"以前是A，现在是B，这意味着C"→ 有因果
- 嘉宾只是描述事实"X公司做了Y产品"→ 无因果
- 嘉宾只是给建议"你应该去试试Z"→ 无因果

causalChain结构：
{
  "premise": "前提/现象是什么（1-2句）",
  "reasoning": "推理过程（因为A，所以B，导致C）",
  "conclusion": "结论是什么",
  "evidence": [{"segment":"说话人 时间戳", "text":"支撑因果链的原文"}],
  "missingSteps": ["这个因果链还缺什么？编辑应该注意什么逻辑断点？"]
}

missingSteps字段是关键——它不是指出嘉宾观点的缺陷，而是标注"AI在提取时是否漏掉了推理步骤"。如果嘉宾的推理是完整的，missingSteps写空数组[]。

## 观点间关系提取（relations，逻辑链）

观点不是孤立的——嘉宾的论证往往是一个观点推导出另一个。提取完观点后，为有明确逻辑关系的观点对添加 relations，把"扁平列表"变成"逻辑链"：

- **causal（因果）**：vp_A 是 vp_B 的前提/原因——"因为A，所以B"跨观点的推导关系
- **progressive（递进）**：vp_B 是 vp_A 的深化/延伸——同一话题的层层递进（先讲现象，再讲机制，再讲怎么办）
- **contrast（对比）**：vp_B 与 vp_A 构成对立或张力——两位嘉宾观点冲突，或同一嘉宾的"反常识"对照

要求：**至少 3 对 relations**，只标注逐字稿中明确可判断的关系，不要硬凑。每对格式：{"targetId":"vp_XX","type":"causal|progressive|contrast","reason":"关系说明（1句）"}

## 案例提取（case）

商业内容最有说服力的部分是案例，但案例不能只当"证据引用"用。识别嘉宾提到的具体案例（公司实践、个人经历、行业事件），单独建模并标注完整性：

- **background**：背景（当事人是谁、什么处境）
- **action**：行动（做了什么）
- **result**：结果（带来了什么变化）
- **completeness**：三要素齐全=complete；缺一个=partial；只言片语无法成案=unknown

要求：**至少 3 个观点带 case**。只有明确的案例叙述才提取；泛泛举例（"比如很多公司都这样"）填null。

## 置信度标准（影响后续编辑决策，请严格判断）

- **high（85-95分）**：原文可逐句回溯，嘉宾表述清晰，有具体例子或数据。"嘉宾A说'我自己用AI重写了整个CEO工具栈'"
- **medium（45-65分）**：嘉宾确实表达了这个意思，但措辞含糊、或引用了未指明来源的外部数据。"嘉宾B说教育成本从12000降到100，但没说数据来自哪项研究"
- **low（25-45分）**：AI推测了嘉宾未明说的含义，或原文极度含糊。low不是"这个观点不重要"，是"原文证据不充分"。

## 热点匹配

以下为2026年6-7月AI行业真实热点事件。对于每个观点，如果与下列具体事件直接相关，在hotspotMatch.topic中引用具体事件而非笼统词；不相关的填matched:false。

${hotspotsData.timeline.sort((a,b) => b.intensity-a.intensity).map(h => `- [${h.date}] ${h.event}`).join('\n')}

## 数量要求
提取 8-14 个有独立判断力的观点。宁可少一点也不要凑数的"正确废话"（如"AI很重要""我们要拥抱变化"这类）。如果逐字稿内容确实单薄，8个也可以。

## 输出格式
必须是合法JSON，不要有任何包裹文字。格式如下：

{"viewpoints":[...],"suggestedTitle":"根据内容自动生成的文章标题","suggestedSections":[{"id":"sec_intro","title":"引言标题"},{"id":"sec_body1","title":"正文一标题"},{"id":"sec_body2","title":"正文二标题"},{"id":"sec_outro","title":"结尾标题"}],"weakSignals":[{"topic":"话题","speaker":"说话人","timestamp":"00:00:00","why":"原因"}]}

suggestedTitle要求：从嘉宾原话中找最有冲击力的一句做标题。12-20字。必须是一个具体的判断，不能是主题描述。不要用"AI时代""从……到……""革命""生存法则""之道""驾驭""拥抱"这些AI味词汇。如果同一句嘉宾原话在逐字稿中反复出现，优先选它；但不要每次都选同一句——选最有反常识张力那句。
suggestedSections要求：根据内容的自然分段，给出4个章节标题，每个6-12字。
weakSignals：2-5个嘉宾提过但未展开的弱信号话题。

重要：
- 所有字符串值必须用双引号，字符串内的双引号用反斜杠转义
- evidenceQuotes里每条text必须是从SRT中原样摘录的原文（含完整时间戳）
- counterpoint字段：如果同场另一位嘉宾对此观点有不同看法，填写{ speaker:"说话人", summary:"不同意见摘要" }，没有则填null
- causalChain字段：大多数观点都包含因果推理。请为至少5个观点提取因果链。只有纯事实陈述或纯建议才填null。格式：{ premise:"前提", reasoning:"推理过程", conclusion:"结论", evidence:[{segment:"说话人 时间戳", text:"原文"}], missingSteps:["推理链断点"] }
- relations字段：观点间的逻辑关系（逻辑链），每个观点最多2条。格式：[{"targetId":"vp_XX","type":"causal|progressive|contrast","reason":"关系说明"}]。没有则填[]。请为至少3对观点建立关系。
- case字段：案例独立建模。格式：{ background:"背景", action:"行动", result:"结果", completeness:"complete|partial|unknown", evidence:"支撑案例的原文摘录" }。没有明确案例则填null。请为至少3个观点提取案例。
- 不要在JSON后面加任何文字`

const USER_TEMPLATE = `下面是访谈逐字稿（SRT格式，每段带说话人和时间戳）：

%s

请严格按照System Prompt的要求提取10-15个观点，输出完整JSON。记住：每个观点必须有evidenceQuotes（至少1条原文引用+时间戳），confidenceReason不能为空，hotspotMatch要有具体的matchReason。`

// Preprocess SRT: inline timestamps into speaker lines, strip numbering
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

    if (viewpoints.length < 5) {
      return NextResponse.json({ error: `观点不足：仅${viewpoints.length}个`, viewpoints }, { status: 500 })
    }

    return NextResponse.json({ viewpoints, suggestedTitle, suggestedSections, weakSignals })
  } catch (e: any) {
    console.error("Agent 1 error:", e.message)
    return NextResponse.json({ error: e.message || "分析失败" }, { status: 500 })
  }
}

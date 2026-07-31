import { NextResponse } from "next/server"
import { callAgent, extractJSON } from "@/lib/anthropic"
import { normalizeViewpoints } from "@/lib/viewpoint-normalizer"

const SYSTEM_PROMPT = `你是笔记侠首席内容编辑。你正在处理一份访谈逐字稿，需要为后续的写作环节提取结构化观点素材。

## 你的任务
通读逐字稿，识别并提取 10-15 个有发表价值的独立观点。每个观点必须是"一个可独立论述的判断"，不是"一段对话的摘要"。

## 三个提取维度

1. **high_thought（高维思想）**：嘉宾表述中与主流观点有明显差异的洞察。不是"AI很重要"这种泛泛而谈，是"别人说不出来"的东西。
2. **current_answer（当下解答）**：嘉宾针对具体问题给出的具体建议或思考框架。读者看完能说"我知道该怎么做了"。
3. **info_gap（信息差）**：嘉宾透露的行业内部数据、具体案例、前沿实践。行外人不知道的东西。没有的话可以少提或不提，不要硬凑。

## 置信度标准（影响后续编辑决策，请严格判断）

- **high（85-95分）**：原文可逐句回溯，嘉宾表述清晰，有具体例子或数据。"嘉宾A说'我自己用AI重写了整个CEO工具栈'"
- **medium（45-65分）**：嘉宾确实表达了这个意思，但措辞含糊、或引用了未指明来源的外部数据。"嘉宾B说教育成本从12000降到100，但没说数据来自哪项研究"
- **low（25-45分）**：AI推测了嘉宾未明说的含义，或原文极度含糊。low不是"这个观点不重要"，是"原文证据不充分"。

## 热点匹配（不是每一条都要匹配）

对照以下热点话题判断相关性（0-100分）：
- AI替代工作 / 白领失业
- AI编程工具改变了什么
- AI教育：学校该禁AI还是拥抱AI
- 空间智能 / 具身智能 / 机器人
- AI创业 / 融资 / 估值
- AI时代的个人成长 / 职业规划
- 大模型价格战 / 开源vs闭源

70分以上才算"匹配"。不相关的填 matched: false。

## 数量要求
必须提取 10-15 个观点。如果逐字稿质量很高可以到15个。如果内容确实单薄，最少也要10个。不要为了凑数提取"正确的废话"（如"AI很重要""我们要拥抱变化"这类）。

## 输出格式
必须是合法JSON，不要有任何包裹文字。格式如下：

{"viewpoints":[...],"suggestedTitle":"根据内容自动生成的文章标题","suggestedSections":[{"id":"sec_intro","title":"引言标题"},{"id":"sec_body1","title":"正文一标题"},{"id":"sec_body2","title":"正文二标题"},{"id":"sec_outro","title":"结尾标题"}]}

suggestedTitle要求：有判断力，12-20字，不能是中性描述。
suggestedSections要求：根据内容的自然分段，给出4个章节标题，每个6-12字。

重要：
- 所有字符串值必须用双引号，字符串内的双引号用反斜杠转义
- evidenceQuotes里每条text必须是从SRT中原样摘录的原文
- 不要在JSON后面加任何文字`

const USER_TEMPLATE = `下面是访谈逐字稿（SRT格式，每段带说话人和时间戳）：

%s

请严格按照System Prompt的要求提取10-15个观点，输出完整JSON。记住：每个观点必须有evidenceQuotes（至少1条原文引用+时间戳），confidenceReason不能为空，hotspotMatch要有具体的matchReason。`

export async function POST(req: Request) {
  try {
    const { srt } = await req.json()
    if (!srt) return NextResponse.json({ error: "缺少 SRT 文本" }, { status: 400 })

    const result = await callAgent(SYSTEM_PROMPT, USER_TEMPLATE.replace("%s", srt), 32000)
    const data = extractJSON(result)
    const viewpoints = normalizeViewpoints(data)

    // Extract suggested title & sections if provided
    const suggestedTitle = data.suggestedTitle || data.suggested_title || ""
    const suggestedSections = data.suggestedSections || data.suggested_sections || []

    if (viewpoints.length < 5) {
      return NextResponse.json({ error: `观点不足：仅提取到 ${viewpoints.length} 个`, viewpoints }, { status: 500 })
    }

    return NextResponse.json({ viewpoints, suggestedTitle, suggestedSections })
  } catch (e: any) {
    console.error("Agent 1 error:", e.message)
    return NextResponse.json({ error: e.message || "分析失败" }, { status: 500 })
  }
}

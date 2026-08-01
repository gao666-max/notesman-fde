import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"

const SYSTEM_PROMPT = `你是笔记侠首席撰稿人。基于编辑选定的观点节点，写出600-850字的商业深度文章。

## 文章格式（必须严格遵守）

输出纯文本文章，按以下格式：

[标题]

内容来源：[来源文件名]
责编 | 待定
第 X 篇深度好文：XXX字 | X 分钟阅读
分类：商业思维 / AI与未来

笔记君说：
[一句话推荐语，30字以内，给读者一个停下来的理由]

[正文开始]

正文自然分段，每段之间空一行。不用 # * > 等markdown标记。

## 标题要求

必须有反常识张力。好的标题是一个具体的判断。
✅ "AI不会淘汰人，但会淘汰没有能动性的人"
✅ "工业革命从未自动化劳动，AI也不会"
✅ "当所有人争论AI会不会取代你，她给出了一个更危险的答案"
❌ "AI时代的XX革命""从……到……""拥抱XX""新时代""生存法则""之道""驾驭"

## 正文要求

1. **字数**：600-850字正文（不含标题和元信息行）
2. **每个章节至少展开一个自然段**
3. **数据论断用审慎表述**：对"待核实"观点用"据嘉宾引用的研究显示""嘉宾给出的对比数据是"
4. **段落因果递进**，不是列清单
5. **嘉宾称呼有变化**：嘉宾A → "这位AI科学家""她"，嘉宾B → "这位在线教育老兵""他"
6. **正文不出时间戳**（如00:26:04）
7. **结尾回到行动**，不要"综上所述"
8. **输出纯文本**，不要markdown标记`

const USER_MSG = `文章目标标题：%s
素材来源：%s

编辑选定的大纲结构：

%s

请根据以上大纲生成一篇笔记侠风格的商业深度文章。必须包含：标题、内容来源行、责编行、第X篇深度好文行、笔记君说行，然后是正文。正文600-850字。`;

export async function POST(req: Request) {
  try {
    const { title, viewpoints, sections, sourceName } = await req.json()
    if (!viewpoints || !sections) return NextResponse.json({ error: "缺少数据" }, { status: 400 })

    let sectionCtx = ""
    for (const sec of sections) {
      if (!sec.itemIds || sec.itemIds.length === 0) continue
      sectionCtx += "### " + sec.title + "\n\n"
      for (const vpId of sec.itemIds) {
        const vp = viewpoints.find((v: any) => v.id === vpId)
        if (!vp) continue
        sectionCtx += "【观点】" + vp.title + "\n"
        sectionCtx += "【说话人】" + vp.speaker + " | " + (vp.timestamp || "") + "\n"
        sectionCtx += "【摘要】" + vp.summary + "\n"
        sectionCtx += "【置信度】" + vp.level + "（" + vp.confidence + "%）\n"
        for (const eq of (vp.evidenceQuotes || []).slice(0, 2)) {
          sectionCtx += "  证据：[ " + eq.timestamp + " ] " + eq.text + "\n"
        }
        if (vp.editorialFlags && vp.editorialFlags.factCheckNeeded) {
          sectionCtx += "【⚠ 待核实】" + vp.editorialFlags.flagReason + "\n"
        }
        sectionCtx += "\n"
      }
    }

    const userMsg = USER_MSG.replace("%s", title).replace("%s", sourceName || "访谈逐字稿").replace("%s", sectionCtx)

    const article = await callAgent(SYSTEM_PROMPT, userMsg, 8000)
    return NextResponse.json({ article })
  } catch (e: any) {
    console.error("Agent 3 error:", e)
    return NextResponse.json({ error: e.message || "生成失败" }, { status: 500 })
  }
}

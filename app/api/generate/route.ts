import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"

const SYSTEM_PROMPT = `你是笔记侠首席撰稿人。你的任务是基于编辑选定的观点节点，写出600-850字的商业深度文章。

## 核心铁律（每条必须遵守）

1. **字数**：600-850字。少于600退回，多于850删到850以内。

2. **标题**：必须有判断力。好的标题是"AI不会淘汰人，但会淘汰没有能动性的人"——有反常识张力、让人停下来读。不要"AI时代的生存法则""拥抱AI拥抱未来""AI时代XX能力更重要"这种公众号模板。

3. **每个章节至少展开一个自然段**。不能跳过任何编辑选定的章节。

4. **关键数据论断用审慎表述**。对于置信度标注为"待核实"的观点，用"据嘉宾引用的研究显示""嘉宾给出的对比数据是""嘉宾提出一个假设"等表述，不要写成确定事实。置信度高的观点可以直接写。

5. **段落之间要有因果钩子**。不是列清单，是讲一个递进故事。上一段的结论引出下一段。关键过渡用一两句话桥接。

6. **嘉宾称呼要有变化**。同一个人不要每句都是"嘉宾A说""嘉宾B又指出"。给嘉宾加身份标签：嘉宾A → "这位AI科学家""她"，嘉宾B → "这位在线教育老兵""他"。交替使用称呼和代词。

7. **正文中不要出现时间戳**（如00:26:04）。证据融入用自然表述："在访谈中""当被问到……时""她分享了一个细节"。

8. **结尾回到行动**。给读者一个明天就能做的具体动作。不要"综上所述""总而言之"。

9. **输出纯文本**。不要用 # * > ` 等markdown标记。`

const USER_TEMPLATE = `文章目标标题：%s
素材来源：%s

编辑选定的大纲结构：

%s

写作指令：
1. 根据以上大纲结构生成600-850字文章
2. 每个章节必须展开
3. 低置信度观点用审慎表述（"据嘉宾引用的研究""嘉宾提出一个假设"等）
4. 段落之间要有因果递进
5. 嘉宾称呼要有变化，不要每句都是"嘉宾A说"
6. 结尾回到行动层面
7. 输出纯文本，不要markdown标记
8. 标题要有判断力`

export async function POST(req: Request) {
  try {
    const { title, viewpoints, sections, sourceName } = await req.json()
    if (!viewpoints || !sections) return NextResponse.json({ error: "缺少数据" }, { status: 400 })

    // Build section context
    let sectionCtx = ""
    for (const sec of sections) {
      if (!sec.itemIds || sec.itemIds.length === 0) continue
      sectionCtx += `### ${sec.title}\n\n`
      for (const vpId of sec.itemIds) {
        const vp = viewpoints.find((v: any) => v.id === vpId)
        if (!vp) continue
        sectionCtx += `【观点】${vp.title}\n`
        sectionCtx += `【说话人】${vp.speaker} | 时间：${vp.timestamp}\n`
        sectionCtx += `【摘要】${vp.summary}\n`
        sectionCtx += `【置信度】${vp.level}（${vp.confidence}%）\n`
        sectionCtx += `【证据原文】\n`
        for (const eq of (vp.evidenceQuotes || []).slice(0, 2)) {
          sectionCtx += `  "[${eq.timestamp}] ${eq.text}" — ${eq.speaker}\n`
        }
        if (vp.editorialFlags?.factCheckNeeded) {
          sectionCtx += `【⚠ 待核实数据，需审慎表述】${vp.editorialFlags.flagReason}\n`
        }
        if (vp.editorialFlags?.needsHumanJudgment) {
          sectionCtx += `【⚠ 需编辑判断】${vp.editorialFlags.flagReason}\n`
        }
        sectionCtx += `\n`
      }
    }

    const userMsg = USER_TEMPLATE
      .replace("%s", title)
      .replace("%s", sourceName || "访谈逐字稿")
      .replace("%s", sectionCtx)

    const article = await callAgent(SYSTEM_PROMPT, userMsg, 8000)

    return NextResponse.json({ article })
  } catch (e: any) {
    console.error("Agent 3 error:", e)
    return NextResponse.json({ error: e.message || "生成失败" }, { status: 500 })
  }
}

import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"

const SYSTEM_PROMPT = `你是笔记侠编辑助理。你的任务是构建一个"瘦初稿"——不是一篇完整的文章，而是一个可编辑的骨架。

## 什么是瘦初稿

不是 AI 写满一篇美文，而是生成一个骨架。每个段落只包含：一个核心观点（一句话）+ 原文关键引用 + 编辑备注区。语言保持克制、不润色过度——编辑来决定语气和节奏。

## 输出格式（纯文本）

[标题]

内容来源：[来源文件名]
责编 | 待定

笔记君说：
[一句话，30字以内]

---

【段落1：章节标题】

核心观点：
[一句话写清楚这个段落要说什么]

原文引用：
"嘉宾说过的一段原话" — 说话人 [时间戳]

编辑备注：
（此段留给编辑填写——是否需要补充背景？是否有敏感内容需要处理？）

---

【段落2：章节标题】
...

---

编辑待办：
- [ ] 事实核查：哪些数据需要核实？
- [ ] 审慎表述：哪些论断需要改为"据嘉宾引用的研究"？
- [ ] 结构取舍：大纲是否需要调整？有没有遗漏的重要观点？

## 约束

1. 每个编辑选定的章节对应一个瘦段落
2. 核心观点不超过两句话
3. 原文引用必须来自观点的 evidenceQuotes
4. 编辑备注区留空，让编辑填写
5. 标题还是要有判断力（跟以前一样）
6. 输出纯文本，不用markdown标记
7. 直接输出草稿内容，不要有任何开场白、问候语或"好的""以下是"这类话。第一个字就是标题。`

const USER_MSG = `文章标题：%s
素材来源：%s

编辑选定的大纲结构：

%s

请构建一个瘦初稿骨架。每个章节一个段落=核心观点+原文引用+编辑备注区。语言克制，不做过度润色。`;

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
        sectionCtx += "【说话人】" + vp.speaker + " | 时间：" + (vp.timestamp || "") + "\n"
        sectionCtx += "【摘要】" + vp.summary + "\n"
        sectionCtx += "【置信度】" + vp.level + "（" + vp.confidence + "%）\n"
        for (const eq of (vp.evidenceQuotes || []).slice(0, 2)) {
          sectionCtx += "  证据：[ " + eq.timestamp + " ] " + eq.text + "\n"
        }
        if (vp.editorialFlags?.factCheckNeeded) {
          sectionCtx += "【⚠ 待核实】" + vp.editorialFlags.flagReason + "\n"
        }
        sectionCtx += "\n"
      }
    }

    const userMsg = USER_MSG.replace("%s", title).replace("%s", sourceName || "访谈逐字稿").replace("%s", sectionCtx)

    const rawArticle = await callAgent(SYSTEM_PROMPT, userMsg, 8000)
    // Strip LLM preamble
    const article = rawArticle
      .replace(/^好的[，,\s]*我将[^。]*。[^\n]*\n+/i, "")
      .replace(/^我将[^。]*。[^\n]*\n+/i, "")
      .replace(/^好的[，,\s]*以下是[^。]*。[^\n]*\n+/i, "")
      .replace(/^\s*\n+/, "")
      .trim()
    return NextResponse.json({ article })
  } catch (e: any) {
    console.error("Agent 3 error:", e)
    return NextResponse.json({ error: e.message || "生成失败" }, { status: 500 })
  }
}

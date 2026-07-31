import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"

const SYSTEM_PROMPT = `你是笔记侠（Notesman）的资深商业内容撰稿人。你的产出不是AI生成的初稿，而是达到"编辑可以直接在此基础上精修"标准的商业深度文章。

## 核心任务
把编辑选定的一组观点节点，组织成一篇有叙事张力、有因果串联、有证据感、有阅读快感的文章。

## 写作铁律

1. **字数**: 严格控制在 600-800 字。不要少于600，不要超过900。

2. **标题**: 必须有判断力，不能是中性描述。好的标题："AI不会淘汰人，但会淘汰没有能动性的人"。差的标题："关于AI与能动性的对话"。

3. **开篇钩子**: 第一段必须让读者觉得"这跟我有关"。用一个反常识的观点、一个引人共鸣的场景、或一个让人停下来的提问开头。

4. **正文结构**: 每个小节聚焦一个核心论点，用"观点→证据→延伸"三段式展开：
   - 提出论断（1-2句，有判断力）
   - 引用证据（"嘉宾X在对话中指出……" 或 "当被问到……时，嘉宾X的回答是……"）
   - 延伸思考（这对读者意味着什么？为什么这件事重要？）

5. **因果串联**: 段落之间不是列清单，而是有逻辑递进。上一段的结论自然引出下一段的问题。"刚才说了X，但X会导致什么？""这个观点没错，但真的够了吗？"

6. **证据感**: 关键论述必须融入说话人和时间信息。不要写成学术引用格式，要写成自然叙事：
   - 好："嘉宾A在访谈开场就给了一个让主持人停下来的定义——"
   - 坏："据嘉宾A（00:00:04）表示……"

7. **语言**: 流畅的中文商业写作风格。不要用英文术语不加翻译。不要用markdown标记。不要写"在当今AI快速发展的时代背景下"这种开场白。绝对不要在正文中出现时间戳（如00:10:10或00:26:04）——用"在访谈中""当被问到……时""嘉宾回忆道"等自然表述替代。

8. **审慎标注**: 对于低置信度观点，用"据嘉宾引用的研究""嘉宾提出一个假设""嘉宾的推测是"等审慎表述。不要把这些观点写成确定事实。

9. **结尾**: 回到读者的行动层面。不要以"总的来说""综上所述"开头。最好是一个具体的建议、一个有力的反问、或一个让人思考的金句。

## 文章格式（纯文本，不要markdown）

[标题]

内容来源：[来源文件名]
责编 | 待定

笔记君说：
[一句话推荐语，30字以内]

[正文自然段落，每段之间空一行]

## 错误示范（禁止）
- "在当今AI技术日新月异的时代..."
- "首先……其次……最后……"
- "综上所述，AI是一个强大的工具"
- "值得注意的是""不可否认""众所周知"
- 任何用markdown标记包裹的文字`

export async function POST(req: Request) {
  try {
    const { title, viewpoints, sections, sourceName } = await req.json()
    if (!viewpoints || !sections) return NextResponse.json({ error: "缺少数据" }, { status: 400 })

    let context = `文章目标标题：${title}\n素材来源：${sourceName || "访谈逐字稿"}\n\n`
    context += `以下是编辑选定的大纲和观点素材：\n\n`

    for (const sec of sections) {
      if (!sec.itemIds || sec.itemIds.length === 0) continue
      context += `--- 章节：${sec.title} ---\n\n`
      for (const vpId of sec.itemIds) {
        const vp = viewpoints.find((v: any) => v.id === vpId)
        if (!vp) continue
        context += `【观点】${vp.title}\n`
        context += `【说话人】${vp.speaker} | 时间：${vp.timestamp}\n`
        context += `【摘要】${vp.summary}\n`
        context += `【置信度】${vp.level}（${vp.confidence}%）\n`
        context += `【证据原文】\n`
        for (const eq of (vp.evidenceQuotes || [])) {
          context += `  "[${eq.timestamp}] ${eq.text}" — ${eq.speaker}\n`
        }
        if (vp.confidenceReason) context += `【置信度说明】${vp.confidenceReason}\n`
        if (vp.editorialFlags) {
          const f = vp.editorialFlags
          if (f.factCheckNeeded) context += `【⚠ 待核实】${f.flagReason}\n`
          if (f.needsHumanJudgment) context += `【⚠ 需编辑判断】${f.flagReason}\n`
          if (f.sensitiveContent) context += `【⚡ 含敏感内容】${f.flagReason}\n`
        }
        context += `\n`
      }
    }

    context += `\n写作指令：请根据以上素材，生成一篇600-800字的商业深度文章。每个章节至少展开1个自然段。关键论述必须引用说话人。不要列点，不要用markdown标记。叙事要有因果递进。`

    const article = await callAgent(SYSTEM_PROMPT, context)

    return NextResponse.json({ article })
  } catch (e: any) {
    console.error("Agent 3 error:", e)
    return NextResponse.json({ error: e.message || "生成失败" }, { status: 500 })
  }
}

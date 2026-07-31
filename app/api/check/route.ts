import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"

const SYSTEM_PROMPT = `你是笔记侠的事实核查编辑。你的任务是逐条检查文章中的关键论述，比对原始证据，找出需要编辑确认的问题。

检查清单：
1. 文章中的每个论断是否能回到原始证据（逐字稿中的原文和时间戳）？
2. AI有没有把"可能""假设""我猜测"改成"一定""必然""事实证明"？
3. 说话人归属是否正确？有没有把嘉宾A的话写成嘉宾B？
4. 涉及具体数字、日期、金额、公司名的论断，标注需核实
5. 表述是否引发恐惧或争议，标注敏感内容

输出格式（纯文本，不要markdown）：
【核查概览】
本文基于X个观点节点生成，共发现Y处需要编辑关注的问题。

【逐条核查】
1. [观点标题]
   - 原文证据：[时间戳] "原文引用..."
   - 文章表述：[文章中的相关句子]
   - 问题：[什么问题]
   - 建议：[怎么改]

【整体评估】
- 事实准确度：高/中/低
- 需要发稿前确认的项：[列出]
- 可以后续迭代处理的项：[列出]`

export async function POST(req: Request) {
  try {
    const { article, viewpoints } = await req.json()
    if (!article || !viewpoints) return NextResponse.json({ error: "缺少数据" }, { status: 400 })

    // Gather evidence context
    let evidence = "以下是观点节点及其原始证据：\n\n"
    for (const vp of viewpoints) {
      evidence += `[${vp.id}] ${vp.title}\n`
      evidence += `说话人：${vp.speaker} | 时间：${vp.timestamp}\n`
      for (const eq of vp.evidenceQuotes || []) {
        evidence += `  证据：[${eq.speaker} ${eq.timestamp}] "${eq.text}"\n`
      }
      evidence += `\n`
    }

    const userMsg = `请核查以下文章：\n\n---\n${article}\n---\n\n${evidence}`

    const report = await callAgent(SYSTEM_PROMPT, userMsg)

    return NextResponse.json({ report })
  } catch (e: any) {
    console.error("Agent 4 error:", e)
    return NextResponse.json({ error: e.message || "核查失败" }, { status: 500 })
  }
}

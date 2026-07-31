import { NextResponse } from "next/server"
import { callAgent } from "@/lib/anthropic"

const SYSTEM_PROMPT = `你是笔记侠的资料编辑。你手上有过往的历史商业笔记，每当有新选题时，你需要判断哪些历史内容可以复用、哪些不能。

判断标准：
1. 内容唯一性：这篇历史笔记和当前逐字稿是同一场访谈吗？是→不复用
2. 时效性：笔记日期距今多久？超过1年→仅背景参考
3. 读者匹配：适用读者和当前目标读者重叠吗？
4. 引用范围：笔记的可引用范围允许当前用途吗？
5. 观点增强：这篇笔记能补充或强化当前观点吗？

输出格式（纯文本）：
对每篇历史笔记逐一给出判定：

笔记X：[标题]（日期）
- 判定：不复用 / 有限复用 / 明确复用
- 理由：[具体原因]
- 如可复用，对应当前哪些观点节点？[列出vp_id]
- 注意事项：[任何编辑需要注意的问题]`

export async function POST(req: Request) {
  try {
    const { viewpoints, notes } = await req.json()
    if (!viewpoints) return NextResponse.json({ error: "缺少数据" }, { status: 400 })

    // Summarize viewpoints
    let vpSummary = "当前观点节点：\n"
    for (const vp of viewpoints) {
      vpSummary += `[${vp.id}] ${vp.title} | ${vp.speaker} | 主题：${vp.keywords?.join(", ") || ""}\n`
    }

    // Notes context
    const notesText = notes && notes.length > 0
      ? notes.map((n: any, i: number) => {
          const title = n.标题 || n.title || `笔记${i+1}`
          const date = n.日期 || n.date || "未知"
          const topic = n.主题 || n.topic || ""
          const readers = n.适用读者 || n.readers || ""
          const scope = n.可引用范围 || n.quoteScope || ""
          const body = (n.正文 || n.body || "").substring(0, 800)
          return `--- 笔记${i+1} ---\n标题：${title}\n日期：${date}\n主题：${topic}\n读者：${readers}\n引用范围：${scope}\n正文预览：${body}`
        }).join("\n\n")
      : "（无历史笔记数据）"

    const userMsg = `${vpSummary}\n\n历史笔记数据：\n${notesText}`

    const result = await callAgent(SYSTEM_PROMPT, userMsg)

    return NextResponse.json({ suggestions: result })
  } catch (e: any) {
    console.error("Agent 2 error:", e)
    return NextResponse.json({ error: e.message || "复用判断失败" }, { status: 500 })
  }
}

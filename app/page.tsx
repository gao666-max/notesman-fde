"use client"

import { useMemo, useState, useCallback, useRef } from "react"
import type { OutlineSection, Viewpoint } from "@/lib/types"
import { INITIAL_SECTIONS, VIEWPOINTS as MOCK_VIEWPOINTS } from "@/lib/mock-data"
import { Toolbar } from "@/components/toolbar"
import { FilterBar, type Filters } from "@/components/filter-bar"
import { QuadrantOverview } from "@/components/quadrant-overview"
import { CardLibrary } from "@/components/card-library"
import { EditorWorkspace } from "@/components/editor-workspace"
import { StatusBar } from "@/components/status-bar"
import { DetailModal } from "@/components/detail-modal"
import { localGenerateDraft, localGenerateFactCheck } from "@/lib/local-generators"

export default function Page() {
  const [viewpoints, setViewpoints] = useState<Viewpoint[]>(MOCK_VIEWPOINTS)
  const [sections, setSections] = useState<OutlineSection[]>(INITIAL_SECTIONS)
  const [activeSectionId, setActiveSectionId] = useState<string>(INITIAL_SECTIONS[0].id)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [title, setTitle] = useState("AI不会淘汰人，但会淘汰没有能动性的人")
  const [filters, setFilters] = useState<Filters>({ query: "", speaker: "all", level: "all", sort: "hot" })
  const [sourceName, setSourceName] = useState("interview_transcript.srt · 预置数据")
  const [status, setStatus] = useState<"idle" | "analyzing" | "done">("done")
  const [srtContent, setSrtContent] = useState<string | null>(null)
  const [notesContent, setNotesContent] = useState<any[] | null>(null)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [loadingCheck, setLoadingCheck] = useState(false)
  const [toastMsg, setToastMsg] = useState("")
  const [cachedArticle, setCachedArticle] = useState("")
  const [srtLines, setSrtLines] = useState<{ts: string; speaker: string; text: string}[]>([])
  const [weakSignals, setWeakSignals] = useState<{topic:string;speaker:string;timestamp:string;why:string}[]>([])

  function buildSrtLookup(raw: string) {
    const lines: {ts: string; speaker: string; text: string}[] = []
    let pendingTS = ""
    for (const line of raw.split("\n")) {
      const t = line.trim()
      if (/^\d+$/.test(t)) continue
      const tsM = t.match(/^(\d{2}:\d{2}:\d{2}),\d{3}\s*-->/)
      if (tsM) { pendingTS = tsM[1]; continue }
      if (pendingTS && t.length > 1) {
        const colon = t.indexOf("：")
        const speaker = colon > 0 ? t.substring(0, colon) : ""
        const text = colon > 0 ? t.substring(colon + 1) : t
        lines.push({ ts: pendingTS, speaker, text })
        pendingTS = ""
      }
    }
    setSrtLines(lines)
  }

  function getContext(ts: string, range = 30): {ts: string; speaker: string; text: string}[] {
    if (!srtLines.length) return []
    let idx = 0
    for (let i = 0; i < srtLines.length; i++) {
      if (srtLines[i].ts >= ts) { idx = i; break }
    }
    const start = Math.max(0, idx - 3)
    const end = Math.min(srtLines.length, idx + 4)
    return srtLines.slice(start, end)
  }

  const allViewpoints = useMemo(() => {
    const ws = (weakSignals || []).map((w, i) => ({
      id: `ws_${String(i+1).padStart(2,"0")}`,
      title: w.topic,
      summary: w.why,
      speaker: w.speaker,
      timestamp: w.timestamp,
      confidence: 25,
      hotness: 50,
      level: "low" as ConfidenceLevel,
      evidence: 0,
      keywords: [],
      category: "weak_signal" as CategoryId,
      evidenceQuotes: [{ text: w.why, speaker: w.speaker, timestamp: w.timestamp }],
      confidenceReason: "弱信号：嘉宾提过但未展开，置信度低但方向值得关注",
      hotspotMatch: { matched: false, topic: "", score: 0, reason: "" },
      editorialFlags: { factCheckNeeded: false, sensitiveContent: false, needsHumanJudgment: true, flagReason: "访谈中的弱信号，嘉宾未展开，需要编辑判断是否追踪" },
      styleTags: [],
    }))
    return [...viewpoints, ...ws]
  }, [viewpoints, weakSignals])

  // Rebuild allById to include weak signals
  const allById = useMemo(() => new Map(allViewpoints.map((v) => [v.id, v])), [allViewpoints])
  const speakers = useMemo(() => Array.from(new Set(allViewpoints.map((v) => v.speaker))), [allViewpoints])
  const assignedIds = useMemo(() => new Set(sections.flatMap((s) => s.itemIds)), [sections])

  const libraryViewpoints = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    let list = allViewpoints.filter((v) => !assignedIds.has(v.id))
    if (q) {
      list = list.filter((v) =>
        v.title.toLowerCase().includes(q) ||
        v.summary.toLowerCase().includes(q) ||
        v.keywords.some((k) => k.toLowerCase().includes(q)),
      )
    }
    if (filters.speaker !== "all") list = list.filter((v) => v.speaker === filters.speaker)
    if (filters.level !== "all") list = list.filter((v) => v.level === filters.level)
    const sorted = [...list]
    if (filters.sort === "hot") sorted.sort((a, b) => b.hotness - a.hotness)
    else if (filters.sort === "confidence") sorted.sort((a, b) => b.confidence - a.confidence)
    else sorted.sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    return sorted
  }, [viewpoints, assignedIds, filters])

  const selectedVp = useMemo(() => {
    if (!selectedId) return null
    return allById.get(selectedId) || null
  }, [selectedId, allById])

  const toast = (msg: string) => { setToastMsg(msg); setTimeout(() => setToastMsg(""), 3000) }

  // --- mutations ---
  function assignToSection(sectionId: string, vpId: string) {
    setSections((prev) => prev.map((s) => ({
      ...s,
      itemIds: s.id === sectionId ? (s.itemIds.includes(vpId) ? s.itemIds : [...s.itemIds, vpId]) : s.itemIds.filter((id) => id !== vpId),
    })))
  }
  function addManyToActive(ids: string[]) {
    setSections((prev) => prev.map((s) => {
      if (s.id !== activeSectionId) return { ...s, itemIds: s.itemIds.filter((id) => !ids.includes(id)) }
      const merged = [...s.itemIds]
      for (const id of ids) if (!merged.includes(id)) merged.push(id)
      return { ...s, itemIds: merged }
    }))
  }
  function removeFromOutline(vpId: string) {
    setSections((prev) => prev.map((s) => ({ ...s, itemIds: s.itemIds.filter((id) => id !== vpId) })))
  }

  // --- IMPORT SRT → Agent 1 ---
  const handleImportSRT = useCallback(async (text: string, filename: string) => {
    setSrtContent(text)
    setSourceName(filename)
    setStatus("analyzing")
    toast("Agent 1 分析中（约 30-50 秒），请稍候…")
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srt: text }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (data.viewpoints && data.viewpoints.length > 0) {
        setViewpoints(data.viewpoints)
        setStatus("done")
        // Auto-update title if Agent 1 suggests one
        if (data.suggestedTitle) setTitle(data.suggestedTitle)
        // Auto-update section structure if Agent 1 suggests sections
        if (data.suggestedSections && data.suggestedSections.length > 0) {
          setSections(data.suggestedSections.map((s: any, i: number) => ({
            id: s.id || `sec_${i}`,
            title: s.title || s.label || `章节${i+1}`,
            itemIds: s.itemIds || [],
          })))
        } else {
          setSections(INITIAL_SECTIONS.map(s => ({ ...s, itemIds: [] })))
        }
        buildSrtLookup(text)
        if (data.weakSignals) setWeakSignals(data.weakSignals)
        toast(`分析完成：${data.viewpoints.length} 个观点`)
      } else {
        throw new Error("未提取到观点")
      }
    } catch (e: any) {
      toast(`分析失败：${e.message}`)
      setStatus("done")
    }
  }, [])

  // --- IMPORT NOTES → Agent 2 ---
  const handleImportNotes = useCallback(async (data: any[]) => {
    setNotesContent(data)
    setStatus("analyzing")
    toast("Agent 2 正在判断复用…")
    try {
      const res = await fetch("/api/reuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viewpoints, notes: data }),
      })
      if (!res.ok) throw new Error(await res.text())
      const result = await res.json()
      const suggestions = result.report || ""
      const blob = new Blob([suggestions], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "reuse_suggestions.txt"; a.click()
      URL.revokeObjectURL(url)

      // Apply confidence adjustments from Agent 2 back to viewpoints
      if (result.confidenceAdjustments) {
        setViewpoints((prev: any[]) => prev.map((vp: any) => ({
          ...vp,
          confidence: result.confidenceAdjustments[vp.id] || vp.confidence,
          confidenceReason: result.confidenceAdjustments[vp.id] && result.confidenceAdjustments[vp.id] !== vp.confidence
            ? `${vp.confidenceReason}（经历史素材校验后调整）`
            : vp.confidenceReason,
        })))
      }
      setStatus("done")
      toast(`✅ 复用判断完成，报告已下载`)
    } catch (e: any) {
      toast(`Agent 2 暂时不可用：${e.message}`)
      setStatus("done")
    }
  }, [viewpoints])

  // --- REANALYZE ---
  const handleReanalyze = useCallback(async () => {
    if (!srtContent) { toast("请先导入 SRT 文件"); return }
    setStatus("analyzing")
    toast("重新分析中…")
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ srt: srtContent }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      if (data.viewpoints) {
        setViewpoints(data.viewpoints)
        setStatus("done")
        toast(`✅ 重新分析完成：${data.viewpoints.length} 个观点`)
      }
    } catch (e: any) {
      toast(`❌ ${e.message}`)
      setStatus("done")
    }
  }, [srtContent])

  // --- GENERATE DRAFT → Agent 3 ---
  const handleGenerateDraft = useCallback(async () => {
    const usedIds = sections.flatMap(s => s.itemIds)
    if (usedIds.length === 0) { toast("请先拖拽至少一个观点"); return }
    const usedVps = usedIds.map(id => allById.get(id)).filter(Boolean) as any[]
    setLoadingDraft(true)
    toast("Agent 3 正在生成文章…")
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, viewpoints: usedVps, sections, sourceName }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const article = data.article || ""
      setCachedArticle(article) // cache for fact check reuse
      const blob = new Blob([article], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "draft_v0_5.txt"; a.click()
      URL.revokeObjectURL(url)
      toast(`✅ 草稿已生成（${article.length} 字）`)
    } catch (e: any) {
      // Fallback: local article generator (produces natural prose, not bullet points)
      toast(`API 不可用，使用本地引擎生成`)
      const article = localGenerateDraft(title, sourceName, sections, allById)
      const blob = new Blob([article], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "draft_v0_5.txt"; a.click()
      URL.revokeObjectURL(url)
      toast(`✅ 草稿已生成（${article.length} 字）`)
    }
    setLoadingDraft(false)
  }, [title, viewpoints, sections, sourceName, allById])

  // --- FACT CHECK → Agent 4 ---
  const handleFactCheck = useCallback(async () => {
    const usedIds = sections.flatMap(s => s.itemIds)
    if (usedIds.length === 0) { toast("请先拖拽至少一个观点"); return }
    const usedVps = usedIds.map(id => allById.get(id)).filter(Boolean) as any[]
    setLoadingCheck(true)
    toast("Agent 4 正在核查…")
    try {
      // Reuse cached article if available, otherwise generate fresh
      const article = cachedArticle || ""
      if (!article) {
        // Fallback: generate from viewpoints data directly
        const genRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, viewpoints: usedVps, sections, sourceName }),
        })
        if (!genRes.ok) throw new Error(await genRes.text())
        const genData = await genRes.json()
        setCachedArticle(genData.article || "")
      }

      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article: cachedArticle || article, viewpoints: usedVps }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const blob = new Blob([data.report || ""], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "fact_check_report.txt"; a.click()
      URL.revokeObjectURL(url)
      toast("✅ 核查报告已生成")
    } catch (e: any) {
      toast(`核查失败，使用本地引擎：${e.message}`)
      const report = localGenerateFactCheck(title, sourceName, sections, allById)
      const blob = new Blob([report], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "fact_check_report.txt"; a.click()
      URL.revokeObjectURL(url)
    }
    setLoadingCheck(false)
  }, [title, viewpoints, sections, sourceName, allById])

  // --- SAVE OUTLINE (+ change log) ---
  const lastSavedRef = useRef<{title: string; itemIds: string[]}>({title: "", itemIds: []})

  const handleSaveOutline = useCallback(() => {
    const currentItemIds = sections.flatMap(s => s.itemIds)
    const prev = lastSavedRef.current

    // Build change log
    const added = currentItemIds.filter(id => !prev.itemIds.includes(id)).map(id => {
      const vp = allById.get(id); return vp ? { action: "添加", id: vp.id, title: vp.title, speaker: vp.speaker } : null
    }).filter(Boolean)
    const removed = prev.itemIds.filter(id => !currentItemIds.includes(id)).map(id => {
      const vp = allById.get(id); return vp ? { action: "移除", id: vp.id, title: vp.title } : null
    }).filter(Boolean)
    const titleChanged = prev.title && prev.title !== title ? { action: "修改标题", from: prev.title, to: title } : null

    const changeLog = {
      savedAt: new Date().toISOString(),
      previousState: { title: prev.title, itemCount: prev.itemIds.length },
      currentState: { title, itemCount: currentItemIds.length },
      changes: [...added, ...removed, ...(titleChanged ? [titleChanged] : [])],
      editorReason: "",
      // Editor fills this in later: "为什么选A没选B"之类的决策理由
    }

    // Update last saved reference
    lastSavedRef.current = { title, itemIds: [...currentItemIds] }

    const data = {
      title, sourceName,
      sections: sections.map(s => ({
        id: s.id, title: s.title, itemIds: s.itemIds,
        items: s.itemIds.map(id => { const vp = allById.get(id); return vp ? { id: vp.id, title: vp.title, speaker: vp.speaker, timestamp: vp.timestamp } : null }).filter(Boolean),
      })),
      changeLog,
      savedAt: changeLog.savedAt,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "outline_backup.json"; a.click()
    URL.revokeObjectURL(url)
    toast("💾 大纲已保存")
  }, [title, sourceName, sections, allById])

  // --- EXPORT OUTLINE MD ---
  const handleExportMarkdown = useCallback(() => {
    let md = `文章大纲：${title}\n素材：${sourceName}\n导出：${new Date().toLocaleString("zh-CN")}\n\n`
    sections.forEach((sec) => {
      md += `## ${sec.title}\n\n`
      sec.itemIds.forEach((vpId, i) => {
        const vp = allById.get(vpId); if (!vp) return
        const conf = vp.level === "high" ? "🟢" : vp.level === "mid" ? "🟡" : "🔴"
        const hot = vp.hotspotMatch?.matched ? "🔥" : ""
        md += `${i + 1}. ${conf}${hot} ${vp.title} — ${vp.speaker} [${vp.timestamp}]\n`
        md += `   ${vp.summary}\n`
        if (vp.editorialFlags?.factCheckNeeded || vp.editorialFlags?.needsHumanJudgment) md += `   ⚠ ${vp.editorialFlags.flagReason}\n`
      })
      md += `\n`
    })
    const blob = new Blob([md], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "outline_structure.txt"; a.click()
    URL.revokeObjectURL(url)
    toast("📋 大纲已导出")
  }, [title, sourceName, sections, allById])

  const usedCount = assignedIds.size

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <Toolbar sourceName={sourceName} status={status}
        onImportSRT={handleImportSRT} onImportNotes={handleImportNotes}
        onReanalyze={handleReanalyze} onExport={handleGenerateDraft} />

      <FilterBar filters={filters} speakers={speakers} onChange={setFilters} />
      <QuadrantOverview viewpoints={viewpoints} selectedId={selectedId} onSelect={setSelectedId} />

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <CardLibrary viewpoints={libraryViewpoints} draggingId={draggingId} selectedId={selectedId}
          onDragStart={setDraggingId} onDragEnd={() => setDraggingId(null)}
          onAdd={(id) => addManyToActive([id])} onSelect={setSelectedId} onAddAll={addManyToActive}
          onDropToLibrary={(id) => { removeFromOutline(id); setDraggingId(null) }} />
        <EditorWorkspace sections={sections} byId={allById} activeSectionId={activeSectionId}
          draggingId={draggingId} selectedId={selectedId} title={title}
          onTitleChange={setTitle} onSetActive={setActiveSectionId}
          onDropToSection={(sectionId, vpId) => { assignToSection(sectionId, vpId); setDraggingId(null) }}
          onRemove={removeFromOutline} onSelect={setSelectedId}
          onGenerateDraft={handleGenerateDraft} onSaveOutline={handleSaveOutline}
          onExportMarkdown={handleExportMarkdown} onFactCheck={handleFactCheck}
          loadingDraft={loadingDraft} loadingCheck={loadingCheck} />
      </main>

      <StatusBar extracted={allViewpoints.length} used={usedCount} words={usedCount * 150 + 300} lastSaved="刚才" />

      <DetailModal vp={selectedVp!} open={!!selectedVp} onClose={() => setSelectedId(null)}
        srtContext={selectedVp ? getContext(selectedVp.timestamp) : []} />

      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-foreground px-4 py-2.5 text-sm text-background shadow-lg transition-all">
          {toastMsg}
        </div>
      )}
    </div>
  )
}

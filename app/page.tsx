"use client"

import { useMemo, useState, useCallback } from "react"
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
  const [srtLines, setSrtLines] = useState<{ts: string; speaker: string; text: string}[]>([])

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

  const byId = useMemo(() => new Map(viewpoints.map((v) => [v.id, v])), [viewpoints])
  const speakers = useMemo(() => Array.from(new Set(viewpoints.map((v) => v.speaker))), [viewpoints])
  const assignedIds = useMemo(() => new Set(sections.flatMap((s) => s.itemIds)), [sections])

  const libraryViewpoints = useMemo(() => {
    const q = filters.query.trim().toLowerCase()
    let list = viewpoints.filter((v) => !assignedIds.has(v.id))
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
    return byId.get(selectedId) || null
  }, [selectedId, byId])

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
      const suggestions = result.suggestions || ""
      const blob = new Blob([suggestions], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "reuse_suggestions.txt"; a.click()
      URL.revokeObjectURL(url)
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
    setLoadingDraft(true)
    toast("Agent 3 正在生成文章…")
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, viewpoints, sections, sourceName }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      const article = data.article || ""
      const blob = new Blob([article], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "draft_v0_5.txt"; a.click()
      URL.revokeObjectURL(url)
      toast(`✅ 草稿已生成（${article.length} 字）`)
    } catch (e: any) {
      // Fallback: local article generator (produces natural prose, not bullet points)
      toast(`API 不可用，使用本地引擎生成`)
      const article = localGenerateDraft(title, sourceName, sections, byId)
      const blob = new Blob([article], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "draft_v0_5.txt"; a.click()
      URL.revokeObjectURL(url)
      toast(`✅ 草稿已生成（${article.length} 字）`)
    }
    setLoadingDraft(false)
  }, [title, viewpoints, sections, sourceName, byId])

  // --- FACT CHECK → Agent 4 ---
  const handleFactCheck = useCallback(async () => {
    setLoadingCheck(true)
    toast("Agent 4 正在核查…")
    try {
      // First generate article text, then check it
      const genRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, viewpoints, sections, sourceName }),
      })
      const article = genRes.ok ? (await genRes.json()).article || "" : ""

      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ article, viewpoints }),
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
      const report = localGenerateFactCheck(title, sourceName, sections, byId)
      const blob = new Blob([report], { type: "text/plain;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url; a.download = "fact_check_report.txt"; a.click()
      URL.revokeObjectURL(url)
    }
    setLoadingCheck(false)
  }, [title, viewpoints, sections, sourceName, byId])

  // --- SAVE OUTLINE ---
  const handleSaveOutline = useCallback(() => {
    const data = {
      title, sourceName,
      sections: sections.map(s => ({
        id: s.id, title: s.title, itemIds: s.itemIds,
        items: s.itemIds.map(id => { const vp = byId.get(id); return vp ? { id: vp.id, title: vp.title, speaker: vp.speaker, timestamp: vp.timestamp } : null }).filter(Boolean),
      })),
      savedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = "outline_backup.json"; a.click()
    URL.revokeObjectURL(url)
    toast("💾 大纲已保存")
  }, [title, sourceName, sections, byId])

  // --- EXPORT OUTLINE MD ---
  const handleExportMarkdown = useCallback(() => {
    let md = `文章大纲：${title}\n素材：${sourceName}\n导出：${new Date().toLocaleString("zh-CN")}\n\n`
    sections.forEach((sec) => {
      md += `## ${sec.title}\n\n`
      sec.itemIds.forEach((vpId, i) => {
        const vp = byId.get(vpId); if (!vp) return
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
  }, [title, sourceName, sections, byId])

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
        <EditorWorkspace sections={sections} byId={byId} activeSectionId={activeSectionId}
          draggingId={draggingId} selectedId={selectedId} title={title}
          onTitleChange={setTitle} onSetActive={setActiveSectionId}
          onDropToSection={(sectionId, vpId) => { assignToSection(sectionId, vpId); setDraggingId(null) }}
          onRemove={removeFromOutline} onSelect={setSelectedId}
          onGenerateDraft={handleGenerateDraft} onSaveOutline={handleSaveOutline}
          onExportMarkdown={handleExportMarkdown} onFactCheck={handleFactCheck}
          loadingDraft={loadingDraft} loadingCheck={loadingCheck} />
      </main>

      <StatusBar extracted={viewpoints.length} used={usedCount} words={usedCount * 150 + 300} lastSaved="刚才" />

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

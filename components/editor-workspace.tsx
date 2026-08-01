"use client"

import { useState } from "react"
import { BookOpenCheck, FileDown, Save, Search, Sparkles } from "lucide-react"
import type { OutlineSection, Viewpoint } from "@/lib/types"
import { ViewpointCard } from "@/components/viewpoint-card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { levelDotBg } from "@/lib/viewpoint-utils"

interface EditorWorkspaceProps {
  sections: OutlineSection[]
  byId: Map<string, Viewpoint>
  activeSectionId: string
  draggingId: string | null
  selectedId: string | null
  title: string
  onTitleChange: (t: string) => void
  onSetActive: (id: string) => void
  onDropToSection: (sectionId: string, vpId: string) => void
  onRemove: (id: string) => void
  onSelect: (id: string) => void
  onGenerateDraft: () => void
  onSaveOutline: () => void
  onExportMarkdown: () => void
  onFactCheck: () => void
  loadingDraft?: boolean
  loadingCheck?: boolean
  weakSignals?: {topic:string;speaker:string;timestamp:string;why:string}[]
}

export function EditorWorkspace({
  sections, byId, activeSectionId, draggingId, selectedId, title,
  onTitleChange, onSetActive, onDropToSection, onRemove, onSelect,
  onGenerateDraft, onSaveOutline, onExportMarkdown, onFactCheck,
  loadingDraft, loadingCheck, weakSignals,
}: EditorWorkspaceProps) {
  const [overSection, setOverSection] = useState<string | null>(null)
  const usedCount = sections.reduce((s, sec) => s + sec.itemIds.length, 0)
  const factCheckCount = sections.reduce((s, sec) => {
    return s + sec.itemIds.filter(id => {
      const vp = byId.get(id)
      return vp && (vp.editorialFlags.factCheckNeeded || vp.editorialFlags.needsHumanJudgment || vp.level !== "high")
    }).length
  }, 0)

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-background">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 lg:p-6">
        <input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="点击编辑文章标题…"
          className="w-full border-0 bg-transparent text-xl font-semibold tracking-tight placeholder:text-muted-foreground/60 focus:outline-none lg:text-2xl"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          点击章节标题设为「当前目标段落」；可从左侧拖拽卡片，或点击卡片 + 按钮快速添加。
        </p>

        <div className="mt-5 space-y-4">
          {sections.map((section) => {
            const isActive = section.id === activeSectionId
            const isOver = overSection === section.id
            const secNeedsCheck = section.itemIds.filter(id => {
              const vp = byId.get(id)
              return vp && (vp.editorialFlags.factCheckNeeded || vp.editorialFlags.needsHumanJudgment || vp.level !== "high")
            }).length
            return (
              <div
                key={section.id}
                onDragOver={(e) => { e.preventDefault(); setOverSection(section.id) }}
                onDragLeave={(e) => { if (e.currentTarget === e.target) setOverSection(null) }}
                onDrop={(e) => { e.preventDefault(); setOverSection(null); const id = e.dataTransfer.getData("text/plain"); if (id) onDropToSection(section.id, id) }}
                className={cn("rounded-xl border bg-card/60 p-3 transition-colors", isActive && "border-primary/50 ring-1 ring-primary/20", isOver && "border-primary bg-accent/50")}
              >
                <button type="button" onClick={() => onSetActive(section.id)} className="flex w-full items-center gap-2 text-left">
                  <span className={cn("size-2 rounded-full", isActive ? "bg-primary" : "bg-muted-foreground/30")} aria-hidden />
                  <span className="text-sm font-semibold">{section.title}</span>
                  <span className="text-xs text-muted-foreground">{section.itemIds.length} 个观点</span>
                  {secNeedsCheck > 0 && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">⚠ {secNeedsCheck}</span>}
                  {isActive && <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">当前目标</span>}
                </button>
                <div className="mt-2.5 space-y-2">
                  {section.itemIds.length === 0 ? (
                    <div className={cn("rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground", isOver ? "border-primary text-primary" : "border-border")}>
                      + 拖拽卡片到此处
                    </div>
                  ) : (
                    section.itemIds.map((id) => {
                      const vp = byId.get(id)
                      if (!vp) return null
                      return <ViewpointCard key={id} vp={vp} variant="outline" dragging={draggingId === id} onRemove={onRemove} onSelect={onSelect} />
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

        )}

      {/* Weak Signals Section */}
      {weakSignals && weakSignals.length > 0 && (
        <div style={{margin:"16px 0",border:"2px dashed #fbbf24",borderRadius:12,padding:16,background:"rgba(251,191,36,0.06)"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
            <span style={{fontSize:14,fontWeight:600,color:"#92400e"}}>访谈中的弱信号</span>
            <span style={{fontSize:12,color:"#b45309"}}>嘉宾提过但未展开</span>
          </div>
          {weakSignals.map((ws, i) => (
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:8,padding:"6px 12px",fontSize:13,marginBottom:4,background:"rgba(255,255,255,0.6)",borderRadius:8}}>
              <span style={{color:"#f59e0b",fontWeight:700,fontSize:11,flexShrink:0,marginTop:2}}>[{ws.timestamp}]</span>
              <div>
                <span style={{fontWeight:600}}>{ws.topic}</span>
                <span style={{color:"#6b7280"}}> — {ws.speaker}</span>
                <div style={{fontSize:12,color:"#9ca3af",marginTop:2}}>{ws.why}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action bar — each button does a different thing */}
      <div className="flex flex-wrap items-center gap-2 border-t bg-card px-4 py-3">
        <Button size="sm" className="h-8 gap-1.5" onClick={onGenerateDraft} disabled={loadingDraft}>
          <Sparkles className={`size-4 ${loadingDraft ? "animate-spin" : ""}`} /> {loadingDraft ? "生成中…" : "生成全文草稿"}
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-transparent" onClick={onFactCheck} disabled={loadingCheck}>
          <Search className={`size-4 ${loadingCheck ? "animate-spin" : ""}`} /> {loadingCheck ? "核查中…" : `事实核查${factCheckCount > 0 ? ` (${factCheckCount})` : ""}`}
        </Button>
        <span className="w-px h-5 bg-border mx-0.5" />
        <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-transparent" onClick={onSaveOutline}>
          <Save className="size-4" /> 保存大纲
        </Button>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-transparent" onClick={onExportMarkdown}>
          <FileDown className="size-4" /> 导出大纲 MD
        </Button>
        <span className="ml-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpenCheck className="size-4 text-conf-high" />
          {usedCount} 观点 · ~{usedCount * 150 + 300} 字
        </span>
      </div>
    </section>
  )
}

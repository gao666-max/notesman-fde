"use client"

import { useRef, useState } from "react"
import { Download, FileText, FolderOpen, Map, RefreshCw, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ToolbarProps {
  sourceName: string
  status: "idle" | "analyzing" | "done"
  onImportSRT: (text: string, filename: string) => void
  onImportNotes: (data: any[]) => void
  onReanalyze: () => void
  onExport: () => void
}

export function Toolbar({ sourceName, status, onImportSRT, onImportNotes, onReanalyze, onExport }: ToolbarProps) {
  const srtRef = useRef<HTMLInputElement>(null)
  const notesRef = useRef<HTMLInputElement>(null)

  return (
    <header className="flex flex-wrap items-center gap-3 border-b bg-card px-4 py-2.5">
      <div className="flex items-center gap-2">
        <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Map className="size-4.5" aria-hidden />
        </span>
        <div className="leading-tight">
          <h1 className="text-sm font-semibold tracking-tight">笔记侠 · 内容素材地图</h1>
          <p className="text-[11px] text-muted-foreground">Notesman Content Map</p>
        </div>
      </div>

      <div className="mx-1 hidden h-6 w-px bg-border sm:block" />

      <nav className="flex flex-wrap items-center gap-1.5">
        <input
          ref={srtRef}
          type="file"
          accept=".srt,.txt,.vtt"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const text = await file.text()
            onImportSRT(text, file.name)
            e.target.value = ""
          }}
        />
        <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-transparent" onClick={() => srtRef.current?.click()}>
          <Upload className="size-4" aria-hidden />
          导入 SRT
        </Button>

        <input
          ref={notesRef}
          type="file"
          accept=".jsonl,.json,.jsonlines"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const text = await file.text()
            const lines = text.trim().split("\n").filter(l => l.trim())
            const data = lines.map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
            onImportNotes(data as any[])
            e.target.value = ""
          }}
        />
        <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-transparent" onClick={() => notesRef.current?.click()}>
          <FolderOpen className="size-4" aria-hidden />
          导入历史笔记
        </Button>

        <Button variant="outline" size="sm" className="h-8 gap-1.5 bg-transparent" onClick={onReanalyze} disabled={status === "analyzing"}>
          <RefreshCw className={`size-4 ${status === "analyzing" ? "animate-spin" : ""}`} aria-hidden />
          {status === "analyzing" ? "分析中…" : "重新分析"}
        </Button>

        <Button size="sm" className="h-8 gap-1.5" onClick={onExport}>
          <Download className="size-4" aria-hidden />
          导出初稿
        </Button>
      </nav>

      <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
        <FileText className="size-4" aria-hidden />
        <span className="hidden max-w-[220px] truncate sm:inline" title={sourceName}>
          {sourceName}
        </span>
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium ${
          status === "analyzing"
            ? "border-amber-300 bg-amber-50 text-amber-700"
            : status === "done"
            ? "border-conf-high/30 bg-conf-high/10 text-conf-high"
            : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
        }`}>
          <span className="relative flex size-2">
            {status === "analyzing" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400/60" />}
            {status === "done" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-conf-high/60" />}
            <span className={`relative inline-flex size-2 rounded-full ${
              status === "done" ? "bg-conf-high" : status === "analyzing" ? "bg-amber-400" : "bg-muted-foreground/40"
            }`} />
          </span>
          {status === "done" ? "分析完成" : status === "analyzing" ? "分析中…" : "等待素材"}
        </span>
      </div>
    </header>
  )
}

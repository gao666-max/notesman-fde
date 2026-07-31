"use client"

import { CheckCircle2, Clock, FileText, Hash } from "lucide-react"

interface StatusBarProps {
  extracted: number
  used: number
  words: number
  lastSaved: string
}

export function StatusBar({ extracted, used, words, lastSaved }: StatusBarProps) {
  return (
    <footer className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t bg-card px-4 py-1.5 text-[11px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <Hash className="size-3.5" aria-hidden />
        已提取 <strong className="font-semibold text-foreground">{extracted}</strong> 个观点
      </span>
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 className="size-3.5 text-conf-high" aria-hidden />
        已选用 <strong className="font-semibold text-foreground">{used}</strong> 个
      </span>
      <span className="inline-flex items-center gap-1.5">
        <FileText className="size-3.5" aria-hidden />
        大纲约 <strong className="font-semibold text-foreground">{words}</strong> 字
      </span>
      <span className="ml-auto inline-flex items-center gap-1.5">
        <Clock className="size-3.5" aria-hidden />
        上次保存 {lastSaved}
      </span>
    </footer>
  )
}

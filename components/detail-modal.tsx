"use client"

import { X, Quote, AlertTriangle, Zap, Flame, CheckCircle, BookOpen } from "lucide-react"
import type { Viewpoint } from "@/lib/types"
import { levelBadgeClass, levelDotBg, levelLabel, isHot } from "@/lib/viewpoint-utils"
import { cn } from "@/lib/utils"

interface DetailModalProps {
  vp: Viewpoint
  open: boolean
  onClose: () => void
  srtContext?: {ts: string; speaker: string; text: string}[]
}

export function DetailModal({ vp, open, onClose, srtContext }: DetailModalProps) {
  if (!open) return null

  const f = vp.editorialFlags
  const hasFlags = f.factCheckNeeded || f.sensitiveContent || f.needsHumanJudgment

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border bg-card p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-foreground"
          aria-label="关闭"
        >
          <X className="size-4" />
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 pr-8">
          <span className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: levelDotBg(vp.level) }} />
          <div>
            <h3 className="text-xl font-bold leading-tight">{vp.title}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="font-medium">{vp.speaker}</span>
              <span className="font-mono">{vp.timestamp}</span>
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs", levelBadgeClass(vp.level))}>
                {levelLabel(vp.level)} · 置信 {vp.confidence}%
              </span>
              {isHot(vp) && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-hot">
                  <Flame className="size-3" /> 热点 {Math.round(vp.hotness)}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">一句话摘要</h4>
          <p className="mt-1.5 text-sm leading-relaxed">{vp.summary}</p>
        </div>

        {/* SRT Context Panel */}
        {srtContext && srtContext.length > 0 && (
          <div className="mt-5">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="size-3.5" /> 原文上下文
            </h4>
            <div className="rounded-lg border bg-muted/40 divide-y divide-border">
              {srtContext.map((line, i) => {
                const isTarget = line.ts === vp.timestamp
                return (
                  <div key={i} className={`px-3.5 py-2 text-sm leading-relaxed ${isTarget ? 'bg-amber-50 dark:bg-amber-950/30 border-l-2 border-amber-500' : ''}`}>
                    <span className="text-xs text-muted-foreground font-mono mr-2">[{line.ts}]</span>
                    {line.speaker && <span className="font-medium text-xs mr-1">{line.speaker}：</span>}
                    <span className={isTarget ? 'font-medium' : ''}>{line.text}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <div className="mt-5">
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Quote className="size-3.5" /> 证据原文 · {vp.evidenceQuotes.length} 条
          </h4>
          <div className="space-y-2.5">
            {vp.evidenceQuotes.map((eq, i) => (
              <div key={i} className="rounded-lg border-l-3 border-primary bg-muted/60 px-3.5 py-2.5">
                <p className="text-sm italic leading-relaxed">"{eq.text}"</p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  — {eq.speaker} · <span className="font-mono">{eq.timestamp}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence */}
        <div className="mt-5">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">置信度依据</h4>
          <p className="mt-1 text-sm text-muted-foreground">{vp.confidenceReason}</p>
        </div>

        {/* Hotspot Match */}
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">热点匹配</h4>
          {vp.hotspotMatch.matched ? (
            <div className="mt-1.5 rounded-lg border bg-muted/40 p-3">
              <p className="flex items-center gap-1.5 text-sm font-medium">
                <Flame className="size-3.5 text-hot" />
                {vp.hotspotMatch.topic}
                <span className="ml-auto rounded-full bg-hot/10 px-2 py-0.5 text-xs font-medium text-hot">
                  相关度 {Math.round(vp.hotspotMatch.score * 100)}%
                </span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{vp.hotspotMatch.reason}</p>
            </div>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">— 无热点匹配</p>
          )}
        </div>

        {/* Editorial Flags */}
        <div className="mt-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">编辑标注</h4>
          {hasFlags ? (
            <div className="mt-1.5 space-y-1.5">
              {f.factCheckNeeded && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <span>需事实核查：{f.flagReason}</span>
                </div>
              )}
              {f.sensitiveContent && (
                <div className="flex items-start gap-2 rounded-lg bg-purple-50 px-3 py-2 text-sm dark:bg-purple-950/30">
                  <Zap className="mt-0.5 size-4 shrink-0 text-purple-600" />
                  <span>含敏感内容：{f.flagReason}</span>
                </div>
              )}
              {f.needsHumanJudgment && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm dark:bg-amber-950/30">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <span>需编辑判断：{f.flagReason}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-sm dark:bg-emerald-950/30">
              <CheckCircle className="size-4 text-emerald-600" />
              <span>无需特别标注</span>
            </div>
          )}
        </div>

        {/* Keywords & Tags */}
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
          {vp.keywords.map((k) => (
            <span key={k} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{k}</span>
          ))}
          <span className="w-px h-4 bg-border mx-1" />
          {vp.styleTags.map((t) => (
            <span key={t} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{t}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

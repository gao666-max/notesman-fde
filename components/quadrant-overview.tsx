"use client"

import { useState } from "react"
import { ChevronDown, LayoutGrid } from "lucide-react"
import type { QuadrantId, Viewpoint } from "@/lib/types"
import { QUADRANT_META, quadrantOf } from "@/lib/viewpoint-utils"
import { cn } from "@/lib/utils"

interface QuadrantOverviewProps {
  viewpoints: Viewpoint[]
  selectedId: string | null
  onSelect: (id: string) => void
}

// Hard-coded colors for reliability (no CSS var dependency)
const LEVEL_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  high: { bg: "#22c55e", text: "#fff", ring: "#16a34a" },
  mid: { bg: "#f59e0b", text: "#fff", ring: "#d97706" },
  low: { bg: "#ef4444", text: "#fff", ring: "#dc2626" },
}

const QUADRANT_BG_COLORS: Record<QuadrantId, string> = {
  treasure: "rgba(34,197,94,0.08)",
  priority: "rgba(22,163,74,0.14)",
  skip: "rgba(156,163,175,0.06)",
  verify: "rgba(245,158,11,0.1)",
}

const CORNERS: { id: QuadrantId; pos: string; align: string }[] = [
  { id: "treasure", pos: "left-3 top-3", align: "items-start text-left" },
  { id: "priority", pos: "right-3 top-3", align: "items-end text-right" },
  { id: "skip", pos: "left-3 bottom-3", align: "items-start text-left" },
  { id: "verify", pos: "right-3 bottom-3", align: "items-end text-right" },
]

export function QuadrantOverview({ viewpoints, selectedId, onSelect }: QuadrantOverviewProps) {
  const [open, setOpen] = useState(true)

  const counts = viewpoints.reduce<Record<QuadrantId, number>>(
    (acc, vp) => { acc[quadrantOf(vp)] += 1; return acc },
    { treasure: 0, priority: 0, skip: 0, verify: 0 },
  )

  return (
    <section className="border-b bg-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
        aria-expanded={open}
      >
        <LayoutGrid className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">四象限全局概览</h2>
        <span className="text-xs text-muted-foreground">置信度 × 热点相关性 · 共 {viewpoints.length} 个观点</span>
        <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="flex gap-3">
            {/* Y axis label */}
            <div className="flex flex-col items-center justify-between py-6 text-[11px] font-medium text-muted-foreground">
              <span>高置信</span>
              <span className="[writing-mode:vertical-rl] tracking-widest text-muted-foreground/70">置信度</span>
              <span>低置信</span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="relative h-[clamp(220px,30vh,300px)] w-full overflow-hidden rounded-lg border bg-secondary/30">
                {/* quadrant divider lines */}
                <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-border" />

                {/* quadrant background colors */}
                {(["treasure", "priority", "skip", "verify"] as QuadrantId[]).map((qid) => {
                  const isLeft = qid === "treasure" || qid === "skip"
                  const isTop = qid === "treasure" || qid === "priority"
                  return (
                    <div
                      key={qid}
                      className="absolute"
                      style={{
                        left: isLeft ? 0 : "50%",
                        top: isTop ? 0 : "50%",
                        width: "50%",
                        height: "50%",
                        backgroundColor: QUADRANT_BG_COLORS[qid],
                        border: "1px solid transparent",
                      }}
                    />
                  )
                })}

                {/* corner labels */}
                {CORNERS.map(({ id, pos, align }) => (
                  <div key={id} className={cn("absolute flex flex-col gap-0.5 z-10", pos, align)}>
                    <span className="text-xs font-semibold text-muted-foreground">{QUADRANT_META[id].label}</span>
                    <span className="text-[10px] text-muted-foreground/60">{QUADRANT_META[id].hint}</span>
                    <span className="text-[10px] text-muted-foreground">{counts[id]} 个</span>
                  </div>
                ))}

                {/* bubbles */}
                {viewpoints.map((vp) => {
                  const colors = LEVEL_COLORS[vp.level] || LEVEL_COLORS.high
                  // Size based on evidence QUOTE count (real data)
                  const evidenceCount = vp.evidenceQuotes?.length || vp.evidence || 1
                  const size = 24 + evidenceCount * 8
                  const active = selectedId === vp.id
                  return (
                    <button
                      key={vp.id}
                      type="button"
                      onClick={() => onSelect(vp.id)}
                      title={`${vp.id} ${vp.title}\n置信 ${vp.confidence}% · 热点 ${vp.hotness}% · ${evidenceCount} 条证据`}
                      style={{
                        left: `${Math.max(3, Math.min(97, vp.hotness))}%`,
                        bottom: `${Math.max(3, Math.min(97, vp.confidence))}%`,
                        width: size,
                        height: size,
                        backgroundColor: colors.bg,
                        color: colors.text,
                        boxShadow: active ? `0 0 0 3px ${colors.ring}` : "0 2px 8px rgba(0,0,0,0.18)",
                      }}
                      className={cn(
                        "absolute grid -translate-x-1/2 translate-y-1/2 place-items-center rounded-full border-2 border-white text-[10px] font-bold transition-transform hover:z-10 hover:scale-110",
                        active && "z-10 scale-110",
                      )}
                    >
                      {vp.id.replace("vp_", "")}
                    </button>
                  )
                })}
              </div>

              {/* X axis label */}
              <div className="mt-1.5 flex items-center justify-between px-1 text-[11px] font-medium text-muted-foreground">
                <span>低热点</span>
                <span className="tracking-widest text-muted-foreground/70">热点相关性 →</span>
                <span>高热点</span>
              </div>
            </div>
          </div>

          {/* legend */}
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS.high.bg }} />
              高置信 · 可直接用
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS.mid.bg }} />
              待核实 · 建议复核
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-3 rounded-full" style={{ backgroundColor: LEVEL_COLORS.low.bg }} />
              低置信 · 需编辑确认
            </span>
            <span className="inline-flex items-center gap-1.5 ml-2">
              <span className="size-2 rounded-full bg-muted-foreground/40" />
              <span className="size-3.5 rounded-full bg-muted-foreground/40" />
              气泡越大 = 证据越多
            </span>
          </div>
        </div>
      )}
    </section>
  )
}

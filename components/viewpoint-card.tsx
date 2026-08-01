"use client"

import { Flame, GripVertical, Plus, Quote, X } from "lucide-react"
import type { Viewpoint } from "@/lib/types"
import { isHot, levelBadgeClass, levelDotBg, levelLabel } from "@/lib/viewpoint-utils"
import { cn } from "@/lib/utils"

interface ViewpointCardProps {
  vp: Viewpoint
  variant?: "library" | "outline"
  onDragStart?: (id: string) => void
  onDragEnd?: () => void
  onAdd?: (id: string) => void
  onRemove?: (id: string) => void
  onSelect?: (id: string) => void
  dragging?: boolean
}

export function ViewpointCard({
  vp,
  variant = "library",
  onDragStart,
  onDragEnd,
  onAdd,
  onRemove,
  onSelect,
  dragging,
}: ViewpointCardProps) {
  const outline = variant === "outline"
  return (
    <div
      draggable={vp.category !== "weak_signal"}
      onDragStart={(e) => {
        if (vp.category === "weak_signal") { e.preventDefault(); return }
        e.dataTransfer.effectAllowed = "move"
        e.dataTransfer.setData("text/plain", vp.id)
        onDragStart?.(vp.id)
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => onSelect?.(vp.id)}
      className={cn(
        "group relative cursor-grab rounded-lg border bg-card text-card-foreground transition-shadow active:cursor-grabbing",
        outline ? "px-3 py-2 shadow-xs" : "p-3 shadow-xs hover:shadow-md",
        dragging && "opacity-40",
        vp.category === "weak_signal" && "border-dashed border-amber-300 bg-amber-50/40 dark:border-amber-700 dark:bg-amber-950/10",
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical
          className="mt-0.5 size-4 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground"
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted-foreground">{vp.id}</span>
            {isHot(vp) && (
              <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-hot">
                <Flame className="size-3" aria-hidden />
                热点
              </span>
            )}
            <span
              className={cn(
                "ml-auto inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                levelBadgeClass(vp.level),
              )}
            >
              <span className={cn("size-1.5 rounded-full")} style={{ backgroundColor: levelDotBg(vp.level) }} aria-hidden />
              {levelLabel(vp.level)}
            </span>
          </div>

          <p className={cn("mt-1 text-pretty font-medium leading-snug", outline ? "text-sm" : "text-sm")}>
            {vp.title}
          </p>

          {!outline && (
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{vp.summary}</p>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span>{vp.speaker}</span>
            <span className="font-mono">{vp.timestamp}</span>
            <span className="inline-flex items-center gap-0.5">
              <Quote className="size-3" aria-hidden />
              {vp.evidence} 条证据
            </span>
          </div>

          {!outline && vp.keywords.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {vp.keywords.map((k) => (
                <span key={k} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {k}
                </span>
              ))}
            </div>
          )}
        </div>

        {onAdd && vp.category !== "weak_signal" && (
          <button
            type="button"
            aria-label={`将 ${vp.id} 加入大纲`}
            onClick={(e) => {
              e.stopPropagation()
              onAdd(vp.id)
            }}
            className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-transparent text-muted-foreground opacity-0 transition-colors hover:border-border hover:bg-accent hover:text-accent-foreground group-hover:opacity-100"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            aria-label={`从大纲移除 ${vp.id}`}
            onClick={(e) => {
              e.stopPropagation()
              onRemove(vp.id)
            }}
            className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </div>
  )
}

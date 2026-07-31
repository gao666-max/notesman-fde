"use client"

import { useState } from "react"
import { ChevronRight, Inbox, Layers } from "lucide-react"
import type { CategoryId, Viewpoint } from "@/lib/types"
import { CATEGORIES } from "@/lib/types"
import { ViewpointCard } from "@/components/viewpoint-card"
import { cn } from "@/lib/utils"

interface CardLibraryProps {
  viewpoints: Viewpoint[] // already filtered + sorted, unassigned only
  draggingId: string | null
  selectedId: string | null
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onAdd: (id: string) => void
  onSelect: (id: string) => void
  onAddAll: (ids: string[]) => void
  onDropToLibrary: (id: string) => void
}

export function CardLibrary({
  viewpoints,
  draggingId,
  selectedId,
  onDragStart,
  onDragEnd,
  onAdd,
  onSelect,
  onAddAll,
  onDropToLibrary,
}: CardLibraryProps) {
  const [collapsed, setCollapsed] = useState<Set<CategoryId>>(new Set())
  const [over, setOver] = useState(false)

  const toggle = (id: CategoryId) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  return (
    <aside
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        const id = e.dataTransfer.getData("text/plain")
        if (id) onDropToLibrary(id)
      }}
      className={cn(
        "flex w-full flex-col border-r bg-secondary/20 lg:w-[35%] lg:min-w-[320px] lg:max-w-md",
        over && "bg-accent/40",
      )}
    >
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Layers className="size-4 text-primary" aria-hidden />
        <h2 className="text-sm font-semibold">抽屉卡片库</h2>
        <span className="ml-auto text-xs text-muted-foreground">{viewpoints.length} 张待用</span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {CATEGORIES.map((cat) => {
          const items = viewpoints.filter((v) => v.category === cat.id)
          const isCollapsed = collapsed.has(cat.id)
          return (
            <section key={cat.id}>
              <div className="flex items-center gap-1.5 px-1">
                <button
                  type="button"
                  onClick={() => toggle(cat.id)}
                  className="flex items-center gap-1 text-sm font-medium"
                  aria-expanded={!isCollapsed}
                >
                  <ChevronRight
                    className={cn("size-4 text-muted-foreground transition-transform", !isCollapsed && "rotate-90")}
                    aria-hidden
                  />
                  {cat.id === "low_only" && (
                    <span className="size-2 rounded-full bg-conf-low" aria-hidden />
                  )}
                  {cat.label}
                  <span className="text-xs text-muted-foreground">({items.length})</span>
                </button>
                {items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onAddAll(items.map((i) => i.id))}
                    className="ml-auto rounded px-1.5 py-0.5 text-[11px] font-medium text-primary hover:bg-accent"
                  >
                    全部添加
                  </button>
                )}
              </div>

              {!isCollapsed && (
                <div className="mt-2 space-y-2">
                  {items.length === 0 ? (
                    <p className="px-1 py-2 text-xs text-muted-foreground/70">该分组暂无待用卡片</p>
                  ) : (
                    items.map((vp) => (
                      <ViewpointCard
                        key={vp.id}
                        vp={vp}
                        variant="library"
                        dragging={draggingId === vp.id}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onAdd={onAdd}
                        onSelect={onSelect}
                      />
                    ))
                  )}
                </div>
              )}
            </section>
          )
        })}

        {viewpoints.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Inbox className="size-8 opacity-50" aria-hidden />
            <p className="text-sm">卡片已全部选用或被筛选隐藏</p>
          </div>
        )}
      </div>
    </aside>
  )
}

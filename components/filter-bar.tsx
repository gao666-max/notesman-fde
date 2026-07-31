"use client"

import { ChevronDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"

export interface Filters {
  query: string
  speaker: string // "all" | speaker name
  level: string // "all" | "high" | "mid" | "low"
  sort: "hot" | "confidence" | "time"
}

interface FilterBarProps {
  filters: Filters
  speakers: string[]
  onChange: (next: Filters) => void
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="relative inline-flex items-center">
      <span className="pointer-events-none absolute left-3 text-xs text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "h-8 appearance-none rounded-md border bg-card pl-[3.5rem] pr-7 text-xs font-medium text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-ring/40",
        )}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2 size-3.5 text-muted-foreground" aria-hidden />
    </label>
  )
}

export function FilterBar({ filters, speakers, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b bg-secondary/40 px-4 py-2">
      <div className="relative flex-1 sm:min-w-[220px] sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          placeholder="搜索观点、关键词…"
          className="h-8 w-full rounded-md border bg-card pl-8 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/40"
        />
      </div>

      <Select label="说话人" value={filters.speaker} onChange={(v) => onChange({ ...filters, speaker: v })}>
        <option value="all">全部</option>
        {speakers.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </Select>

      <Select label="置信度" value={filters.level} onChange={(v) => onChange({ ...filters, level: v })}>
        <option value="all">全部</option>
        <option value="high">高置信</option>
        <option value="mid">待核实</option>
        <option value="low">低置信</option>
      </Select>

      <Select label="排序" value={filters.sort} onChange={(v) => onChange({ ...filters, sort: v as Filters["sort"] })}>
        <option value="hot">热点优先</option>
        <option value="confidence">置信优先</option>
        <option value="time">时间轴</option>
      </Select>
    </div>
  )
}

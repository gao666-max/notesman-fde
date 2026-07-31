import type { ConfidenceLevel, QuadrantId, Viewpoint } from "./types"

export const CONF_THRESHOLD = 50
export const HOT_THRESHOLD = 50

// Hard-coded colors for reliability across all components
export const LEVEL_COLORS: Record<ConfidenceLevel, { bg: string; text: string; border: string }> = {
  high: { bg: "#22c55e", text: "#fff", border: "#16a34a" },
  mid: { bg: "#f59e0b", text: "#fff", border: "#d97706" },
  low: { bg: "#ef4444", text: "#fff", border: "#dc2626" },
}

export function levelBadgeClass(level: ConfidenceLevel): string {
  switch (level) {
    case "high": return "bg-emerald-100 text-emerald-700 border-emerald-300"
    case "mid": return "bg-amber-100 text-amber-700 border-amber-300"
    case "low": return "bg-red-100 text-red-700 border-red-300"
  }
}

export function levelDotBg(level: ConfidenceLevel): string {
  return LEVEL_COLORS[level]?.bg || LEVEL_COLORS.high.bg
}

export function levelLabel(level: ConfidenceLevel): string {
  switch (level) {
    case "high": return "高置信"
    case "mid": return "待核实"
    case "low": return "低置信"
  }
}

export function isHot(vp: Viewpoint): boolean {
  return vp.hotness >= 65
}

export function quadrantOf(vp: Viewpoint): QuadrantId {
  const highConf = vp.confidence >= CONF_THRESHOLD
  const highHot = vp.hotness >= HOT_THRESHOLD
  if (highConf && highHot) return "priority"
  if (highConf && !highHot) return "treasure"
  if (!highConf && highHot) return "verify"
  return "skip"
}

export const QUADRANT_META: Record<QuadrantId, { label: string; hint: string; accent: string }> = {
  treasure: { label: "信息宝藏", hint: "高置信 · 低热点", accent: "text-emerald-600" },
  priority: { label: "优先采用", hint: "高置信 · 高热点", accent: "text-emerald-600" },
  skip: { label: "可跳过", hint: "低置信 · 低热点", accent: "text-muted-foreground" },
  verify: { label: "需核实", hint: "低置信 · 高热点", accent: "text-amber-600" },
}

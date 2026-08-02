export type ConfidenceLevel = "high" | "mid" | "low"
export type CategoryId = "high_thought" | "current_answer" | "info_gap" | "low_only" | "weak_signal"
export type QuadrantId = "treasure" | "priority" | "skip" | "verify"

export interface EvidenceQuote {
  text: string
  speaker: string
  timestamp: string
}

export interface HotspotMatch {
  matched: boolean
  topic: string
  score: number
  reason: string
}

export interface EditorialFlags {
  factCheckNeeded: boolean
  sensitiveContent: boolean
  needsHumanJudgment: boolean
  flagReason: string
}

export interface Viewpoint {
  id: string
  title: string
  summary: string
  speaker: string
  timestamp: string
  confidence: number
  hotness: number
  level: ConfidenceLevel
  evidence: number
  keywords: string[]
  category: CategoryId
  // Extended detail fields for the detail modal
  evidenceQuotes: EvidenceQuote[]
  confidenceReason: string
  hotspotMatch: HotspotMatch
  editorialFlags: EditorialFlags
  styleTags: string[]
  counterpoint?: { speaker: string; summary: string } | null
  causalChain?: CausalChain | null
  // 观点间逻辑关系（逻辑链）：这个观点由哪个观点推导/深化/对比而来
  relations?: ViewpointRelation[] | null
  // 案例独立建模：识别"这是一个案例"并标注背景-行动-结果三要素完整性
  case?: CaseAnalysis | null
}

export interface CausalChain {
  premise: string
  reasoning: string
  conclusion: string
  evidence: { segment: string; text: string }[]
  missingSteps: string[]
}

export type RelationType = "causal" | "progressive" | "contrast"

export interface ViewpointRelation {
  targetId: string
  type: RelationType
  reason: string
}

export type CaseCompleteness = "complete" | "partial" | "unknown"

export interface CaseAnalysis {
  background: string
  action: string
  result: string
  completeness: CaseCompleteness
  evidence: string
}

export interface WeakSignal {
  topic: string
  speaker: string
  timestamp: string
  why: string
}

export interface Category {
  id: CategoryId
  label: string
}

export interface OutlineSection {
  id: string
  title: string
  itemIds: string[]
}

export const CATEGORIES: Category[] = [
  { id: "high_thought", label: "高维思想" },
  { id: "current_answer", label: "当下解答" },
  { id: "info_gap", label: "信息差" },
  { id: "weak_signal", label: "弱信号" },
  { id: "low_only", label: "仅低置信" },
]

export const CATEGORY_MAP: Record<CategoryId, string> = {
  high_thought: "高维思想",
  current_answer: "当下解答",
  info_gap: "信息差",
  low_only: "仅低置信",
  weak_signal: "弱信号",
}

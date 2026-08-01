import { describe, it, expect } from "vitest"
import { normalizeViewpoints } from "../viewpoint-normalizer"

describe("normalizeViewpoints", () => {
  it("normalizes a basic viewpoint", () => {
    const raw = {
      viewpoints: [{
        id: "vp_01",
        title: "AI时代最重要的是能动性",
        summary: "嘉宾强调能动性是关键",
        speaker: "嘉宾A",
        timestamp: "00:00:04",
        confidence: 90,
        hotness: 85,
        level: "high",
        evidence: 2,
        keywords: ["能动性", "AI"],
        category: "high_thought",
        evidenceQuotes: [
          { text: "能动性是关键", speaker: "嘉宾A", timestamp: "00:00:04" }
        ],
        confidenceReason: "表述清晰",
        hotspotMatch: { matched: true, topic: "AI个人成长", score: 0.9, reason: "直接回应" },
        editorialFlags: { factCheckNeeded: false, sensitiveContent: false, needsHumanJudgment: false, flagReason: "" },
        styleTags: ["金句型"],
      }]
    }
    const vps = normalizeViewpoints(raw)
    expect(vps).toHaveLength(1)
    expect(vps[0].title).toBe("AI时代最重要的是能动性")
    expect(vps[0].speaker).toBe("嘉宾A")
    expect(vps[0].timestamp).toBe("00:00:04")
    expect(vps[0].confidence).toBe(90)
    expect(vps[0].level).toBe("high")
  })

  it("maps DeepSeek 'dimension' to 'category'", () => {
    const raw = {
      viewpoints: [{
        id: "vp_01", title: "test", summary: "test", speaker: "嘉宾A",
        timestamp: "00:00:01", confidence: 80, hotness: 70, level: "high",
        dimension: "current_answer",
        evidenceQuotes: [{ text: "test", speaker: "嘉宾A", timestamp: "00:00:01" }],
      }]
    }
    const vps = normalizeViewpoints(raw)
    expect(vps[0].category).toBe("current_answer")
  })

  it("maps DeepSeek 'content' to 'summary'", () => {
    const raw = {
      viewpoints: [{
        id: "vp_01", title: "test", speaker: "嘉宾A",
        timestamp: "00:00:01", confidence: 80, hotness: 70, level: "high",
        content: "嘉宾说了很长一段话...",
        evidenceQuotes: [{ text: "test", speaker: "嘉宾A", timestamp: "00:00:01" }],
      }]
    }
    const vps = normalizeViewpoints(raw)
    expect(vps[0].summary).toBe("嘉宾说了很长一段话...")
  })

  it("derives timestamp from first evidence quote when top-level is missing", () => {
    const raw = {
      viewpoints: [{
        id: "vp_01", title: "test", summary: "test", speaker: "嘉宾A",
        confidence: 80, hotness: 70, level: "high",
        evidenceQuotes: [
          { text: "原文第1段", speaker: "嘉宾A", timestamp: "00:03:24" },
          { text: "原文第2段", speaker: "嘉宾A", timestamp: "00:05:40" },
        ],
      }]
    }
    const vps = normalizeViewpoints(raw)
    expect(vps[0].timestamp).toBe("00:03:24")
  })

  it("cleans DeepSeek time range from timestamp (derived from evidence quote)", () => {
    const raw = {
      viewpoints: [{
        id: "vp_01", title: "test", summary: "test", speaker: "嘉宾A",
        timestamp: "00:57:42 - 00:29:08",
        confidence: 85, hotness: 80, level: "high",
        evidenceQuotes: [{ text: "test", speaker: "嘉宾A", timestamp: "00:57:42 - 00:29:08" }],
      }]
    }
    const vps = normalizeViewpoints(raw)
    // Normalizer derives timestamp from first evidence quote (cleaned), not top-level
    expect(vps[0].timestamp).not.toContain(" - ")
    expect(vps[0].timestamp).toBe("00:57:42")
  })

  it("derives confidence from evidence quality when model gives none", () => {
    const raw = {
      viewpoints: [{
        id: "vp_01", title: "复杂观点：AI改变职业结构的五个维度", summary: "这是一个比较长的摘要包含了超过60个字符的详细描述来帮助判断置信度",
        speaker: "嘉宾A", timestamp: "00:10:00", hotness: 75,
        evidenceQuotes: [
          { text: "原文1", speaker: "嘉宾A", timestamp: "00:10:00" },
          { text: "原文2", speaker: "嘉宾A", timestamp: "00:10:10" },
        ],
        keywords: ["AI", "职业", "变革", "维度"],
      }]
    }
    const vps = normalizeViewpoints(raw)
    expect(vps[0].confidence).toBeGreaterThan(0)
    expect(vps[0].confidence).toBeLessThanOrEqual(95)
    expect(vps[0].level).toBeDefined()
  })

  it("normalizes hotspot score from 0-100 to 0-1", () => {
    const raw = {
      viewpoints: [{
        id: "vp_01", title: "test", summary: "test", speaker: "嘉宾A",
        timestamp: "00:00:01", confidence: 85, hotness: 80, level: "high",
        evidenceQuotes: [{ text: "test", speaker: "嘉宾A", timestamp: "00:00:01" }],
        hotspotMatch: { matched: true, topic: "AI热点", score: 75, reason: "热点相关" },
      }]
    }
    const vps = normalizeViewpoints(raw)
    expect(vps[0].hotspotMatch.score).toBe(0.75)
  })

  it("does not double-normalize already-normalized scores", () => {
    const raw = {
      viewpoints: [{
        id: "vp_01", title: "test", summary: "test", speaker: "嘉宾A",
        timestamp: "00:00:01", confidence: 85, hotness: 80, level: "high",
        evidenceQuotes: [{ text: "test", speaker: "嘉宾A", timestamp: "00:00:01" }],
        hotspotMatch: { matched: true, topic: "AI热点", score: 0.85, reason: "热点相关" },
      }]
    }
    const vps = normalizeViewpoints(raw)
    expect(vps[0].hotspotMatch.score).toBe(0.85)
  })

  it("forces vp_XX id format", () => {
    const raw = {
      viewpoints: [
        { id: "1", title: "test", summary: "test", speaker: "嘉宾A", timestamp: "00:00:01", confidence: 80, hotness: 70, level: "high", evidenceQuotes: [{ text: "t", speaker: "嘉宾A", timestamp: "00:00:01" }] },
        { title: "无ID观点", summary: "test", speaker: "嘉宾B", timestamp: "00:00:02", confidence: 75, hotness: 65, level: "mid", evidenceQuotes: [{ text: "t", speaker: "嘉宾B", timestamp: "00:00:02" }] },
      ]
    }
    const vps = normalizeViewpoints(raw)
    expect(vps[0].id).toBe("vp_01")
    expect(vps[1].id).toBe("vp_02")
  })

  it("preserves counterpoint field", () => {
    const raw = {
      viewpoints: [{
        id: "vp_01", title: "test", summary: "test", speaker: "嘉宾A",
        timestamp: "00:00:01", confidence: 85, hotness: 80, level: "high",
        evidenceQuotes: [{ text: "test", speaker: "嘉宾A", timestamp: "00:00:01" }],
        counterpoint: { speaker: "嘉宾B", summary: "嘉宾B认为这个判断太绝对" },
      }]
    }
    const vps = normalizeViewpoints(raw)
    expect(vps[0].counterpoint).toBeDefined()
    expect(vps[0].counterpoint.speaker).toBe("嘉宾B")
  })

  it("preserves causalChain field", () => {
    const raw = {
      viewpoints: [{
        id: "vp_01", title: "test", summary: "test", speaker: "嘉宾A",
        timestamp: "00:00:01", confidence: 85, hotness: 80, level: "high",
        evidenceQuotes: [{ text: "test", speaker: "嘉宾A", timestamp: "00:00:01" }],
        causalChain: {
          premise: "AI降低了编码成本",
          reasoning: "非技术人员也能创建应用，不需要等排期",
          conclusion: "产品经理从指挥家变成独立闭环",
          evidence: [{ segment: "嘉宾A 00:23:06", text: "现在很多产品经理自己就能写代码" }],
          missingSteps: ["产品经理是否真的不需要设计师？"],
        },
      }]
    }
    const vps = normalizeViewpoints(raw)
    expect(vps[0].causalChain).toBeDefined()
    expect(vps[0].causalChain.premise).toBe("AI降低了编码成本")
    expect(vps[0].causalChain.missingSteps).toHaveLength(1)
  })

  it("handles empty viewpoints array", () => {
    const vps = normalizeViewpoints({ viewpoints: [] })
    expect(vps).toHaveLength(0)
  })

  it("handles viewpoints without evidenceQuotes gracefully", () => {
    const raw = {
      viewpoints: [{
        id: "vp_01", title: "test", summary: "test", speaker: "嘉宾A",
        timestamp: "00:00:01", confidence: 80, hotness: 60, level: "high",
      }]
    }
    const vps = normalizeViewpoints(raw)
    expect(vps).toHaveLength(1)
    expect(vps[0].evidenceQuotes).toBeDefined()
    expect(vps[0].evidenceQuotes.length).toBeGreaterThanOrEqual(0)
  })
})

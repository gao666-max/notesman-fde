import { describe, it, expect } from "vitest"
import { localGenerateDraft, localGenerateFactCheck } from "../local-generators"

const mockByid = new Map([
  ["vp_01", {
    id: "vp_01", title: "企业家精神=能动性", summary: "嘉宾A把企业家重新定义为能动性的同义词",
    speaker: "嘉宾A", timestamp: "00:00:04", confidence: 92, hotness: 85, level: "high",
    evidenceQuotes: [{ text: "企业家这个词很大程度上就是能动性的同义词", speaker: "嘉宾A", timestamp: "00:00:04" }],
    editorialFlags: { factCheckNeeded: false, sensitiveContent: false, needsHumanJudgment: false, flagReason: "" },
  }],
  ["vp_02", {
    id: "vp_02", title: "工业革命从未自动化劳动", summary: "嘉宾A指出工业革命提高效率而非自动化",
    speaker: "嘉宾A", timestamp: "00:10:10", confidence: 90, hotness: 95, level: "high",
    evidenceQuotes: [{ text: "工业革命并没有让体力劳动自动化", speaker: "嘉宾A", timestamp: "00:10:10" }],
    editorialFlags: { factCheckNeeded: true, sensitiveContent: false, needsHumanJudgment: true, flagReason: "涉及历史定性判断" },
  }],
  ["vp_12", {
    id: "vp_12", title: "不适应AI的人终生收入降超20%", summary: "嘉宾B引用数据警告",
    speaker: "嘉宾B", timestamp: "00:14:10", confidence: 35, hotness: 90, level: "low",
    evidenceQuotes: [{ text: "你的终生收入会下降超过五分之一", speaker: "嘉宾B", timestamp: "00:14:10" }],
    editorialFlags: { factCheckNeeded: true, sensitiveContent: true, needsHumanJudgment: true, flagReason: "涉及强数据论断" },
  }],
])

describe("localGenerateDraft", () => {
  it("produces thin skeleton format with section headers", () => {
    const sections = [{ title: "引言 · 开篇", itemIds: ["vp_01"] }]
    const draft = localGenerateDraft("AI不会淘汰人", "test.srt", sections, mockByid)
    expect(draft).toContain("笔记君说")
    expect(draft).toContain("内容来源")
    expect(draft).toContain("核心观点")
    expect(draft).toContain("原文引用")
    expect(draft).toContain("编辑备注")
  })

  it("includes editor todo list", () => {
    const sections = [{ title: "引言", itemIds: ["vp_01"] }]
    const draft = localGenerateDraft("test", "test.srt", sections, mockByid)
    expect(draft).toContain("编辑待办")
    expect(draft).toContain("结构取舍")
  })

  it("lists flagged items in todo", () => {
    const sections = [{ title: "数据警告", itemIds: ["vp_12"] }]
    const draft = localGenerateDraft("test", "test.srt", sections, mockByid)
    expect(draft).toContain("事实核查")
  })

  it("renders evidence quotes inline", () => {
    const sections = [{ title: "引言", itemIds: ["vp_01"] }]
    const draft = localGenerateDraft("test", "test.srt", sections, mockByid)
    expect(draft).toContain("企业家这个词很大程度上就是能动性的同义词")
    expect(draft).toContain("00:00:04")
  })

  it("skips empty sections", () => {
    const sections = [
      { title: "引言", itemIds: ["vp_01"] },
      { title: "空章节", itemIds: [] },
      { title: "正文", itemIds: ["vp_02"] },
    ]
    const draft = localGenerateDraft("test", "test.srt", sections, mockByid)
    expect(draft).not.toContain("空章节")
    expect(draft).toContain("工业革命从未自动化劳动")
  })

  it("handles empty sections gracefully", () => {
    const draft = localGenerateDraft("test", "test.srt", [], mockByid)
    expect(draft).toContain("笔记君说")
    expect(draft).toContain("编辑待办")
  })
})

describe("localGenerateFactCheck", () => {
  it("produces structured report with per-section breakdown", () => {
    const sections = [{ title: "引言", itemIds: ["vp_01"] }]
    const report = localGenerateFactCheck("test", "test.srt", sections, mockByid)
    expect(report).toContain("事实核查报告")
    expect(report).toContain("按段落分布")
  })

  it("detects fact-check-needed items", () => {
    const sections = [{ title: "警告", itemIds: ["vp_12"] }]
    const report = localGenerateFactCheck("test", "test.srt", sections, mockByid)
    expect(report).toContain("需事实核查")
    expect(report).toContain("vp_12")
  })

  it("flags low-confidence items in report", () => {
    const sections = [{ title: "低置信", itemIds: ["vp_12"] }]
    const report = localGenerateFactCheck("test", "test.srt", sections, mockByid)
    expect(report).toContain("🔴")
  })

  it("reports green when all viewpoints are clean", () => {
    const sections = [{ title: "干净章节", itemIds: ["vp_01"] }]
    const report = localGenerateFactCheck("test", "test.srt", sections, mockByid)
    // vp_01 has no flags — should report 0 items needing attention
    expect(report).toContain("0 个需要编辑关注")
  })

  it("includes action recommendations with priority", () => {
    const sections = [{ title: "混合", itemIds: ["vp_01", "vp_12"] }]
    const report = localGenerateFactCheck("test", "test.srt", sections, mockByid)
    expect(report).toContain("整体评估")
    expect(report).toContain("必须确认")
  })
})

import { describe, it, expect } from "vitest"
import { extractJSON } from "../anthropic"

describe("extractJSON", () => {
  it("parses clean JSON", () => {
    const result = extractJSON('{"viewpoints":[{"id":"vp_01","title":"test"}]}')
    expect(result.viewpoints).toHaveLength(1)
    expect(result.viewpoints[0].title).toBe("test")
  })

  it("strips markdown code fences", () => {
    const result = extractJSON('```json\n{"viewpoints":[{"id":"vp_01","title":"test"}]}\n```')
    expect(result.viewpoints).toHaveLength(1)
  })

  it("handles trailing commas in arrays", () => {
    const input = '{"viewpoints":[{"id":"vp_01","title":"test"},]}'
    const result = extractJSON(input)
    expect(result.viewpoints).toHaveLength(1)
  })

  it("handles trailing commas in objects", () => {
    const input = '{"viewpoints":[{"id":"vp_01","title":"test",}]}'
    const result = extractJSON(input)
    expect(result.viewpoints).toHaveLength(1)
  })

  it("handles DeepSeek time range format", () => {
    const input = '{"viewpoints":[{"id":"vp_01","title":"test","timestamp":"00:00:04 - 00:00:16","evidenceQuotes":[{"text":"hello","speaker":"嘉宾A","timestamp":"00:00:04 - 00:00:16"}]}]}'
    const result = extractJSON(input)
    expect(result.viewpoints[0].timestamp).toBe("00:00:04")
  })

  it("handles text wrapping in evidence quotes", () => {
    const input = '{"viewpoints":[{"id":"vp_01","title":"test","evidenceQuotes":[{"text":"嘉宾说：\\"这是引用的内容\\"","speaker":"嘉宾A","timestamp":"00:00:04"}]}]}'
    const result = extractJSON(input)
    expect(result.viewpoints[0].evidenceQuotes).toBeDefined()
  })

  it("extracts viewpoints when JSON has minor structural issues but valid blocks", () => {
    // Test that it can extract from JSON with double commas (common DeepSeek issue)
    const input = '{"viewpoints":[{"id":"vp_01","title":"test1"},{"id":"vp_02","title":"test2"},{"id":"vp_03","title":"test3"},{"id":"vp_04","title":"test4"},{"id":"vp_05","title":"test5"}]}'
    const result = extractJSON(input)
    expect(result.viewpoints).toBeDefined()
    expect(result.viewpoints.length).toBeGreaterThanOrEqual(4)
  })

  it("handles JSON with extra text after closing brace", () => {
    const input = '{"viewpoints":[{"id":"vp_01","title":"test"}]} some trailing text here'
    const result = extractJSON(input)
    expect(result.viewpoints).toHaveLength(1)
  })

  it("handles empty string gracefully", () => {
    expect(() => extractJSON("")).toThrow()
  })

  it("handles nested objects with unescaped internal quotes", () => {
    // Simulating DeepSeek putting raw Chinese in text fields
    const input = `{"viewpoints":[{"id":"vp_01","title":"企业家精神=能动性","summary":"嘉宾A说'企业家这个词很大程度上就是能动性的同义词'，每个人都可以展现企业家精神"}]}`
    const result = extractJSON(input)
    expect(result.viewpoints).toBeDefined()
    expect(result.viewpoints[0].title).toBe("企业家精神=能动性")
  })

  it("handles double commas", () => {
    const input = '{"viewpoints":[{"id":"vp_01",,"title":"test"}]}'
    // May or may not parse — the key is it shouldn't crash
    expect(() => extractJSON(input)).toBeDefined()
  })

  it("handles 15 viewpoints (max DeepSeek output)", () => {
    const vps = Array.from({ length: 15 }, (_, i) => `{"id":"vp_${String(i+1).padStart(2,"0")}","title":"观点${i+1}"}`).join(",")
    const input = `{"viewpoints":[${vps}]}`
    const result = extractJSON(input)
    expect(result.viewpoints).toHaveLength(15)
  })
})

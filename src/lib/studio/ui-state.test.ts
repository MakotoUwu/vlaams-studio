import { describe, expect, it } from "vitest"

import { scenarios } from "@/lib/practice-data"
import {
  cloneDefaultPreferences,
  focusForScenario,
  metricDetailCopy,
  panelTitleFor,
  updateVocabularyGoals,
} from "@/lib/studio/ui-state"

describe("studio UI state helpers", () => {
  it("toggles vocabulary goals while keeping at least one selected", () => {
    expect(updateVocabularyGoals(["broodsoorten"], "prijzen")).toEqual(["broodsoorten", "prijzen"])
    expect(updateVocabularyGoals(["broodsoorten", "prijzen"], "prijzen")).toEqual(["broodsoorten"])
    expect(updateVocabularyGoals(["prijzen"], "prijzen")).toEqual(["prijzen"])
  })

  it("creates a setup focus from a selected scenario", () => {
    const focus = focusForScenario(scenarios[0])

    expect(focus).toEqual({
      selectedVocabularyGoals: ["broodsoorten"],
      focusedGrammar: "Vraagzinnen met 'zou graag'",
    })
  })

  it("returns panel titles for button-triggered panels", () => {
    expect(panelTitleFor({ type: "profile" })).toBe("Profiel")
    expect(
      panelTitleFor({
        type: "metric",
        metric: { label: "Uitspraak", score: 72, note: "Let op: lange klinkers" },
      }),
    ).toBe("Uitspraak")
  })

  it("returns metric detail copy tied to the selected metric", () => {
    expect(metricDetailCopy({ label: "Woordenschat", score: 81, note: "Sterk" })).toContain(
      "woordenschat",
    )
  })

  it("clones default preferences for local reset without sharing references", () => {
    const defaults = { selectedVocabularyGoals: ["broodsoorten"], nested: { score: 78 } }
    const clone = cloneDefaultPreferences(defaults)

    clone.selectedVocabularyGoals.push("prijzen")
    clone.nested.score = 10

    expect(defaults).toEqual({ selectedVocabularyGoals: ["broodsoorten"], nested: { score: 78 } })
  })
})

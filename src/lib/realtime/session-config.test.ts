import { describe, expect, it } from "vitest"

import { buildRealtimeInstructions, buildRealtimeSessionConfig } from "@/lib/realtime/session-config"

describe("Realtime session config", () => {
  it("uses GPT Realtime 2 with low reasoning and the material search tool", () => {
    const config = buildRealtimeSessionConfig({
      level: "A2",
      scenarioId: "tram-stop",
      materialIds: ["lesson-1"],
      mode: "roleplay",
    })

    expect(config.model).toBe("gpt-realtime-2")
    expect(config.reasoning.effort).toBe("low")
    expect(config.audio.output.voice).toBe("marin")
    expect(config.tools[0]?.name).toBe("search_lesson_materials")
  })

  it("includes the selected level, scenario, and active materials in instructions", () => {
    const instructions = buildRealtimeInstructions({
      level: "B1",
      scenarioId: "doctor-appointment",
      materialIds: ["lesson-a", "lesson-b"],
      mode: "roleplay",
    })

    expect(instructions).toContain("CEFR level B1")
    expect(instructions).toContain("At the doctor appointment")
    expect(instructions).toContain("lesson-a, lesson-b")
  })
})

import { createHash } from "node:crypto"

import { scenarios, type PracticeLevel } from "@/lib/practice-data"

export type RealtimeSessionInput = {
  level: PracticeLevel
  scenarioId: string
  materialIds: string[]
  mode: "roleplay" | "review"
}

export type RealtimeSessionConfig = {
  type: "realtime"
  model: "gpt-realtime-2"
  output_modalities: ["audio"]
  instructions: string
  reasoning: {
    effort: "low"
  }
  audio: {
    input: {
      turn_detection: {
        type: "semantic_vad"
      }
    }
    output: {
      voice: "marin"
      speed: 1
    }
  }
  tools: Array<{
    type: "function"
    name: "search_lesson_materials"
    description: string
    parameters: {
      type: "object"
      properties: Record<string, unknown>
      required: string[]
    }
  }>
  tool_choice: "auto"
}

export function buildSafetyIdentifier() {
  return createHash("sha256").update("vlaams-studio-local-user").digest("hex").slice(0, 32)
}

export function buildRealtimeInstructions(input: RealtimeSessionInput) {
  const scenario = scenarios.find((item) => item.id === input.scenarioId) ?? scenarios[0]
  const materialLine = input.materialIds.length
    ? `Active lesson material IDs: ${input.materialIds.join(", ")}.`
    : "No uploaded lesson material is active."

  return `# Role and Objective
You are a Flemish practice tutor for an adult learner in Belgium.
Run a spoken roleplay for CEFR level ${input.level}. Current scenario: ${scenario.title} in ${scenario.location}.
Goal: ${scenario.objective}

# Language
Use clear Flemish/Dutch by default.
Match level ${input.level}. Keep sentences short for A1 and A2. Use richer phrasing for B1 and B2.
Use English only if the learner asks, gets blocked, or needs a brief grammar explanation.

# Conversation
Start in character with: "${scenario.starter}"
Keep the learner speaking. Ask one question at a time.
Do not lecture. Continue the scene after each correction.

# Corrections
Correct lightly after the learner speaks.
Give one natural correction and one better phrase, then return to the roleplay.
Prefer practical Flemish wording over textbook explanations.

# Lesson Context
${materialLine}
Use uploaded lesson material when it helps with vocabulary, grammar, or the current course topic.
If no relevant material is available, say so briefly and continue from the current scenario.

# Tools
Use only the provided tools.
Call search_lesson_materials when you need vocabulary, grammar, teacher notes, or examples from uploaded lesson material.
Do not pretend you read a file unless the tool returned relevant chunks.

# Unclear Audio
If the learner's audio is unclear, ask them to repeat it clearly.
Do not guess exact words from unclear audio.

# Verbosity
Spoken responses should be brief: usually one to three sentences.
For corrections, use this shape: "Better: [phrase]. Try it once more."
`
}

export function buildRealtimeSessionConfig(input: RealtimeSessionInput): RealtimeSessionConfig {
  return {
    type: "realtime",
    model: "gpt-realtime-2",
    output_modalities: ["audio"],
    instructions: buildRealtimeInstructions(input),
    reasoning: {
      effort: "low",
    },
    audio: {
      input: {
        turn_detection: {
          type: "semantic_vad",
        },
      },
      output: {
        voice: "marin",
        speed: 1,
      },
    },
    tools: [
      {
        type: "function",
        name: "search_lesson_materials",
        description:
          "Search uploaded lesson materials for course vocabulary, grammar notes, and examples relevant to the live Flemish practice session.",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "A concise search query in Dutch, Flemish, or English.",
            },
            materialIds: {
              type: "array",
              items: { type: "string" },
              description: "Optional active lesson material IDs to search.",
            },
          },
          required: ["query"],
        },
      },
    ],
    tool_choice: "auto",
  }
}

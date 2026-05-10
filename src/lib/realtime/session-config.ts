import { createHash } from "node:crypto"

import { scenarios, type PracticeLevel } from "@/lib/practice-data"

export type RealtimeSessionInput = {
  level: PracticeLevel
  scenarioId: string
  materialIds: string[]
  mode: "roleplay" | "review"
  focusedVocabulary?: string[]
  focusedGrammar?: string | null
  correctionStyle?: "gentle" | "direct"
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
      transcription: {
        model: "gpt-realtime-whisper"
        language: "nl"
      }
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
    name: "search_lesson_materials" | "record_correction" | "end_practice_session"
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

# Ending the Session
End the practice only when it naturally makes sense: the learner completed the scenario goal, the scene reached a clear closing point, or the learner asks to stop.
Do not end after a single answer or immediately after one correction unless the learner explicitly wants to stop.
Before ending, say one brief spoken wrap-up with what went well and one next step.
Then call end_practice_session so the app can stop the live microphone/session cleanly.

# Corrections
Correct lightly after the learner speaks.
Give one natural correction and one better phrase, then return to the roleplay.
Prefer practical Flemish wording over textbook explanations.
When you correct a learner phrase, call record_correction with the original phrase, corrected phrase, brief reason, grammar point when relevant, and a short retry prompt.
Correction style: ${input.correctionStyle ?? "gentle"}.
${input.focusedVocabulary?.length ? `Prioritize these vocabulary goals: ${input.focusedVocabulary.join(", ")}.` : ""}
${input.focusedGrammar ? `Current grammar focus: ${input.focusedGrammar}.` : ""}

# Lesson Context
${materialLine}
Use uploaded lesson material when it helps with vocabulary, grammar, or the current course topic.
If no relevant material is available, say so briefly and continue from the current scenario.

# Tools
Use only the provided tools.
Call search_lesson_materials when you need vocabulary, grammar, teacher notes, or examples from uploaded lesson material.
Call record_correction after giving a meaningful correction so the app can show it in the learner timeline.
Call end_practice_session only after a natural final wrap-up.
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
        transcription: {
          model: "gpt-realtime-whisper",
          language: "nl",
        },
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
      {
        type: "function",
        name: "record_correction",
        description:
          "Record a concise correction for the learner UI after the tutor corrects a Flemish or Dutch phrase.",
        parameters: {
          type: "object",
          properties: {
            original: {
              type: "string",
              description: "The learner phrase that needs improvement.",
            },
            corrected: {
              type: "string",
              description: "A natural corrected Flemish/Dutch phrase.",
            },
            reason: {
              type: "string",
              description: "A brief learner-friendly reason for the correction.",
            },
            grammarPoint: {
              type: "string",
              description: "Optional grammar or pronunciation focus, if relevant.",
            },
            retryPrompt: {
              type: "string",
              description: "A short prompt asking the learner to try the corrected phrase again.",
            },
          },
          required: ["original", "corrected", "reason"],
        },
      },
      {
        type: "function",
        name: "end_practice_session",
        description:
          "End the live Flemish practice session after the learner completes the scenario, reaches a natural closing point, or asks to stop.",
        parameters: {
          type: "object",
          properties: {
            reason: {
              type: "string",
              description: "Why the session should end now.",
            },
            summary: {
              type: "string",
              description: "One concise learner-facing summary of the practice result.",
            },
            nextStep: {
              type: "string",
              description: "Optional next step for the learner's next practice session.",
            },
          },
          required: ["reason", "summary"],
        },
      },
    ],
    tool_choice: "auto",
  }
}

export type TranscriptSpeaker = "Tutor" | "You" | "Correction" | "Material" | "System"
export type RealtimePhase =
  | "idle"
  | "connecting"
  | "listening"
  | "transcribing"
  | "tutor-speaking"
  | "searching-materials"
  | "ending"
  | "reconnecting"
  | "missing-key"
  | "mic-error"
  | "error"

export type CorrectionPayload = {
  original: string
  corrected: string
  reason: string
  grammarPoint?: string
  retryPrompt?: string
}

export type SessionEndPayload = {
  reason: string
  summary: string
  nextStep?: string
}

export type TranscriptTurn = {
  id: string
  speaker: TranscriptSpeaker
  text: string
  status: "partial" | "final" | "error" | "tool"
  correction?: CorrectionPayload
  material?: {
    query: string
    chunkCount: number
  }
}

export type RealtimeFunctionCall = {
  type: "function_call"
  name: string
  call_id: string
  arguments: string
}

export type MaterialSearchArguments = {
  query: string
  materialIds?: string[]
}

type RealtimeServerEvent = {
  type?: string
  item_id?: string
  response_id?: string
  output_index?: number
  content_index?: number
  delta?: string
  transcript?: string
  response?: { output?: unknown[] }
  error?: { message?: string }
}

export type RealtimeEventResult = {
  turns: TranscriptTurn[]
  functionCalls: RealtimeFunctionCall[]
  errorMessage?: string
  phase?: RealtimePhase
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object"
}

export function parseRealtimeServerMessage(data: string): RealtimeServerEvent | null {
  try {
    const parsed = JSON.parse(data)
    return isObject(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function isFunctionCall(value: unknown): value is RealtimeFunctionCall {
  if (!isObject(value)) return false

  return (
    value.type === "function_call" &&
    typeof value.name === "string" &&
    typeof value.call_id === "string" &&
    typeof value.arguments === "string"
  )
}

export function parseMaterialSearchArguments(rawArguments: string): MaterialSearchArguments {
  try {
    const parsed = JSON.parse(rawArguments || "{}")
    if (!isObject(parsed) || typeof parsed.query !== "string") {
      return { query: "" }
    }

    const materialIds = Array.isArray(parsed.materialIds)
      ? parsed.materialIds.filter((id): id is string => typeof id === "string")
      : undefined

    return {
      query: parsed.query,
      ...(materialIds?.length ? { materialIds } : {}),
    }
  } catch {
    return { query: "" }
  }
}

export function parseCorrectionArguments(rawArguments: string): CorrectionPayload | null {
  try {
    const parsed = JSON.parse(rawArguments || "{}")
    if (!isObject(parsed)) return null

    const original = typeof parsed.original === "string" ? parsed.original.trim() : ""
    const corrected = typeof parsed.corrected === "string" ? parsed.corrected.trim() : ""
    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : ""
    const grammarPoint =
      typeof parsed.grammarPoint === "string" && parsed.grammarPoint.trim()
        ? parsed.grammarPoint.trim()
        : undefined
    const retryPrompt =
      typeof parsed.retryPrompt === "string" && parsed.retryPrompt.trim()
        ? parsed.retryPrompt.trim()
        : undefined

    if (!original || !corrected || !reason) return null

    return {
      original,
      corrected,
      reason,
      ...(grammarPoint ? { grammarPoint } : {}),
      ...(retryPrompt ? { retryPrompt } : {}),
    }
  } catch {
    return null
  }
}

export function parseSessionEndArguments(rawArguments: string): SessionEndPayload | null {
  try {
    const parsed = JSON.parse(rawArguments || "{}")
    if (!isObject(parsed)) return null

    const reason = typeof parsed.reason === "string" ? parsed.reason.trim() : ""
    const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : ""
    const nextStep =
      typeof parsed.nextStep === "string" && parsed.nextStep.trim() ? parsed.nextStep.trim() : undefined

    if (!reason || !summary) return null

    return {
      reason,
      summary,
      ...(nextStep ? { nextStep } : {}),
    }
  } catch {
    return null
  }
}

export function createMaterialLookupTurn(query: string, chunkCount: number): TranscriptTurn {
  const safeQuery = query.trim() || "de huidige oefening"

  return {
    id: `material-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    speaker: "Material",
    status: "tool",
    material: {
      query: safeQuery,
      chunkCount,
    },
    text:
      chunkCount > 0
        ? `Lesmateriaal gebruikt: ${chunkCount} fragment${chunkCount === 1 ? "" : "en"} voor "${safeQuery}".`
        : `Geen passend lesmateriaal gevonden voor "${safeQuery}".`,
  }
}

export function createSessionEndedTurn(payload: SessionEndPayload | null): TranscriptTurn {
  const summary = payload?.summary?.trim() || "De oefensessie is afgerond."
  const nextStep = payload?.nextStep?.trim()

  return {
    id: `session-ended-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    speaker: "System",
    status: "tool",
    text: nextStep ? `Sessie afgerond: ${summary} Volgende stap: ${nextStep}` : `Sessie afgerond: ${summary}`,
  }
}

export function createCorrectionTurn(correction: CorrectionPayload): TranscriptTurn {
  return {
    id: `correction-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    speaker: "Correction",
    status: "final",
    correction,
    text: correction.corrected,
  }
}

function turnIdFor(event: RealtimeServerEvent, speaker: "Tutor" | "You") {
  if (speaker === "You") {
    return `you-${event.item_id ?? "current"}`
  }

  const responseId = event.response_id ?? "current"
  const outputIndex = event.output_index ?? 0
  const contentIndex = event.content_index ?? 0
  return `tutor-${responseId}-${outputIndex}-${contentIndex}`
}

function upsertTranscriptTurn({
  turns,
  id,
  speaker,
  text,
  status,
  mode,
}: {
  turns: TranscriptTurn[]
  id: string
  speaker: "Tutor" | "You"
  text: string
  status: "partial" | "final"
  mode: "append" | "replace"
}) {
  const nextText = text.trimStart()
  if (!nextText) return turns

  const existingIndex = turns.findIndex((turn) => turn.id === id)
  if (existingIndex === -1) {
    return [...turns, { id, speaker, text: nextText, status }]
  }

  return turns.map((turn, index) => {
    if (index !== existingIndex) return turn
    const shouldReplaceListeningPlaceholder = turn.speaker === "You" && turn.text === "Aan het luisteren..."
    return {
      ...turn,
      text: mode === "append" && !shouldReplaceListeningPlaceholder ? `${turn.text}${text}` : nextText,
      status,
    }
  })
}

export function applyRealtimeServerEvent(
  currentTurns: TranscriptTurn[],
  event: RealtimeServerEvent | null,
): RealtimeEventResult {
  if (!event?.type) {
    return {
      turns: [
        ...currentTurns,
        {
          id: `system-invalid-${currentTurns.length}`,
          speaker: "System",
          status: "error",
          text: "Realtime stuurde een ongeldig event.",
        },
      ],
      functionCalls: [],
      errorMessage: "Realtime sent an invalid event.",
      phase: "error",
    }
  }

  if (event.type === "input_audio_buffer.speech_started") {
    const id = turnIdFor(event, "You")
    return {
      turns: upsertTranscriptTurn({
        turns: currentTurns,
        id,
        speaker: "You",
        text: "Aan het luisteren...",
        status: "partial",
        mode: "replace",
      }),
      functionCalls: [],
      phase: "listening",
    }
  }

  if (event.type === "input_audio_buffer.speech_stopped") {
    return {
      turns: currentTurns,
      functionCalls: [],
      phase: "transcribing",
    }
  }

  if (event.type === "conversation.item.input_audio_transcription.delta" && event.delta) {
    return {
      turns: upsertTranscriptTurn({
        turns: currentTurns,
        id: turnIdFor(event, "You"),
        speaker: "You",
        text: event.delta,
        status: "partial",
        mode: "append",
      }),
      functionCalls: [],
      phase: "transcribing",
    }
  }

  if (event.type === "conversation.item.input_audio_transcription.completed" && event.transcript) {
    return {
      turns: upsertTranscriptTurn({
        turns: currentTurns,
        id: turnIdFor(event, "You"),
        speaker: "You",
        text: event.transcript,
        status: "final",
        mode: "replace",
      }),
      functionCalls: [],
      phase: "transcribing",
    }
  }

  if (event.type === "response.output_audio_transcript.delta" && event.delta) {
    return {
      turns: upsertTranscriptTurn({
        turns: currentTurns,
        id: turnIdFor(event, "Tutor"),
        speaker: "Tutor",
        text: event.delta,
        status: "partial",
        mode: "append",
      }),
      functionCalls: [],
      phase: "tutor-speaking",
    }
  }

  if (event.type === "response.output_audio_transcript.done" && event.transcript) {
    return {
      turns: upsertTranscriptTurn({
        turns: currentTurns,
        id: turnIdFor(event, "Tutor"),
        speaker: "Tutor",
        text: event.transcript,
        status: "final",
        mode: "replace",
      }),
      functionCalls: [],
      phase: "tutor-speaking",
    }
  }

  if (event.type === "response.done") {
    const functionCalls = (event.response?.output ?? []).filter(isFunctionCall)
    const hasSessionEndCall = functionCalls.some((call) => call.name === "end_practice_session")
    const hasMaterialSearchCall = functionCalls.some((call) => call.name === "search_lesson_materials")

    return {
      turns: currentTurns,
      functionCalls,
      phase: hasSessionEndCall ? "ending" : hasMaterialSearchCall ? "searching-materials" : "listening",
    }
  }

  if (event.type === "error") {
    const errorMessage = event.error?.message ?? "Realtime session error."

    return {
      turns: [
        ...currentTurns,
        {
          id: `system-error-${currentTurns.length}`,
          speaker: "System",
          status: "error",
          text: errorMessage,
        },
      ],
      functionCalls: [],
      errorMessage,
      phase: "error",
    }
  }

  return {
    turns: currentTurns,
    functionCalls: [],
  }
}

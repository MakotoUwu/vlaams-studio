import { describe, expect, it } from "vitest"

import {
  applyRealtimeServerEvent,
  createCorrectionTurn,
  createMaterialLookupTurn,
  createSessionEndedTurn,
  parseMaterialSearchArguments,
  parseCorrectionArguments,
  parseRealtimeServerMessage,
  parseSessionEndArguments,
} from "@/lib/realtime/events"

describe("Realtime event reducer", () => {
  it("maps user transcript deltas and completions into one chat turn", () => {
    const started = applyRealtimeServerEvent([], {
      type: "input_audio_buffer.speech_started",
      item_id: "item-user-1",
    })

    const delta = applyRealtimeServerEvent(started.turns, {
      type: "conversation.item.input_audio_transcription.delta",
      item_id: "item-user-1",
      delta: "Ik wil brood",
    })

    const completed = applyRealtimeServerEvent(delta.turns, {
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "item-user-1",
      transcript: "Ik wil graag brood.",
    })

    expect(completed.turns).toEqual([
      {
        id: "you-item-user-1",
        speaker: "You",
        text: "Ik wil graag brood.",
        status: "final",
      },
    ])
    expect(completed.phase).toBe("transcribing")
  })

  it("maps tutor audio transcript deltas and completions into one chat turn", () => {
    const delta = applyRealtimeServerEvent([], {
      type: "response.output_audio_transcript.delta",
      response_id: "resp-1",
      output_index: 0,
      content_index: 0,
      delta: "Goeiemorgen, ",
    })

    const completed = applyRealtimeServerEvent(delta.turns, {
      type: "response.output_audio_transcript.done",
      response_id: "resp-1",
      output_index: 0,
      content_index: 0,
      transcript: "Goeiemorgen, wat mag het zijn?",
    })

    expect(completed.turns).toEqual([
      {
        id: "tutor-resp-1-0-0",
        speaker: "Tutor",
        text: "Goeiemorgen, wat mag het zijn?",
        status: "final",
      },
    ])
  })

  it("extracts material search function calls from response.done", () => {
    const result = applyRealtimeServerEvent([], {
      type: "response.done",
      response: {
        output: [
          {
            type: "function_call",
            name: "search_lesson_materials",
            call_id: "call-1",
            arguments: "{\"query\":\"brood bestellen\"}",
          },
        ],
      },
    })

    expect(result.functionCalls).toHaveLength(1)
    expect(result.functionCalls[0]).toMatchObject({
      name: "search_lesson_materials",
      call_id: "call-1",
    })
    expect(result.phase).toBe("searching-materials")
  })

  it("extracts session end function calls and maps the phase to ending", () => {
    const result = applyRealtimeServerEvent([], {
      type: "response.done",
      response: {
        output: [
          {
            type: "function_call",
            name: "end_practice_session",
            call_id: "call-end",
            arguments: "{\"reason\":\"scenario complete\",\"summary\":\"You ordered bread clearly.\"}",
          },
        ],
      },
    })

    expect(result.functionCalls).toHaveLength(1)
    expect(result.functionCalls[0]).toMatchObject({
      name: "end_practice_session",
      call_id: "call-end",
    })
    expect(result.phase).toBe("ending")
  })

  it("guards malformed JSON in server events and tool arguments", () => {
    const event = parseRealtimeServerMessage("{not valid")
    const result = applyRealtimeServerEvent([], event)

    expect(result.errorMessage).toBe("Realtime sent an invalid event.")
    expect(result.turns[0]).toMatchObject({ speaker: "System", status: "error" })
    expect(result.phase).toBe("error")
    expect(parseMaterialSearchArguments("{not valid")).toEqual({ query: "" })
    expect(parseCorrectionArguments("{not valid")).toBeNull()
    expect(parseSessionEndArguments("{not valid")).toBeNull()
  })

  it("filters material IDs from function-call arguments", () => {
    expect(
      parseMaterialSearchArguments(
        JSON.stringify({ query: "prijzen", materialIds: ["lesson-1", 42, "lesson-2"] }),
      ),
    ).toEqual({ query: "prijzen", materialIds: ["lesson-1", "lesson-2"] })
  })

  it("maps speech stopped and tutor transcript events into realtime phases", () => {
    expect(
      applyRealtimeServerEvent([], {
        type: "input_audio_buffer.speech_stopped",
      }).phase,
    ).toBe("transcribing")

    expect(
      applyRealtimeServerEvent([], {
        type: "response.output_audio_transcript.delta",
        response_id: "resp-1",
        delta: "Goed, ",
      }).phase,
    ).toBe("tutor-speaking")
  })

  it("parses correction tool arguments and creates a correction turn", () => {
    const correction = parseCorrectionArguments(
      JSON.stringify({
        original: "Ik wil brood",
        corrected: "Ik zou graag een brood willen.",
        reason: "Klinkt beleefder in de bakkerij.",
        grammarPoint: "zou graag",
        retryPrompt: "Zeg het nog eens met zou graag.",
      }),
    )

    expect(correction).toEqual({
      original: "Ik wil brood",
      corrected: "Ik zou graag een brood willen.",
      reason: "Klinkt beleefder in de bakkerij.",
      grammarPoint: "zou graag",
      retryPrompt: "Zeg het nog eens met zou graag.",
    })

    expect(createCorrectionTurn(correction!)).toMatchObject({
      speaker: "Correction",
      status: "final",
      text: "Ik zou graag een brood willen.",
      correction,
    })
  })

  it("adds material metadata to material lookup turns", () => {
    expect(createMaterialLookupTurn("prijzen", 2)).toMatchObject({
      speaker: "Material",
      status: "tool",
      material: {
        query: "prijzen",
        chunkCount: 2,
      },
    })
  })

  it("parses session end arguments and creates a system turn", () => {
    const payload = parseSessionEndArguments(
      JSON.stringify({
        reason: "scenario complete",
        summary: "Je hebt brood besteld en naar de prijs gevraagd.",
        nextStep: "Oefen volgende keer met hoeveelheden.",
      }),
    )

    expect(payload).toEqual({
      reason: "scenario complete",
      summary: "Je hebt brood besteld en naar de prijs gevraagd.",
      nextStep: "Oefen volgende keer met hoeveelheden.",
    })

    expect(createSessionEndedTurn(payload)).toMatchObject({
      speaker: "System",
      status: "tool",
      text: "Sessie afgerond: Je hebt brood besteld en naar de prijs gevraagd. Volgende stap: Oefen volgende keer met hoeveelheden.",
    })
  })
})

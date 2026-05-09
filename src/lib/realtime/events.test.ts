import { describe, expect, it } from "vitest"

import {
  applyRealtimeServerEvent,
  parseMaterialSearchArguments,
  parseRealtimeServerMessage,
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
  })

  it("guards malformed JSON in server events and tool arguments", () => {
    const event = parseRealtimeServerMessage("{not valid")
    const result = applyRealtimeServerEvent([], event)

    expect(result.errorMessage).toBe("Realtime sent an invalid event.")
    expect(result.turns[0]).toMatchObject({ speaker: "System", status: "error" })
    expect(parseMaterialSearchArguments("{not valid")).toEqual({ query: "" })
  })

  it("filters material IDs from function-call arguments", () => {
    expect(
      parseMaterialSearchArguments(
        JSON.stringify({ query: "prijzen", materialIds: ["lesson-1", 42, "lesson-2"] }),
      ),
    ).toEqual({ query: "prijzen", materialIds: ["lesson-1", "lesson-2"] })
  })
})

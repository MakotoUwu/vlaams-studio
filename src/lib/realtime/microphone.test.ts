import { describe, expect, it } from "vitest"

import { microphoneErrorMessage } from "@/lib/realtime/microphone"

describe("microphoneErrorMessage", () => {
  it("explains blocked browser permissions", () => {
    expect(microphoneErrorMessage({ name: "NotAllowedError" })).toContain(
      "Allow microphone access",
    )
  })

  it("explains missing microphone devices", () => {
    expect(microphoneErrorMessage({ name: "NotFoundError" })).toContain("No microphone")
  })

  it("explains busy or system-blocked devices", () => {
    expect(microphoneErrorMessage({ name: "NotReadableError" })).toContain("already in use")
  })

  it("falls back for unknown failures", () => {
    expect(microphoneErrorMessage(new Error("failed"))).toContain("Could not start")
  })
})

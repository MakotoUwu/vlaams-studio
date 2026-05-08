import { describe, expect, it } from "vitest"

import { chunkMaterialText, normalizeMaterialText } from "@/lib/materials/chunk"

describe("material chunking", () => {
  it("normalizes whitespace without losing paragraph boundaries", () => {
    expect(normalizeMaterialText("Hallo   daar\r\n\r\n\r\nIk wil\tbrood.")).toBe(
      "Hallo daar\n\nIk wil brood.",
    )
  })

  it("chunks long lesson text into stable ordered chunks", () => {
    const text = Array.from({ length: 12 }, (_, index) => `Paragraaf ${index + 1} over brood bestellen.`).join(
      "\n\n",
    )
    const chunks = chunkMaterialText(text, 120)

    expect(chunks.length).toBeGreaterThan(1)
    expect(chunks[0]).toMatchObject({ id: "chunk-1", index: 0 })
    expect(chunks.every((chunk) => chunk.tokenEstimate > 0)).toBe(true)
  })
})

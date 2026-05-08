import { describe, expect, it } from "vitest"

import { searchMaterialChunks, type StoredMaterial } from "@/lib/materials/search"

const materials: StoredMaterial[] = [
  {
    summary: {
      id: "shopping",
      title: "Shopping and food",
      kind: "text",
      chunkCount: 1,
      createdAt: "2026-05-08T12:00:00.000Z",
    },
    chunks: [
      {
        id: "chunk-1",
        index: 0,
        tokenEstimate: 12,
        text: "Gebruik graag bij een bestelling: Ik had graag een brood.",
      },
    ],
  },
  {
    summary: {
      id: "transport",
      title: "Tram and train",
      kind: "text",
      chunkCount: 1,
      createdAt: "2026-05-08T12:00:00.000Z",
    },
    chunks: [
      {
        id: "chunk-1",
        index: 0,
        tokenEstimate: 8,
        text: "Vraag naar de juiste halte en richting.",
      },
    ],
  },
]

describe("material search", () => {
  it("returns relevant chunks by text match", () => {
    const results = searchMaterialChunks({ query: "brood bestellen", materials })

    expect(results[0]).toMatchObject({
      materialId: "shopping",
      title: "Shopping and food",
    })
  })

  it("respects selected material IDs", () => {
    const results = searchMaterialChunks({
      query: "halte",
      materials,
      materialIds: ["shopping"],
    })

    expect(results).toEqual([])
  })
})

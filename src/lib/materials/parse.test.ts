import { describe, expect, it } from "vitest"

import { getMaterialKind, parseMaterialBuffer } from "@/lib/materials/parse"

describe("material parsing", () => {
  it("accepts text, markdown, and PDF lesson material types", () => {
    expect(getMaterialKind("lesson.txt", "text/plain")).toBe("text")
    expect(getMaterialKind("lesson.md", "text/markdown")).toBe("text")
    expect(getMaterialKind("lesson.pdf", "application/pdf")).toBe("pdf")
  })

  it("rejects unsupported upload types before storage", async () => {
    await expect(
      parseMaterialBuffer({
        fileName: "lesson.png",
        mimeType: "image/png",
        buffer: Buffer.from("not a lesson"),
      }),
    ).rejects.toThrow("Only text, markdown, and PDF files are supported.")
  })

  it("normalizes uploaded text material", async () => {
    await expect(
      parseMaterialBuffer({
        fileName: "bakkerij.md",
        mimeType: "text/markdown",
        buffer: Buffer.from("  Ik wil   graag brood.\n\nDank u.  "),
      }),
    ).resolves.toMatchObject({
      title: "bakkerij",
      kind: "text",
      text: "Ik wil graag brood.\n\nDank u.",
    })
  })
})

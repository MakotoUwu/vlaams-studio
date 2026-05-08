import { PDFParse } from "pdf-parse"

import { normalizeMaterialText } from "@/lib/materials/chunk"

export type ParsedMaterial = {
  title: string
  kind: "text" | "pdf"
  text: string
}

const textExtensions = [".txt", ".md", ".markdown"]
const pdfExtensions = [".pdf"]

function getExtension(fileName: string) {
  const lower = fileName.toLowerCase()
  const dotIndex = lower.lastIndexOf(".")
  return dotIndex >= 0 ? lower.slice(dotIndex) : ""
}

export function getMaterialKind(fileName: string, mimeType?: string): ParsedMaterial["kind"] | null {
  const extension = getExtension(fileName)
  if (pdfExtensions.includes(extension) || mimeType === "application/pdf") return "pdf"
  if (
    textExtensions.includes(extension) ||
    mimeType?.startsWith("text/") ||
    mimeType === "application/octet-stream"
  ) {
    return "text"
  }
  return null
}

export async function parseMaterialBuffer(input: {
  fileName: string
  mimeType?: string
  buffer: Buffer
}): Promise<ParsedMaterial> {
  const kind = getMaterialKind(input.fileName, input.mimeType)
  if (!kind) {
    throw new Error("Only text, markdown, and PDF files are supported.")
  }

  const title = input.fileName.replace(/\.[^.]+$/, "").trim() || "Untitled lesson material"

  if (kind === "text") {
    const text = normalizeMaterialText(new TextDecoder("utf-8").decode(input.buffer))
    if (!text) throw new Error("The uploaded text file was empty.")
    return { title, kind, text }
  }

  const parser = new PDFParse({ data: input.buffer })
  try {
    const result = await parser.getText()
    const text = normalizeMaterialText(result.text)
    if (!text) throw new Error("No readable text was found in the PDF.")
    return { title, kind, text }
  } finally {
    await parser.destroy()
  }
}

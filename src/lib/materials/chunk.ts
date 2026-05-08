export type MaterialChunk = {
  id: string
  text: string
  index: number
  tokenEstimate: number
}

const defaultChunkSize = 900
const defaultOverlap = 120

export function normalizeMaterialText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export function chunkMaterialText(text: string, chunkSize = defaultChunkSize): MaterialChunk[] {
  const normalized = normalizeMaterialText(text)
  if (!normalized) return []

  const paragraphs = normalized.split(/\n\s*\n/g)
  const chunks: string[] = []
  let current = ""

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim()
    if (!trimmed) continue

    if (trimmed.length > chunkSize) {
      if (current) {
        chunks.push(current.trim())
        current = ""
      }

      for (let start = 0; start < trimmed.length; start += chunkSize - defaultOverlap) {
        chunks.push(trimmed.slice(start, start + chunkSize).trim())
      }
      continue
    }

    const next = current ? `${current}\n\n${trimmed}` : trimmed
    if (next.length > chunkSize && current) {
      chunks.push(current.trim())
      current = trimmed
    } else {
      current = next
    }
  }

  if (current) chunks.push(current.trim())

  return chunks.map((chunk, index) => ({
    id: `chunk-${index + 1}`,
    text: chunk,
    index,
    tokenEstimate: Math.ceil(chunk.length / 4),
  }))
}

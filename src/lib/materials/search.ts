import type { MaterialChunk } from "@/lib/materials/chunk"
import type { LessonMaterialSummary } from "@/lib/practice-data"

export type StoredMaterial = {
  summary: LessonMaterialSummary
  chunks: MaterialChunk[]
}

export type MaterialSearchResult = {
  materialId: string
  title: string
  chunkId: string
  text: string
  score: number
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u024f\s-]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2)
}

export function searchMaterialChunks(input: {
  query: string
  materials: StoredMaterial[]
  materialIds?: string[]
  limit?: number
}): MaterialSearchResult[] {
  const terms = tokenize(input.query)
  if (!terms.length) return []

  const selectedIds = new Set(input.materialIds ?? [])
  const scopedMaterials = selectedIds.size
    ? input.materials.filter((material) => selectedIds.has(material.summary.id))
    : input.materials

  const scored: MaterialSearchResult[] = []

  for (const material of scopedMaterials) {
    const titleTerms = tokenize(material.summary.title)
    for (const chunk of material.chunks) {
      const chunkText = chunk.text.toLowerCase()
      let score = 0

      for (const term of terms) {
        if (chunkText.includes(term)) score += 2
        if (titleTerms.includes(term)) score += 1
      }

      if (score > 0) {
        scored.push({
          materialId: material.summary.id,
          title: material.summary.title,
          chunkId: chunk.id,
          text: chunk.text,
          score,
        })
      }
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, input.limit ?? 5)
}

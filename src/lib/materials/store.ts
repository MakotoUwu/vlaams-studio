import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

import { chunkMaterialText, type MaterialChunk } from "@/lib/materials/chunk"
import type { ParsedMaterial } from "@/lib/materials/parse"
import type { StoredMaterial } from "@/lib/materials/search"
import type { LessonMaterialSummary } from "@/lib/practice-data"

const materialRoot = path.join(process.cwd(), ".local", "materials")
const indexPath = path.join(materialRoot, "index.json")

type MaterialIndex = {
  materials: LessonMaterialSummary[]
}

function materialPath(id: string) {
  return path.join(materialRoot, `${id}.json`)
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 42)
}

async function ensureMaterialRoot() {
  await mkdir(materialRoot, { recursive: true })
}

async function readIndex(): Promise<MaterialIndex> {
  await ensureMaterialRoot()
  try {
    const raw = await readFile(indexPath, "utf-8")
    return JSON.parse(raw) as MaterialIndex
  } catch {
    return { materials: [] }
  }
}

async function writeIndex(index: MaterialIndex) {
  await ensureMaterialRoot()
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, "utf-8")
}

export async function listMaterialSummaries() {
  const index = await readIndex()
  return index.materials.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function createStoredMaterial(parsed: ParsedMaterial) {
  const chunks = chunkMaterialText(parsed.text)
  if (!chunks.length) {
    throw new Error("No readable lesson text was found after parsing.")
  }

  const id = `${Date.now()}-${slugify(parsed.title) || "material"}`
  const summary: LessonMaterialSummary = {
    id,
    title: parsed.title,
    kind: parsed.kind,
    chunkCount: chunks.length,
    createdAt: new Date().toISOString(),
  }

  await ensureMaterialRoot()
  await writeFile(materialPath(id), `${JSON.stringify({ summary, chunks }, null, 2)}\n`, "utf-8")

  const index = await readIndex()
  await writeIndex({
    materials: [summary, ...index.materials.filter((material) => material.id !== id)],
  })

  return summary
}

async function readStoredMaterial(summary: LessonMaterialSummary): Promise<StoredMaterial | null> {
  try {
    const raw = await readFile(materialPath(summary.id), "utf-8")
    const parsed = JSON.parse(raw) as { summary: LessonMaterialSummary; chunks: MaterialChunk[] }
    return parsed
  } catch {
    return null
  }
}

export async function readStoredMaterials(materialIds?: string[]) {
  const selectedIds = new Set(materialIds ?? [])
  const summaries = await listMaterialSummaries()
  const scoped = selectedIds.size
    ? summaries.filter((summary) => selectedIds.has(summary.id))
    : summaries

  const materials = await Promise.all(scoped.map((summary) => readStoredMaterial(summary)))
  return materials.filter((material): material is StoredMaterial => Boolean(material))
}

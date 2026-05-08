import { NextResponse } from "next/server"

import { parseMaterialBuffer } from "@/lib/materials/parse"
import { createStoredMaterial, listMaterialSummaries } from "@/lib/materials/store"

export const runtime = "nodejs"

const maxUploadBytes = 8 * 1024 * 1024

export async function GET() {
  const materials = await listMaterialSummaries()
  return NextResponse.json({ materials })
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get("file")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a text, markdown, or PDF file." }, { status: 400 })
  }

  if (file.size > maxUploadBytes) {
    return NextResponse.json({ error: "File is too large. Keep uploads under 8 MB." }, { status: 413 })
  }

  try {
    const parsed = await parseMaterialBuffer({
      fileName: file.name,
      mimeType: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
    })
    const material = await createStoredMaterial(parsed)
    return NextResponse.json({ material }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not parse the lesson material."
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

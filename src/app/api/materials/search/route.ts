import { NextResponse } from "next/server"

import { searchMaterialChunks } from "@/lib/materials/search"
import { readStoredMaterials } from "@/lib/materials/store"

export const runtime = "nodejs"

type SearchRequest = {
  query?: string
  materialIds?: string[]
  limit?: number
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as SearchRequest
  const query = body.query?.trim()

  if (!query) {
    return NextResponse.json({ error: "Search query is required." }, { status: 400 })
  }

  const materials = await readStoredMaterials(body.materialIds)
  const chunks = searchMaterialChunks({
    query,
    materials,
    materialIds: body.materialIds,
    limit: body.limit,
  })

  return NextResponse.json({ chunks })
}

import { NextResponse } from "next/server"

import {
  buildRealtimeSessionConfig,
  buildSafetyIdentifier,
  type RealtimeSessionInput,
} from "@/lib/realtime/session-config"

export const runtime = "nodejs"

const defaultBaseUrl = "https://api.openai.com/v1"

function getOpenAIBaseUrl() {
  return (process.env.OPENAI_BASE_URL ?? defaultBaseUrl).replace(/\/$/, "")
}

function isRealtimeSessionInput(value: unknown): value is RealtimeSessionInput {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<RealtimeSessionInput>
  return (
    ["A1", "A2", "B1", "B2"].includes(candidate.level ?? "") &&
    typeof candidate.scenarioId === "string" &&
    Array.isArray(candidate.materialIds) &&
    (candidate.mode === "roleplay" || candidate.mode === "review")
  )
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is required for Realtime sessions." },
      { status: 401 },
    )
  }

  const body = await request.json().catch(() => null)
  if (!isRealtimeSessionInput(body)) {
    return NextResponse.json({ error: "Invalid Realtime session request." }, { status: 400 })
  }

  const baseUrl = getOpenAIBaseUrl()
  const sessionConfig = buildRealtimeSessionConfig(body)
  const response = await fetch(`${baseUrl}/realtime/client_secrets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "OpenAI-Safety-Identifier": buildSafetyIdentifier(),
    },
    body: JSON.stringify({
      expires_after: {
        anchor: "created_at",
        seconds: 600,
      },
      session: sessionConfig,
    }),
  })

  const payload = (await response.json().catch(() => null)) as
    | { value?: string; expires_at?: number; session?: unknown; error?: { message?: string } }
    | null

  if (!response.ok || !payload?.value) {
    return NextResponse.json(
      {
        error:
          payload?.error?.message ??
          "Could not create a Realtime client secret. Check the OpenAI API key and account access.",
      },
      { status: response.status || 502 },
    )
  }

  return NextResponse.json({
    client_secret: payload.value,
    expires_at: payload.expires_at,
    session: payload.session,
    realtime_call_url: `${baseUrl}/realtime/calls`,
  })
}

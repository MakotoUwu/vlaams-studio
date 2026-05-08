"use client"

import { useCallback, useRef, useState } from "react"

import type { RealtimeSessionInput } from "@/lib/realtime/session-config"

export type RealtimeStatus = "idle" | "missing-key" | "connecting" | "live" | "mic-error" | "error"

export type TranscriptTurn = {
  id: string
  speaker: "Tutor" | "You" | "Correction"
  text: string
}

type ClientSecretResponse = {
  client_secret: string
  realtime_call_url: string
}

type RealtimeFunctionCall = {
  type: "function_call"
  name: string
  call_id: string
  arguments: string
}

function isFunctionCall(value: unknown): value is RealtimeFunctionCall {
  if (!value || typeof value !== "object") return false
  const candidate = value as Partial<RealtimeFunctionCall>
  return (
    candidate.type === "function_call" &&
    typeof candidate.name === "string" &&
    typeof candidate.call_id === "string" &&
    typeof candidate.arguments === "string"
  )
}

export function useRealtimeSession() {
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [status, setStatus] = useState<RealtimeStatus>("idle")
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([])
  const [lastError, setLastError] = useState<string | null>(null)

  const disconnect = useCallback(() => {
    dataChannelRef.current?.close()
    peerRef.current?.close()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (audioRef.current) audioRef.current.srcObject = null

    dataChannelRef.current = null
    peerRef.current = null
    localStreamRef.current = null
    setStatus("idle")
    setIsMuted(false)
  }, [])

  const sendEvent = useCallback((event: unknown) => {
    const channel = dataChannelRef.current
    if (!channel || channel.readyState !== "open") return
    channel.send(JSON.stringify(event))
  }, [])

  const handleFunctionCall = useCallback(
    async (functionCall: RealtimeFunctionCall) => {
      if (functionCall.name !== "search_lesson_materials") return

      const args = JSON.parse(functionCall.arguments || "{}") as {
        query?: string
        materialIds?: string[]
      }

      const response = await fetch("/api/materials/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: args.query ?? "",
          materialIds: args.materialIds,
          limit: 4,
        }),
      })

      const output = await response.json().catch(() => ({ chunks: [] }))
      sendEvent({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: functionCall.call_id,
          output: JSON.stringify(output),
        },
      })
      sendEvent({ type: "response.create" })
    },
    [sendEvent],
  )

  const handleRealtimeEvent = useCallback(
    (message: MessageEvent<string>) => {
      const event = JSON.parse(message.data) as {
        type?: string
        delta?: string
        transcript?: string
        response?: { output?: unknown[] }
        error?: { message?: string }
      }

      if (event.type === "response.output_audio_transcript.done" && event.transcript) {
        setTranscript((current) => [
          ...current,
          {
            id: crypto.randomUUID(),
            speaker: "Tutor",
            text: event.transcript ?? "",
          },
        ])
      }

      if (event.type === "response.done") {
        const output = event.response?.output ?? []
        for (const item of output) {
          if (isFunctionCall(item)) {
            void handleFunctionCall(item)
          }
        }
      }

      if (event.type === "error") {
        setLastError(event.error?.message ?? "Realtime session error.")
        setStatus("error")
      }
    },
    [handleFunctionCall],
  )

  const connect = useCallback(
    async (input: RealtimeSessionInput) => {
      if (status === "connecting" || status === "live") return

      setStatus("connecting")
      setLastError(null)
      setTranscript([])

      const tokenResponse = await fetch("/api/realtime/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })

      if (tokenResponse.status === 401) {
        setStatus("missing-key")
        return
      }

      if (!tokenResponse.ok) {
        const payload = (await tokenResponse.json().catch(() => null)) as { error?: string } | null
        setLastError(payload?.error ?? "Could not start Realtime session.")
        setStatus("error")
        return
      }

      const tokenPayload = (await tokenResponse.json()) as ClientSecretResponse
      const peer = new RTCPeerConnection()
      peerRef.current = peer

      const audioElement = document.createElement("audio")
      audioElement.autoplay = true
      audioRef.current = audioElement
      peer.ontrack = (event) => {
        audioElement.srcObject = event.streams[0]
      }

      try {
        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        localStreamRef.current = localStream
        localStream.getTracks().forEach((track) => peer.addTrack(track, localStream))
      } catch {
        peer.close()
        peerRef.current = null
        setStatus("mic-error")
        return
      }

      const dataChannel = peer.createDataChannel("oai-events")
      dataChannelRef.current = dataChannel
      dataChannel.addEventListener("message", handleRealtimeEvent)
      dataChannel.addEventListener("open", () => setStatus("live"))
      dataChannel.addEventListener("close", () => setStatus("idle"))

      const offer = await peer.createOffer()
      await peer.setLocalDescription(offer)

      const sdpResponse = await fetch(tokenPayload.realtime_call_url, {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${tokenPayload.client_secret}`,
          "Content-Type": "application/sdp",
        },
      })

      if (!sdpResponse.ok) {
        disconnect()
        setStatus("error")
        setLastError("OpenAI rejected the WebRTC offer.")
        return
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: await sdpResponse.text(),
      })
    },
    [disconnect, handleRealtimeEvent, status],
  )

  const toggleMute = useCallback(() => {
    const nextMuted = !isMuted
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted
    })
    setIsMuted(nextMuted)
  }, [isMuted])

  return {
    status,
    isMuted,
    transcript,
    lastError,
    connect,
    disconnect,
    toggleMute,
  }
}

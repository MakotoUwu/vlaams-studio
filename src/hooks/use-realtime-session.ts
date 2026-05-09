"use client"

import { useCallback, useRef, useState } from "react"

import {
  applyRealtimeServerEvent,
  createMaterialLookupTurn,
  parseMaterialSearchArguments,
  parseRealtimeServerMessage,
  type RealtimeFunctionCall,
  type TranscriptTurn,
} from "@/lib/realtime/events"
import type { RealtimeSessionInput } from "@/lib/realtime/session-config"

export type RealtimeStatus = "idle" | "missing-key" | "connecting" | "live" | "mic-error" | "error"

type ClientSecretResponse = {
  client_secret: string
  realtime_call_url: string
}

export function useRealtimeSession() {
  const peerRef = useRef<RTCPeerConnection | null>(null)
  const dataChannelRef = useRef<RTCDataChannel | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const transcriptRef = useRef<TranscriptTurn[]>([])
  const closedByClientRef = useRef(false)
  const [status, setStatus] = useState<RealtimeStatus>("idle")
  const [isMuted, setIsMuted] = useState(false)
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([])
  const [lastError, setLastError] = useState<string | null>(null)

  const setTranscriptState = useCallback((next: TranscriptTurn[]) => {
    transcriptRef.current = next
    setTranscript(next)
  }, [])

  const cleanupConnection = useCallback(() => {
    closedByClientRef.current = true

    dataChannelRef.current?.close()
    peerRef.current?.close()
    localStreamRef.current?.getTracks().forEach((track) => track.stop())
    if (audioRef.current) audioRef.current.srcObject = null

    dataChannelRef.current = null
    peerRef.current = null
    localStreamRef.current = null
    audioRef.current = null
    setIsMuted(false)
  }, [])

  const disconnect = useCallback(() => {
    cleanupConnection()
    setStatus("idle")
  }, [cleanupConnection])

  const sendEvent = useCallback((event: unknown) => {
    const channel = dataChannelRef.current
    if (!channel || channel.readyState !== "open") return
    channel.send(JSON.stringify(event))
  }, [])

  const handleFunctionCall = useCallback(
    async (functionCall: RealtimeFunctionCall) => {
      if (functionCall.name !== "search_lesson_materials") return

      const args = parseMaterialSearchArguments(functionCall.arguments)
      let output: { chunks?: unknown[]; error?: string } = {
        chunks: [],
        error: args.query ? undefined : "Missing material search query.",
      }

      if (args.query) {
        try {
          const response = await fetch("/api/materials/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              query: args.query,
              materialIds: args.materialIds,
              limit: 4,
            }),
          })

          output = (await response.json().catch(() => ({ chunks: [] }))) as {
            chunks?: unknown[]
            error?: string
          }
        } catch {
          output = { chunks: [], error: "Could not search lesson materials." }
        }
      }

      const chunkCount = Array.isArray(output.chunks) ? output.chunks.length : 0
      setTranscriptState([...transcriptRef.current, createMaterialLookupTurn(args.query, chunkCount)])

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
    [sendEvent, setTranscriptState],
  )

  const handleRealtimeEvent = useCallback(
    (message: MessageEvent<string>) => {
      const event = parseRealtimeServerMessage(message.data)
      const result = applyRealtimeServerEvent(transcriptRef.current, event)

      if (result.turns !== transcriptRef.current) {
        setTranscriptState(result.turns)
      }

      if (result.errorMessage) {
        setLastError(result.errorMessage)
        setStatus("error")
      }

      for (const functionCall of result.functionCalls) {
        void handleFunctionCall(functionCall)
      }
    },
    [handleFunctionCall, setTranscriptState],
  )

  const connect = useCallback(
    async (input: RealtimeSessionInput) => {
      if (status === "connecting" || status === "live") return

      closedByClientRef.current = false
      setStatus("connecting")
      setLastError(null)
      setTranscriptState([])

      try {
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

        peer.addEventListener("connectionstatechange", () => {
          if (closedByClientRef.current) return

          if (peer.connectionState === "failed" || peer.connectionState === "disconnected") {
            cleanupConnection()
            setStatus("error")
            setLastError("Realtime connection was interrupted. Try reconnecting.")
          }
        })

        const audioElement = document.createElement("audio")
        audioElement.autoplay = true
        audioRef.current = audioElement
        peer.ontrack = (event) => {
          audioElement.srcObject = event.streams[0]
        }

        const localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        })
        localStreamRef.current = localStream
        localStream.getTracks().forEach((track) => peer.addTrack(track, localStream))

        const dataChannel = peer.createDataChannel("oai-events")
        dataChannelRef.current = dataChannel
        dataChannel.addEventListener("message", handleRealtimeEvent)
        dataChannel.addEventListener("open", () => {
          setStatus("live")
          dataChannel.send(JSON.stringify({ type: "response.create" }))
        })
        dataChannel.addEventListener("close", () => {
          if (!closedByClientRef.current) {
            setStatus("error")
            setLastError("Realtime connection closed unexpectedly.")
          }
        })

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
          cleanupConnection()
          setStatus("error")
          setLastError("OpenAI rejected the WebRTC offer.")
          return
        }

        await peer.setRemoteDescription({
          type: "answer",
          sdp: await sdpResponse.text(),
        })
      } catch (error) {
        cleanupConnection()
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          setStatus("mic-error")
          return
        }

        setStatus("error")
        setLastError(error instanceof Error ? error.message : "Could not start Realtime session.")
      }
    },
    [cleanupConnection, handleRealtimeEvent, setTranscriptState, status],
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

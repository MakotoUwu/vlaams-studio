"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  Activity,
  AlertCircle,
  BookOpen,
  CheckCircle2,
  FileText,
  Headphones,
  Home,
  Mic,
  MicOff,
  Pause,
  Play,
  ShoppingBag,
  Stethoscope,
  TrainFront,
  Upload,
  UserRound,
  Volume2,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  type FeedbackItem,
  type LessonMaterialSummary,
  type PracticeLevel,
  levels,
  scenarios,
  seedFeedback,
  seedMaterials,
} from "@/lib/practice-data"
import { cn } from "@/lib/utils"
import { useRealtimeSession } from "@/hooks/use-realtime-session"

type PracticeProgress = Record<PracticeLevel, number>
type PracticePreferences = {
  selectedLevel: PracticeLevel
  selectedScenarioId: string
  progress: PracticeProgress
}

const progressStorageKey = "vlaams-studio-progress"
const levelStorageKey = "vlaams-studio-level"
const scenarioStorageKey = "vlaams-studio-scenario"
const preferenceChangeEvent = "vlaams-studio-preferences-change"
const defaultProgress: PracticeProgress = { A1: 38, A2: 54, B1: 29, B2: 12 }
const defaultLevel: PracticeLevel = "A1"
const defaultScenarioId = "bakery-antwerp"
const defaultPreferences: PracticePreferences = {
  selectedLevel: defaultLevel,
  selectedScenarioId: defaultScenarioId,
  progress: defaultProgress,
}

const transcriptSeed = [
  {
    speaker: "Tutor",
    text: "Goeiemorgen, wat mag het zijn?",
  },
  {
    speaker: "You",
    text: "Ik wil een brood, alstublieft.",
  },
  {
    speaker: "Correction",
    text: "Naturaler: Ik had graag een brood, alstublieft.",
  },
]

const scenarioIcons: Record<string, typeof ShoppingBag> = {
  "bakery-antwerp": ShoppingBag,
  "tram-stop": TrainFront,
  "doctor-appointment": Stethoscope,
  "apartment-viewing": Home,
}

function loadStoredProgress(): PracticeProgress {
  try {
    const raw = window.localStorage.getItem(progressStorageKey)
    if (!raw) return defaultProgress
    return { ...defaultProgress, ...JSON.parse(raw) }
  } catch {
    return defaultProgress
  }
}

function loadStoredLevel(): PracticeLevel {
  const storedLevel = window.localStorage.getItem(levelStorageKey) as PracticeLevel | null
  return storedLevel && levels.some((level) => level.id === storedLevel) ? storedLevel : defaultLevel
}

function loadStoredScenario(): string {
  const storedScenario = window.localStorage.getItem(scenarioStorageKey)
  return storedScenario && scenarios.some((scenario) => scenario.id === storedScenario)
    ? storedScenario
    : defaultScenarioId
}

function readStoredPreferences(): PracticePreferences {
  const selectedScenarioId = loadStoredScenario()
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId)

  return {
    selectedLevel: selectedScenario?.level ?? loadStoredLevel(),
    selectedScenarioId,
    progress: loadStoredProgress(),
  }
}

function serializePreferences(preferences: PracticePreferences) {
  return JSON.stringify(preferences)
}

function getServerPreferencesSnapshot() {
  return serializePreferences(defaultPreferences)
}

function getStoredPreferencesSnapshot() {
  if (typeof window === "undefined") return getServerPreferencesSnapshot()
  return serializePreferences(readStoredPreferences())
}

function parsePreferencesSnapshot(snapshot: string): PracticePreferences {
  try {
    const parsed = JSON.parse(snapshot) as Partial<PracticePreferences>
    const selectedScenarioId =
      parsed.selectedScenarioId && scenarios.some((scenario) => scenario.id === parsed.selectedScenarioId)
        ? parsed.selectedScenarioId
        : defaultScenarioId
    const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId)

    return {
      selectedLevel: selectedScenario?.level ?? defaultLevel,
      selectedScenarioId,
      progress: { ...defaultProgress, ...parsed.progress },
    }
  } catch {
    return defaultPreferences
  }
}

function subscribeToPreferences(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => undefined

  window.addEventListener("storage", onStoreChange)
  window.addEventListener(preferenceChangeEvent, onStoreChange)

  return () => {
    window.removeEventListener("storage", onStoreChange)
    window.removeEventListener(preferenceChangeEvent, onStoreChange)
  }
}

function savePreferences(preferences: PracticePreferences) {
  window.localStorage.setItem(levelStorageKey, preferences.selectedLevel)
  window.localStorage.setItem(scenarioStorageKey, preferences.selectedScenarioId)
  window.localStorage.setItem(progressStorageKey, JSON.stringify(preferences.progress))
  window.dispatchEvent(new Event(preferenceChangeEvent))
}

function updatePreferences(updater: (preferences: PracticePreferences) => PracticePreferences) {
  savePreferences(updater(readStoredPreferences()))
}

export function VlaamsStudioApp() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const preferenceSnapshot = useSyncExternalStore(
    subscribeToPreferences,
    getStoredPreferencesSnapshot,
    getServerPreferencesSnapshot,
  )
  const preferences = useMemo(() => parsePreferencesSnapshot(preferenceSnapshot), [preferenceSnapshot])
  const { progress, selectedLevel, selectedScenarioId } = preferences
  const [materials, setMaterials] = useState<LessonMaterialSummary[]>(seedMaterials)
  const [activeMaterialIds, setActiveMaterialIds] = useState<string[]>(["sample-bakery"])
  const [feedback, setFeedback] = useState<FeedbackItem[]>(seedFeedback)
  const [uploadMessage, setUploadMessage] = useState("Ready for lesson files")
  const realtime = useRealtimeSession()

  const filteredScenarios = useMemo(
    () => scenarios.filter((scenario) => scenario.level === selectedLevel),
    [selectedLevel],
  )

  const selectedScenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ??
    filteredScenarios[0] ??
    scenarios[0]

  useEffect(() => {
    let isActive = true

    fetch("/api/materials")
      .then((response) => {
        if (!response.ok) return null
        return response.json() as Promise<{ materials: LessonMaterialSummary[] }>
      })
      .then((data) => {
        if (!isActive || !data?.materials?.length) return
        setMaterials(data.materials)
        setActiveMaterialIds((current) =>
          current.filter((id) => data.materials.some((material) => material.id === id)),
        )
      })
      .catch(() => {
        if (isActive) setUploadMessage("Local material library pending")
      })

    return () => {
      isActive = false
    }
  }, [])

  function selectLevel(level: PracticeLevel) {
    const nextScenario = scenarios.find((scenario) => scenario.level === level)
    updatePreferences((current) => ({
      ...current,
      selectedLevel: level,
      selectedScenarioId: nextScenario?.id ?? current.selectedScenarioId,
    }))
  }

  async function handlePracticeToggle() {
    if (realtime.status === "live") {
      realtime.disconnect()
      setFeedback((items) =>
        items.map((item, index) => ({
          ...item,
          score: Math.min(96, item.score + (index === 1 ? 4 : 2)),
        })),
      )
      updatePreferences((current) => ({
        ...current,
        progress: {
          ...current.progress,
          [selectedLevel]: Math.min(100, current.progress[selectedLevel] + 3),
        },
      }))
      return
    }

    await realtime.connect({
      level: selectedLevel,
      scenarioId: selectedScenario.id,
      materialIds: activeMaterialIds,
      mode: "roleplay",
    })
  }

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return

    setUploadMessage("Uploading lesson material")
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/materials", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setUploadMessage(payload?.error ?? "Upload failed")
        return
      }

      const payload = (await response.json()) as { material: LessonMaterialSummary }
      setMaterials((current) => [payload.material, ...current])
      setActiveMaterialIds((current) => [payload.material.id, ...current])
      setUploadMessage("Lesson material ready")
    } catch {
      setUploadMessage("Upload route not available yet")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function toggleMaterial(materialId: string, enabled: boolean) {
    setActiveMaterialIds((current) =>
      enabled ? Array.from(new Set([...current, materialId])) : current.filter((id) => id !== materialId),
    )
  }

  const connectionCopy = {
    idle: "Studio idle",
    "missing-key": "OPENAI_API_KEY missing",
    connecting: "Connecting",
    live: "Live practice",
    "mic-error": "Microphone blocked",
    error: "Connection failed",
  }[realtime.status]

  const visibleTranscript = realtime.transcript.length ? realtime.transcript : transcriptSeed

  return (
    <main className="min-h-[100dvh] bg-[#f7f7f5] text-[#1f2420]">
      <div className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-[92px_minmax(0,1fr)_360px]">
        <aside className="border-b border-[#deded8] bg-[#f1f1ee] px-4 py-4 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-4 lg:min-h-[calc(100dvh-2rem)] lg:flex-col">
            <div className="flex items-center gap-3 lg:flex-col">
              <div className="grid size-11 place-items-center rounded-lg bg-[#1f2420] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.16)]">
                <Headphones className="size-5" aria-hidden="true" />
              </div>
              <div className="lg:hidden">
                <p className="text-sm font-semibold">Vlaams Studio</p>
                <p className="text-xs text-[#68706a]">Realtime practice</p>
              </div>
            </div>

            <nav className="flex items-center gap-2 overflow-x-auto lg:w-full lg:flex-col" aria-label="Practice levels">
              {levels.map((level) => {
                const isSelected = selectedLevel === level.id
                return (
                  <button
                    key={level.id}
                    type="button"
                    onClick={() => selectLevel(level.id)}
                    className={cn(
                      "group grid min-w-18 gap-1 rounded-lg border px-3 py-2 text-left transition lg:w-full lg:min-w-0",
                      isSelected
                        ? "border-[#2f6f57] bg-white text-[#1f2420] shadow-[0_8px_24px_rgba(31,36,32,0.08)]"
                        : "border-transparent text-[#68706a] hover:border-[#deded8] hover:bg-white/70",
                    )}
                  >
                    <span className="text-sm font-semibold">{level.id}</span>
                    <span className="hidden text-[11px] text-[#68706a] lg:block">{level.label}</span>
                  </button>
                )
              })}
            </nav>

            <div className="hidden w-full space-y-2 lg:block">
              <Progress value={progress[selectedLevel]} className="h-1.5 bg-[#deded8]" />
              <div className="rounded-lg border border-[#deded8] bg-white p-2 text-center">
                <p className="text-[11px] font-medium text-[#68706a]">Streak</p>
                <p className="text-lg font-semibold leading-none">8d</p>
              </div>
              <button
                type="button"
                className="grid w-full place-items-center rounded-lg border border-[#deded8] bg-white py-2 text-[#2f6f57] transition hover:border-[#2f6f57]"
                aria-label="Profile"
              >
                <UserRound className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 px-4 py-5 sm:px-6 lg:px-8">
          <header className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <p className="text-sm font-semibold text-[#2f6f57]">Vlaams Studio</p>
              <h1 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl">
                Practice Flemish against real lesson context.
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={realtime.status === "live" ? "success-light" : "default"} className="rounded-md">
                <Activity className="size-3" aria-hidden="true" />
                {connectionCopy}
              </Badge>
              <Badge variant="outline" className="rounded-md">
                GPT Realtime 2
              </Badge>
            </div>
          </header>

          <Card className="overflow-hidden border-[#deded8] bg-white shadow-[0_18px_60px_rgba(31,36,32,0.08)]">
            <CardHeader className="grid gap-5 border-b border-[#ededdf] p-5 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary" className="rounded-md">
                    {selectedScenario.level}
                  </Badge>
                  <span className="text-sm text-[#68706a]">{selectedScenario.location}</span>
                </div>
                <CardTitle className="text-2xl font-semibold leading-tight tracking-normal">
                  {selectedScenario.title}
                </CardTitle>
                <p className="mt-2 max-w-xl text-sm leading-6 text-[#68706a]">{selectedScenario.objective}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={realtime.toggleMute}
                  aria-label={realtime.isMuted ? "Unmute microphone" : "Mute microphone"}
                  disabled={realtime.status !== "live"}
                >
                  {realtime.isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </Button>
                <Button
                  onClick={handlePracticeToggle}
                  className="min-w-32 bg-[#2f6f57] hover:bg-[#285f4b]"
                  disabled={realtime.status === "connecting"}
                >
                  {realtime.status === "live" ? (
                    <>
                      <Pause className="size-4" />
                      End session
                    </>
                  ) : (
                    <>
                      <Play className="size-4" />
                      Start live
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>

            <CardContent className="grid gap-6 p-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div className="space-y-5">
                <div className="rounded-lg border border-[#deded8] bg-[#f8f8f4] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Listening arena</p>
                      <p className="mt-1 text-xs text-[#68706a]">{selectedScenario.starter}</p>
                    </div>
                    <Volume2 className="size-5 text-[#2f6f57]" aria-hidden="true" />
                  </div>
                  <div className="mt-6 flex h-24 items-end justify-between gap-1" aria-hidden="true">
                    {Array.from({ length: 36 }).map((_, index) => (
                      <span
                        key={index}
                        className={cn(
                          "w-full rounded-full bg-[#2f6f57]/25 transition",
                          realtime.status === "live" && "bg-[#2f6f57]",
                        )}
                        style={{ height: `${18 + ((index * 17) % 58)}%` }}
                      />
                    ))}
                  </div>
                  {realtime.status === "missing-key" && (
                    <div className="mt-4 flex items-start gap-2 rounded-md border border-[#d9b78d] bg-[#fff8ed] p-3 text-sm text-[#765327]">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      Add `OPENAI_API_KEY` to `.env.local` to run live Realtime sessions.
                    </div>
                  )}
                  {realtime.status === "mic-error" && (
                    <div className="mt-4 flex items-start gap-2 rounded-md border border-[#d9b78d] bg-[#fff8ed] p-3 text-sm text-[#765327]">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      Microphone permission is required for live voice practice.
                    </div>
                  )}
                  {realtime.lastError && realtime.status === "error" && (
                    <div className="mt-4 flex items-start gap-2 rounded-md border border-[#d9b78d] bg-[#fff8ed] p-3 text-sm text-[#765327]">
                      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                      {realtime.lastError}
                    </div>
                  )}
                </div>

                <div className="grid gap-3">
                  {visibleTranscript.map((item) => (
                    <div
                      key={`${item.speaker}-${item.text}`}
                      className={cn(
                        "rounded-lg border p-3",
                        item.speaker === "Correction"
                          ? "border-[#b8d6c8] bg-[#edf7f1]"
                          : "border-[#deded8] bg-white",
                      )}
                    >
                      <p className="text-xs font-medium text-[#68706a]">{item.speaker}</p>
                      <p className="mt-1 text-sm leading-6">{item.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="mb-3 text-sm font-medium">Session targets</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedScenario.vocabulary.map((word) => (
                      <Badge key={word} variant="outline" className="rounded-md">
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-sm font-medium">Grammar focus</p>
                  <p className="mt-2 text-sm leading-6 text-[#68706a]">{selectedScenario.grammarFocus}</p>
                </div>

                <div className="grid gap-3">
                  {feedback.map((item) => (
                    <div key={item.label} className="rounded-lg border border-[#deded8] bg-[#fbfbf8] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{item.label}</p>
                        <span className="font-mono text-xs text-[#68706a]">{item.score}%</span>
                      </div>
                      <Progress value={item.score} className="mt-3 h-1.5 bg-[#deded8]" />
                      <p className="mt-2 text-xs leading-5 text-[#68706a]">{item.note}</p>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.15fr_0.85fr_1fr_0.9fr]">
            {scenarios.map((scenario) => {
              const Icon = scenarioIcons[scenario.id] ?? BookOpen
              const isSelected = selectedScenario.id === scenario.id
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => {
                    updatePreferences((current) => ({
                      ...current,
                      selectedLevel: scenario.level,
                      selectedScenarioId: scenario.id,
                    }))
                  }}
                  className={cn(
                    "min-h-32 rounded-lg border bg-white p-4 text-left transition",
                    isSelected
                      ? "border-[#2f6f57] shadow-[0_12px_36px_rgba(47,111,87,0.14)]"
                      : "border-[#deded8] hover:border-[#2f6f57]/50",
                  )}
                >
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <Icon className="size-5 text-[#2f6f57]" aria-hidden="true" />
                    <span className="text-xs font-medium text-[#68706a]">{scenario.level}</span>
                  </div>
                  <p className="text-base font-semibold">{scenario.title}</p>
                  <p className="mt-2 text-sm leading-5 text-[#68706a]">{scenario.location}</p>
                </button>
              )
            })}
          </div>
        </section>

        <aside className="border-t border-[#deded8] bg-[#fbfbf8] px-4 py-5 sm:px-6 lg:border-l lg:border-t-0">
          <div className="sticky top-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Lesson material</p>
                <p className="mt-1 text-xs text-[#68706a]">{uploadMessage}</p>
              </div>
              <Button variant="outline" size="icon" onClick={() => fileInputRef.current?.click()} aria-label="Upload file">
                <Upload className="size-4" />
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
                className="hidden"
                onChange={(event) => void handleUpload(event.currentTarget.files)}
              />
            </div>

            <div className="rounded-lg border border-dashed border-[#cfcfca] bg-white p-4">
              <FileText className="size-5 text-[#2f6f57]" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium">Text and PDF uploads</p>
              <p className="mt-2 text-sm leading-6 text-[#68706a]">
                Lesson chunks become searchable context during a live roleplay.
              </p>
            </div>

            <div className="space-y-3">
              {materials.map((material) => {
                const checked = activeMaterialIds.includes(material.id)
                return (
                  <div key={material.id} className="rounded-lg border border-[#deded8] bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{material.title}</p>
                        <p className="mt-1 text-xs text-[#68706a]">
                          {material.kind.toUpperCase()} - {material.chunkCount} chunks
                        </p>
                      </div>
                      <Switch checked={checked} onCheckedChange={(value) => toggleMaterial(material.id, value)} />
                    </div>
                  </div>
                )
              })}
            </div>

            <Separator />

            <div className="rounded-lg border border-[#deded8] bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <CheckCircle2 className="size-4 text-[#2f6f57]" aria-hidden="true" />
                <p className="text-sm font-medium">Active topic</p>
              </div>
              <p className="text-sm leading-6 text-[#68706a]">
                {selectedScenario.objective} Focus on {selectedScenario.grammarFocus.toLowerCase()}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  )
}

"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CroissantIcon,
  FileText,
  Flame,
  Home,
  LogOut,
  Mic,
  MicOff,
  Pause,
  RotateCcw,
  Settings,
  Square,
  Stethoscope,
  TrainFront,
  TrendingUp,
} from "lucide-react"

import { Switch } from "@/components/ui/switch"
import {
  type FeedbackItem,
  type LessonMaterialSummary,
  type PracticeLevel,
  type Scenario,
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

const progressStorageKey = "vlaams-studio-progress-v2"
const levelStorageKey = "vlaams-studio-level"
const scenarioStorageKey = "vlaams-studio-scenario"
const preferenceChangeEvent = "vlaams-studio-preferences-change"
const defaultProgress: PracticeProgress = { A1: 38, A2: 64, B1: 29, B2: 12 }
const defaultLevel: PracticeLevel = "A2"
const defaultScenarioId = "bakery-antwerp"
const defaultPreferences: PracticePreferences = {
  selectedLevel: defaultLevel,
  selectedScenarioId: defaultScenarioId,
  progress: defaultProgress,
}

type SeedExchange = {
  said: string
  corrected: { before: string; highlight: string; after: string }
  note: string
}

const seedExchange: SeedExchange = {
  said: "Ik zou graag een volkoren brood en twee chocoladebroodjes, alstublieft.",
  corrected: {
    before: "Ik zou graag een ",
    highlight: "volkorenbrood",
    after: " en twee chocoladebroodjes, alstublieft.",
  },
  note: "In het Vlaams schrijf je volkorenbrood aan elkaar.",
}

const scenarioIcons: Record<string, typeof CroissantIcon> = {
  "bakery-antwerp": CroissantIcon,
  "tram-stop": TrainFront,
  "doctor-appointment": Stethoscope,
  "apartment-viewing": Home,
}

const weekdayDots: Array<{ letter: string; active: boolean }> = [
  { letter: "M", active: true },
  { letter: "D", active: true },
  { letter: "W", active: true },
  { letter: "D", active: true },
  { letter: "V", active: true },
  { letter: "Z", active: false },
  { letter: "Z", active: false },
]

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

// Gaussian-enveloped bar heights — middle bars are tall, edges taper off.
// Live: bars dance with smoothed pseudo-random amplitude.
// Idle: a slow sine ripple keeps the form "breathing" instead of dead flat.
function useWaveform(active: boolean, count = 68) {
  const center = (count - 1) / 2
  const sigma = count / 3.0 // sharper envelope so edges become near-dots

  const seedHeights = () =>
    Array.from({ length: count }, (_, i) => {
      const envelope = Math.exp(-Math.pow(i - center, 2) / (2 * sigma * sigma))
      return Math.max(4, envelope * 44 + 4)
    })

  const [heights, setHeights] = useState<number[]>(seedHeights)

  useEffect(() => {
    let frame = 0
    const tick = () => {
      frame += 1
      setHeights((previous) =>
        previous.map((prev, i) => {
          const envelope = Math.exp(-Math.pow(i - center, 2) / (2 * sigma * sigma))
          // Add a slow per-bar phase so neighbours don't move in lockstep.
          const phase = Math.sin(frame * 0.22 + i * 0.31)
          const target = active
            ? envelope * (44 + Math.random() * 56) + 4
            : envelope * (26 + 8 * phase) + 4
          return Math.max(4, prev * 0.55 + target * 0.45)
        }),
      )
    }
    const interval = window.setInterval(tick, active ? 95 : 260)
    return () => window.clearInterval(interval)
  }, [active, center, sigma])

  return heights
}

function scoreColor(score: number) {
  if (score >= 80) return "text-[#2f6f57]"
  return "text-[#c98b3a]"
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
  const [sessionScore, setSessionScore] = useState(78)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const [useMaterialInSession, setUseMaterialInSession] = useState(true)
  const [showCorrectionNote, setShowCorrectionNote] = useState(true)
  const realtime = useRealtimeSession()

  const selectedScenario: Scenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0]
  const isLive = realtime.status === "live"
  const isConnecting = realtime.status === "connecting"
  const waveformHeights = useWaveform(isLive)

  const activeMaterial = materials.find((material) => activeMaterialIds.includes(material.id)) ?? materials[0]
  const visibleTranscript = realtime.transcript.length ? realtime.transcript : null

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
        if (isActive) setUploadMessage("Lokaal lesmateriaal niet beschikbaar")
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

  function selectScenario(scenario: Scenario) {
    updatePreferences((current) => ({
      ...current,
      selectedLevel: scenario.level,
      selectedScenarioId: scenario.id,
    }))
  }

  async function handlePracticeToggle() {
    if (isLive) {
      realtime.disconnect()
      setFeedback((items) =>
        items.map((item, index) => ({
          ...item,
          score: Math.min(96, item.score + (index === 1 ? 4 : 2)),
        })),
      )
      setSessionScore((value) => Math.min(98, value + 3))
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
      materialIds: useMaterialInSession ? activeMaterialIds : [],
      mode: "roleplay",
    })
  }

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return

    setUploadMessage("Lesmateriaal uploaden")
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/materials", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setUploadMessage(payload?.error ?? "Upload mislukt")
        return
      }

      const payload = (await response.json()) as { material: LessonMaterialSummary }
      setMaterials((current) => [payload.material, ...current])
      setActiveMaterialIds([payload.material.id])
      setUploadMessage("Lesmateriaal klaar")
    } catch {
      setUploadMessage("Upload-route nog niet beschikbaar")
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const statusCopy = {
    idle: "VERBONDEN",
    "missing-key": "API-SLEUTEL ONTBREEKT",
    connecting: "VERBINDING…",
    live: "VERBONDEN",
    "mic-error": "MICROFOON GEBLOKKEERD",
    error: "VERBINDING MISLUKT",
  }[realtime.status]

  const statusDot =
    realtime.status === "missing-key" || realtime.status === "mic-error" || realtime.status === "error"
      ? "bg-[#c98b3a]"
      : isConnecting
        ? "bg-[#c98b3a] animate-pulse"
        : "bg-[#2f6f57]"

  const headlineClass =
    "font-serif text-[34px] leading-[38px] tracking-tight text-[#1f2420] sm:text-[38px] sm:leading-[42px]"

  return (
    <main className="min-h-[100dvh] bg-[#f4f1ea] text-[#1f2420]">
      <div className="mx-auto grid min-h-[100dvh] w-full max-w-[1480px] grid-cols-1 lg:grid-cols-[232px_minmax(0,1fr)_328px]">
        {/* LEFT RAIL */}
        <aside className="border-b border-[#e0ddd2] bg-[#f4f1ea] px-5 py-5 lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col gap-7">
            <p className="text-[18px] font-semibold leading-none tracking-tight text-[#1f2420]">
              Vlaams Studio
            </p>

            <Section eyebrow="Niveau">
              <div className="space-y-1.5">
                {levels.map((level) => {
                  const isSelected = selectedLevel === level.id
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => selectLevel(level.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-[8px] px-4 py-3 text-left transition active:scale-[0.99]",
                        isSelected
                          ? "border border-transparent bg-[#2f6f57] text-white"
                          : "border border-[#e6e2d6] bg-white text-[#1f2420] hover:border-[#c4c0b3]",
                      )}
                    >
                      <span className="flex flex-col gap-1.5">
                        <span className="text-[17px] font-semibold leading-none">{level.id}</span>
                        <span
                          className={cn(
                            "text-[13px] leading-none",
                            isSelected ? "text-white/80" : "text-[#8a8e87]",
                          )}
                        >
                          {level.label}
                        </span>
                      </span>
                      {isSelected && (
                        <span
                          className="grid size-5 place-items-center rounded-full bg-white text-[#2f6f57]"
                          aria-hidden="true"
                        >
                          <CheckMark />
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </Section>

            <Section eyebrow="Vandaag">
              <div className="flex items-start justify-between">
                <div>
                  <p className="tabular text-[40px] font-semibold leading-[42px] tracking-tight">
                    7
                  </p>
                  <p className="mt-1 text-[13px] text-[#8a8e87]">dagen op rij</p>
                </div>
                <Flame
                  className="mt-2 size-6 text-[#c98b3a]"
                  aria-hidden="true"
                  strokeWidth={1.5}
                  fill="#c98b3a"
                />
              </div>
              <div className="mt-3 grid grid-cols-7 gap-2 text-center">
                {weekdayDots.map((dot, index) => (
                  <div key={index} className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8a8e87]">
                      {dot.letter}
                    </span>
                    <span
                      className={cn(
                        "block size-2 rounded-full",
                        dot.active ? "bg-[#2f6f57]" : "border border-[#cfcec5] bg-transparent",
                      )}
                    />
                  </div>
                ))}
              </div>
            </Section>

            <Section eyebrow={`Voortgang ${selectedLevel}`}>
              <p className="tabular text-[36px] font-semibold leading-[40px] tracking-tight">
                {progress[selectedLevel]}%
              </p>
              <p className="mt-1 text-[13px] text-[#8a8e87]">van niveau voltooid</p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-[#e0ddd2]">
                <div
                  className="h-full rounded-full bg-[#2f6f57] transition-[width]"
                  style={{ width: `${progress[selectedLevel]}%` }}
                />
              </div>
            </Section>

            <div className="mt-auto space-y-2 pt-2">
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-[8px] border border-[#e0ddd2] bg-white p-2.5 text-left transition hover:border-[#c4c0b3]"
              >
                <span className="grid size-10 place-items-center rounded-full bg-[#607568] text-[12px] font-semibold text-white">
                  JL
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] font-semibold">Joris L.</span>
                  <span className="text-[11px] text-[#8a8e87]">Bekijk profiel</span>
                </span>
                <ChevronDown className="ml-auto size-4 text-[#8a8e87]" aria-hidden="true" />
              </button>
              <RailRow icon={Settings}>Instellingen</RailRow>
              <RailRow icon={LogOut}>Uitloggen</RailRow>
            </div>
          </div>
        </aside>

        {/* CENTER */}
        <section className="min-w-0 px-6 py-5 sm:px-8 lg:py-6">
          <header className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-transparent text-[11px] font-semibold uppercase tracking-[0.16em] text-[#5a615b]">
              <span className={cn("inline-block size-2 rounded-full", statusDot)} aria-hidden="true" />
              {statusCopy}
            </span>
            <span className="ml-1 inline-flex items-center gap-2 rounded-full border border-[#e0ddd2] bg-white px-3 py-1 text-[12px] font-medium text-[#1f2420]">
              <RealtimeGlyph />
              GPT Realtime 2
            </span>
          </header>

          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8e87]">
              Huidig scenario
            </p>
            <h1 className={cn("mt-2", headlineClass)}>{selectedScenario.title}</h1>
            <p className="mt-2 max-w-[44ch] text-[14px] leading-[21px] text-[#5a615b]">
              {selectedScenario.objective}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {scenarios.map((scenario) => {
              const Icon = scenarioIcons[scenario.id] ?? CroissantIcon
              const isSelected = selectedScenario.id === scenario.id
              return (
                <button
                  key={scenario.id}
                  type="button"
                  onClick={() => selectScenario(scenario)}
                  className={cn(
                    "relative flex h-[156px] flex-col items-center justify-end overflow-hidden rounded-[8px] border px-4 pb-4 pt-3.5 text-center transition active:scale-[0.99]",
                    isSelected
                      ? "border-transparent bg-[#2f6f57] text-white"
                      : "border-[#e6e2d6] bg-white text-[#1f2420] hover:border-[#c4c0b3]",
                  )}
                >
                  {isSelected && (
                    <span className="absolute left-3.5 top-3.5 inline-flex items-center rounded-md bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                      Actief
                    </span>
                  )}
                  <Icon
                    className={cn("mb-auto mt-7", isSelected ? "size-9 text-white" : "size-8 text-[#1f2420]")}
                    strokeWidth={1.4}
                    aria-hidden="true"
                  />
                  <p
                    className={cn(
                      "text-[15px] font-semibold leading-[20px]",
                      isSelected ? "text-white" : "text-[#1f2420]",
                    )}
                  >
                    {scenario.title}
                  </p>
                  <p
                    className={cn(
                      "mt-1.5 text-[12px]",
                      isSelected ? "text-white/75" : "text-[#8a8e87]",
                    )}
                  >
                    {scenario.duration}
                  </p>
                </button>
              )
            })}
          </div>

          <div className="mt-4 grid place-items-center text-center">
            <p className="text-[14px] text-[#5a615b]">
              {isLive
                ? "Aan het opnemen…"
                : isConnecting
                  ? "Verbinden…"
                  : realtime.status === "mic-error"
                    ? "Microfoon geblokkeerd"
                    : "Ik luister…"}
            </p>

            <div
              className="mt-2 flex h-[58px] w-full max-w-[600px] items-end justify-center gap-[3px]"
              aria-hidden="true"
            >
              {waveformHeights.map((value, index) => (
                <span
                  key={index}
                  className="block w-[2.5px] rounded-full bg-[#2f6f57] transition-[height] duration-100 ease-out"
                  style={{ height: `${Math.max(4, Math.min(96, value))}%` }}
                />
              ))}
            </div>

            {/* Button + caption pairs — each caption sits centered under its own button.
                Columns are sized to the button so the buttons stay clustered; captions
                use whitespace-nowrap and overflow visually below the button row. */}
            <div className="mt-4 flex items-start justify-center gap-x-12">
              <div className="flex w-12 flex-col items-center">
                <button
                  type="button"
                  onClick={realtime.toggleMute}
                  aria-label={realtime.isMuted ? "Microfoon weer aan" : "Microfoon dempen"}
                  disabled={!isLive}
                  className="grid size-12 place-items-center rounded-full border border-[#e0ddd2] bg-white text-[#1f2420] transition disabled:opacity-50 hover:border-[#2f6f57]"
                >
                  {realtime.isMuted ? <MicOff className="size-5" /> : <Pause className="size-5" />}
                </button>
                <span className="mt-3 whitespace-nowrap text-[12px] text-[#8a8e87]">Pauze</span>
              </div>

              <div className="flex w-[72px] flex-col items-center">
                <button
                  type="button"
                  onClick={() => void handlePracticeToggle()}
                  disabled={isConnecting}
                  aria-label={isLive ? "Sessie beëindigen" : "Live sessie starten"}
                  className={cn(
                    "relative grid size-[72px] place-items-center rounded-full text-white ring-[6px] ring-white shadow-[0_18px_40px_-10px_rgba(36,87,70,0.45)] transition active:scale-[0.97] disabled:opacity-70",
                    isLive ? "bg-[#245746] hover:bg-[#1d4738]" : "bg-[#2f6f57] hover:bg-[#26604a]",
                  )}
                >
                  {isLive && (
                    <span
                      className="pointer-events-none absolute -inset-3 rounded-full ring-2 ring-[#2f6f57]/20"
                      aria-hidden="true"
                    />
                  )}
                  <Mic className="size-6" strokeWidth={2} />
                </button>
                <span className="mt-3 whitespace-nowrap text-[12px] text-[#8a8e87]">
                  Houd ingedrukt om te praten
                </span>
              </div>

              <div className="flex w-12 flex-col items-center">
                <button
                  type="button"
                  onClick={() => isLive && realtime.disconnect()}
                  aria-label="Gesprek beëindigen"
                  disabled={!isLive}
                  className="grid size-12 place-items-center rounded-full border border-[#e0ddd2] bg-white text-[#1f2420] transition disabled:opacity-50 hover:border-[#2f6f57]"
                >
                  <Square className="size-4" fill="currentColor" />
                </button>
                <span className="mt-3 whitespace-nowrap text-[12px] text-[#8a8e87]">
                  Gesprek beëindigen
                </span>
              </div>
            </div>

            {realtime.status === "missing-key" && (
              <div className="mt-5 flex w-full max-w-[640px] items-start gap-2 rounded-lg border border-[#d9b78d] bg-[#fff8ed] p-3 text-left text-[13px] text-[#765327]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Voeg <code className="font-mono text-[12px]">OPENAI_API_KEY</code> toe aan
                <code className="font-mono text-[12px]"> .env.local</code> om live sessies te starten.
              </div>
            )}
            {realtime.status === "mic-error" && (
              <div className="mt-5 flex w-full max-w-[640px] items-start gap-2 rounded-lg border border-[#d9b78d] bg-[#fff8ed] p-3 text-left text-[13px] text-[#765327]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                Geef toestemming voor de microfoon om verder te oefenen.
              </div>
            )}
            {realtime.lastError && realtime.status === "error" && (
              <div className="mt-5 flex w-full max-w-[640px] items-start gap-2 rounded-lg border border-[#d9b78d] bg-[#fff8ed] p-3 text-left text-[13px] text-[#765327]">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {realtime.lastError}
              </div>
            )}
          </div>

          <div className="mt-5 overflow-hidden rounded-2xl border border-[#e6e2d6] bg-white">
            {visibleTranscript ? (
              <div className="divide-y divide-[#ededdf]">
                {visibleTranscript.map((turn) => (
                  <TranscriptRow key={turn.id} label={transcriptLabel(turn.speaker)}>
                    {turn.text}
                  </TranscriptRow>
                ))}
              </div>
            ) : (
              <>
                <TranscriptRow label="Jij zei">{seedExchange.said}</TranscriptRow>
                <div className="border-t border-[#ededdf]">
                  <div className="grid grid-cols-[88px_minmax(0,1fr)_auto] items-center gap-4 px-5 py-3.5">
                    <span className="text-[13px] text-[#8a8e87]">Verbeterd</span>
                    <p className="text-[14px] leading-[22px] text-[#1f2420]">
                      {seedExchange.corrected.before}
                      <mark className="bg-transparent font-semibold text-[#2f6f57] underline decoration-[#2f6f57]/40 decoration-1 underline-offset-4">
                        {seedExchange.corrected.highlight}
                      </mark>
                      {seedExchange.corrected.after}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className="grid size-7 place-items-center rounded-full bg-[#2f6f57] text-white"
                        aria-hidden="true"
                      >
                        <CheckMark />
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowCorrectionNote((value) => !value)}
                        aria-label={showCorrectionNote ? "Verberg toelichting" : "Toon toelichting"}
                        className="grid size-7 place-items-center rounded-full border border-[#e0ddd2] text-[#5a615b] transition hover:border-[#2f6f57] hover:text-[#2f6f57]"
                      >
                        <ChevronDown
                          className={cn(
                            "size-4 transition-transform",
                            showCorrectionNote ? "rotate-180" : "rotate-0",
                          )}
                        />
                      </button>
                    </div>
                  </div>
                  {showCorrectionNote && (
                    <p className="px-5 pb-3.5 pl-[120px] text-[12.5px] italic leading-[20px] text-[#8a8e87]">
                      {seedExchange.note}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8e87]">
                Sessiescore
              </p>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#1f2420]">
                <TrendingUp className="size-3.5 text-[#2f6f57]" strokeWidth={2} aria-hidden="true" />
                Goed bezig
              </span>
            </div>
            <div className="mt-2 flex items-end gap-4">
              <p className="tabular text-[32px] font-medium leading-none text-[#1f2420]">
                {sessionScore} <span className="text-[#8a8e87]"> / 100</span>
              </p>
              <div className="flex-1 pb-1.5">
                <ScoreBar value={sessionScore} />
              </div>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {feedback.map((item) => (
              <div
                key={item.label}
                className="rounded-2xl border border-[#dcd8cb] bg-[#ece7d9] p-3.5"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8e87]">
                  {item.label}
                </p>
                <p
                  className={cn(
                    "tabular mt-2 text-[24px] font-semibold leading-none",
                    scoreColor(item.score),
                  )}
                >
                  {item.score}
                  <span className="text-[14px] font-medium text-[#8a8e87]"> / 100</span>
                </p>
                <p className="mt-2 text-[13px] leading-[18px] text-[#5a615b]">{item.note}</p>
                <button
                  type="button"
                  className="mt-3 inline-flex items-center rounded-md border border-[#e0ddd2] px-3 py-1.5 text-[12px] font-medium text-[#1f2420] transition hover:border-[#2f6f57] hover:text-[#2f6f57]"
                >
                  Details
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* RIGHT RAIL — flat-on-rail layout: full-width hairlines separate sections,
            content sits directly on the ivory background. The only surfaces with
            their own card are the file upload (functional grouping) and the
            teacher note (visual emphasis). */}
        <aside className="border-t border-[#e0ddd2] bg-[#f4f1ea] px-5 lg:border-l lg:border-t-0">
          <RailSection eyebrow="Lesmateriaal" first>
            <div className="rounded-[8px] border border-dashed border-[#d6d1c3] bg-white p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-12 items-center justify-center border-r border-[#e0ddd2] text-[#5a615b]">
                  <FileText className="size-5" strokeWidth={1.4} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold leading-none">
                    {activeMaterial?.title ?? selectedScenario.defaultMaterial.name}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8a8e87]">
                    {activeMaterial?.kind === "pdf"
                      ? selectedScenario.defaultMaterial.size
                      : `Tekst · ${activeMaterial?.chunkCount ?? 0} fragmenten`}
                  </p>
                </div>
                <span className="grid size-6 place-items-center rounded-full bg-[#2f6f57] text-white">
                  <CheckMark />
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-[8px] border border-[#e0ddd2] bg-white px-3 py-2.5 text-[13px] font-medium text-[#1f2420] transition hover:border-[#2f6f57] hover:text-[#2f6f57]"
            >
              <RotateCcw className="size-4" strokeWidth={1.6} aria-hidden="true" />
              Materiaal vervangen
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
              className="hidden"
              onChange={(event) => void handleUpload(event.currentTarget.files)}
            />
            {uploadMessage && (
              <p className="mt-2 text-[11px] text-[#8a8e87]">{uploadMessage}</p>
            )}

            <div className="mt-4 flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#5a615b]">
                Gebruik dit materiaal in sessie
              </p>
              <Switch
                checked={useMaterialInSession}
                onCheckedChange={setUseMaterialInSession}
                className="data-[state=checked]:bg-[#2f6f57]"
              />
            </div>
          </RailSection>

          <RailSection eyebrow="Actief lesonderwerp">
            <p className="text-[14px] font-semibold leading-tight">{selectedScenario.topic}</p>
            <p className="mt-1.5 text-[12px] text-[#8a8e87]">{selectedScenario.topicCategory}</p>
            <button
              type="button"
              className="mt-3 inline-flex items-center rounded-[8px] border border-[#e0ddd2] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1f2420] transition hover:border-[#2f6f57] hover:text-[#2f6f57]"
            >
              Aanpassen
            </button>
          </RailSection>

          <RailSection eyebrow="Woordenschatdoelen">
            <div className="flex flex-wrap gap-x-2 gap-y-1.5">
              {selectedScenario.vocabularyGoals.map((word, index) => (
                <span
                  key={word}
                  className={cn(
                    "inline-flex items-center rounded-[6px] border px-2.5 py-1 text-[12px] font-medium leading-none text-[#5a615b]",
                    index === 0
                      ? "border-[#cbd9cf] bg-[#e8efe9] text-[#2f6f57]"
                      : "border-[#e6e2d6] bg-white",
                  )}
                >
                  {word}
                </span>
              ))}
            </div>
          </RailSection>

          <RailSection eyebrow="Grammaticafocus">
            <ul className="-mx-1">
              {selectedScenario.grammarPoints.map((point) => (
                <li key={point}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 rounded-[6px] px-1 py-2 text-left text-[14px] leading-[20px] text-[#1f2420] transition hover:text-[#2f6f57]"
                  >
                    <span>{point}</span>
                    <ChevronRight
                      className="size-4 text-[#8a8e87]"
                      strokeWidth={1.6}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </RailSection>

          <RailSection eyebrow="Docentnotities" last>
            <div className="rounded-[8px] border border-[#dcd8cb] bg-[#ece7d9] p-4">
              <p className="font-serif text-[14.5px] italic leading-[22px] text-[#1f2420]">
                {selectedScenario.teacherNote}
              </p>
            </div>
            <div className="mt-4 flex items-center justify-between text-[11px] text-[#8a8e87]">
              <span>Laatst bewerkt door {selectedScenario.teacherNoteAuthor}</span>
              <span>{selectedScenario.teacherNoteEditedAt}</span>
            </div>
          </RailSection>
        </aside>
      </div>
    </main>
  )
}

function Section({
  eyebrow,
  children,
}: {
  eyebrow: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8e87]">
        {eyebrow}
      </p>
      {children}
    </div>
  )
}

// Right-rail section: flat content separated from neighbours by a full-width
// hairline rule. The first/last props control the rule above/below so the rail
// reads as a single divided column instead of stacked cards.
function RailSection({
  eyebrow,
  first,
  last,
  children,
}: {
  eyebrow: string
  first?: boolean
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className={cn(
        "py-5",
        !first && "border-t border-[#e0ddd2]",
        last && "border-b border-[#e0ddd2]",
      )}
    >
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8e87]">
        {eyebrow}
      </p>
      {children}
    </section>
  )
}

function RailRow({
  icon: Icon,
  children,
}: {
  icon: typeof Settings
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-[13px] text-[#5a615b] transition hover:bg-white"
    >
      <Icon className="size-4" strokeWidth={1.6} aria-hidden="true" />
      {children}
    </button>
  )
}

function TranscriptRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-4 px-5 py-3.5">
      <span className="text-[13px] text-[#8a8e87]">{label}</span>
      <p className="text-[14px] leading-[22px] text-[#1f2420]">{children}</p>
    </div>
  )
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-[#e8e5da]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-[#c98b3a] via-[#d8b86a] to-[#2f6f57] transition-[width]"
        style={{ width: `${Math.max(4, Math.min(100, value))}%` }}
      />
    </div>
  )
}

function CheckMark() {
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      <path d="M2.5 6.5l2.5 2.5L9.5 4" />
    </svg>
  )
}

function RealtimeGlyph() {
  // 4 equalizer bars at increasing-then-decreasing heights — reads as audio at any size.
  const bars = [4, 8, 11, 6]
  return (
    <svg viewBox="0 0 14 12" width="14" height="12" aria-hidden="true" fill="#2f6f57">
      {bars.map((h, i) => (
        <rect key={i} x={i * 3.5 + 0.5} y={(12 - h) / 2} width={2} height={h} rx={1} />
      ))}
    </svg>
  )
}

function transcriptLabel(speaker: "Tutor" | "You" | "Correction") {
  if (speaker === "You") return "Jij zei"
  if (speaker === "Correction") return "Verbeterd"
  return "Docent"
}

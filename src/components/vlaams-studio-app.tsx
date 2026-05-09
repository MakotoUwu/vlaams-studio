"use client"

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  AlertCircle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CroissantIcon,
  FileText,
  Flame,
  Home,
  LogOut,
  MessageCircle,
  Mic,
  MicOff,
  Pause,
  RotateCcw,
  Settings,
  Square,
  Stethoscope,
  TrainFront,
  TrendingUp,
  X,
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
import type { CorrectionPayload, TranscriptTurn } from "@/lib/realtime/events"
import {
  cloneDefaultPreferences,
  focusForScenario,
  metricDetailCopy,
  panelTitleFor,
  updateVocabularyGoals,
} from "@/lib/studio/ui-state"

type PracticeProgress = Record<PracticeLevel, number>
type PracticePreferences = {
  selectedLevel: PracticeLevel
  selectedScenarioId: string
  progress: PracticeProgress
  streakDays: number
  sessionScore: number
  feedback: FeedbackItem[]
  useMaterialInSession: boolean
  activeMaterialIds: string[]
  selectedVocabularyGoals: string[]
  focusedGrammar: string | null
  correctionStyle: "gentle" | "direct"
  showCaptions: boolean
}

const progressStorageKey = "vlaams-studio-progress-v2"
const levelStorageKey = "vlaams-studio-level"
const scenarioStorageKey = "vlaams-studio-scenario"
const studioStateStorageKey = "vlaams-studio-state-v1"
const preferenceChangeEvent = "vlaams-studio-preferences-change"
const defaultProgress: PracticeProgress = { A1: 38, A2: 64, B1: 29, B2: 12 }
const defaultLevel: PracticeLevel = "A2"
const defaultScenarioId = "bakery-antwerp"
const defaultPreferences: PracticePreferences = {
  selectedLevel: defaultLevel,
  selectedScenarioId: defaultScenarioId,
  progress: defaultProgress,
  streakDays: 7,
  sessionScore: 78,
  feedback: seedFeedback,
  useMaterialInSession: true,
  activeMaterialIds: ["sample-bakery"],
  selectedVocabularyGoals: ["broodsoorten"],
  focusedGrammar: null,
  correctionStyle: "gentle",
  showCaptions: true,
}

const learnerName = "Oleksandr T."
const learnerInitials = "OT"

type UploadState = {
  status: "idle" | "uploading" | "success" | "error"
  message: string | null
}

type SeedExchange = {
  said: string
  corrected: { before: string; highlight: string; after: string }
  note: string
}

type ActivePanel =
  | { type: "profile" }
  | { type: "settings" }
  | { type: "reset" }
  | { type: "setup" }
  | { type: "metric"; metric: FeedbackItem }
  | { type: "grammar"; point: string }
  | null

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

function loadStoredStudioState(): Partial<PracticePreferences> {
  try {
    const raw = window.localStorage.getItem(studioStateStorageKey)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Partial<PracticePreferences>
    return parsed && typeof parsed === "object" ? parsed : {}
  } catch {
    return {}
  }
}

function sanitizeFeedback(items: unknown): FeedbackItem[] {
  if (!Array.isArray(items)) return seedFeedback

  const parsed = items.filter((item): item is FeedbackItem => {
    if (!item || typeof item !== "object") return false
    const candidate = item as Partial<FeedbackItem>
    return (
      typeof candidate.label === "string" &&
      typeof candidate.score === "number" &&
      typeof candidate.note === "string"
    )
  })

  return parsed.length ? parsed : seedFeedback
}

function sanitizeStringArray(items: unknown, fallback: string[] = []) {
  if (!Array.isArray(items)) return fallback
  const parsed = items.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
  return parsed.length ? parsed : fallback
}

function readStoredPreferences(): PracticePreferences {
  const selectedScenarioId = loadStoredScenario()
  const selectedScenario = scenarios.find((scenario) => scenario.id === selectedScenarioId)
  const storedState = loadStoredStudioState()
  const storedActiveMaterials = Array.isArray(storedState.activeMaterialIds)
    ? storedState.activeMaterialIds.filter((id): id is string => typeof id === "string")
    : defaultPreferences.activeMaterialIds

  return {
    selectedLevel: selectedScenario?.level ?? loadStoredLevel(),
    selectedScenarioId,
    progress: loadStoredProgress(),
    streakDays:
      typeof storedState.streakDays === "number" && Number.isFinite(storedState.streakDays)
        ? storedState.streakDays
        : defaultPreferences.streakDays,
    sessionScore:
      typeof storedState.sessionScore === "number" && Number.isFinite(storedState.sessionScore)
        ? storedState.sessionScore
        : defaultPreferences.sessionScore,
    feedback: sanitizeFeedback(storedState.feedback),
    useMaterialInSession:
      typeof storedState.useMaterialInSession === "boolean"
        ? storedState.useMaterialInSession
        : defaultPreferences.useMaterialInSession,
    activeMaterialIds: storedActiveMaterials.length ? storedActiveMaterials : defaultPreferences.activeMaterialIds,
    selectedVocabularyGoals: sanitizeStringArray(
      storedState.selectedVocabularyGoals,
      defaultPreferences.selectedVocabularyGoals,
    ),
    focusedGrammar: typeof storedState.focusedGrammar === "string" ? storedState.focusedGrammar : null,
    correctionStyle:
      storedState.correctionStyle === "direct" ? "direct" : defaultPreferences.correctionStyle,
    showCaptions:
      typeof storedState.showCaptions === "boolean"
        ? storedState.showCaptions
        : defaultPreferences.showCaptions,
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
      streakDays:
        typeof parsed.streakDays === "number" && Number.isFinite(parsed.streakDays)
          ? parsed.streakDays
          : defaultPreferences.streakDays,
      sessionScore:
        typeof parsed.sessionScore === "number" && Number.isFinite(parsed.sessionScore)
          ? parsed.sessionScore
          : defaultPreferences.sessionScore,
      feedback: sanitizeFeedback(parsed.feedback),
      useMaterialInSession:
        typeof parsed.useMaterialInSession === "boolean"
          ? parsed.useMaterialInSession
          : defaultPreferences.useMaterialInSession,
      activeMaterialIds: Array.isArray(parsed.activeMaterialIds)
        ? parsed.activeMaterialIds.filter((id): id is string => typeof id === "string")
        : defaultPreferences.activeMaterialIds,
      selectedVocabularyGoals: sanitizeStringArray(
        parsed.selectedVocabularyGoals,
        defaultPreferences.selectedVocabularyGoals,
      ),
      focusedGrammar: typeof parsed.focusedGrammar === "string" ? parsed.focusedGrammar : null,
      correctionStyle: parsed.correctionStyle === "direct" ? "direct" : defaultPreferences.correctionStyle,
      showCaptions:
        typeof parsed.showCaptions === "boolean" ? parsed.showCaptions : defaultPreferences.showCaptions,
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
  const nextSnapshot = JSON.stringify(preferences)
  if (typeof window !== "undefined" && window.localStorage.getItem(studioStateStorageKey) === nextSnapshot) {
    return
  }

  window.localStorage.setItem(levelStorageKey, preferences.selectedLevel)
  window.localStorage.setItem(scenarioStorageKey, preferences.selectedScenarioId)
  window.localStorage.setItem(progressStorageKey, JSON.stringify(preferences.progress))
  window.localStorage.setItem(studioStateStorageKey, nextSnapshot)
  window.dispatchEvent(new Event(preferenceChangeEvent))
}

function updatePreferences(updater: (preferences: PracticePreferences) => PracticePreferences) {
  savePreferences(updater(readStoredPreferences()))
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window === "undefined" ? false : window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches)
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  return prefersReducedMotion
}

// Gaussian-enveloped bar heights — middle bars are tall, edges taper off.
// The hook is used only inside the isolated waveform leaf, so animation ticks
// do not re-render the rails, panels, or conversation list.
function useWaveform(active: boolean, count = 68) {
  const center = (count - 1) / 2
  const sigma = count / 3.0 // sharper envelope so edges become near-dots

  const seedHeights = () =>
    Array.from({ length: count }, (_, i) => {
      const envelope = Math.exp(-Math.pow(i - center, 2) / (2 * sigma * sigma))
      return Math.max(4, envelope * 44 + 4)
    })

  const [heights, setHeights] = useState<number[]>(seedHeights)
  const prefersReducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    if (prefersReducedMotion) return

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
  }, [active, center, sigma, prefersReducedMotion])

  return heights
}

function scoreColor(score: number) {
  if (score >= 80) return "text-[#2f6f57]"
  return "text-[#c98b3a]"
}

function createSeedConversationTurns(exchange: SeedExchange, showNote: boolean): TranscriptTurn[] {
  const correctionText = `${exchange.corrected.before}${exchange.corrected.highlight}${exchange.corrected.after}`
  const correction: CorrectionPayload = {
    original: exchange.said,
    corrected: correctionText,
    reason: showNote ? exchange.note : "Correctie opgeslagen.",
    grammarPoint: "Samenstellingen",
    retryPrompt: "Zeg de verbeterde zin nog eens rustig.",
  }

  return [
    {
      id: "seed-you",
      speaker: "You",
      status: "final",
      text: exchange.said,
    },
    {
      id: "seed-correction",
      speaker: "Correction",
      status: "final",
      text: correctionText,
      correction,
    },
  ]
}

export function VlaamsStudioApp() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const preferenceSnapshot = useSyncExternalStore(
    subscribeToPreferences,
    getStoredPreferencesSnapshot,
    getServerPreferencesSnapshot,
  )
  const preferences = useMemo(() => parsePreferencesSnapshot(preferenceSnapshot), [preferenceSnapshot])
  const {
    activeMaterialIds,
    correctionStyle,
    feedback,
    focusedGrammar,
    progress,
    selectedVocabularyGoals,
    selectedLevel,
    selectedScenarioId,
    sessionScore,
    showCaptions,
    streakDays,
    useMaterialInSession,
  } = preferences
  const [materials, setMaterials] = useState<LessonMaterialSummary[]>(seedMaterials)
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle", message: null })
  const [showCorrectionNote, setShowCorrectionNote] = useState(true)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const realtime = useRealtimeSession()

  const selectedScenario: Scenario =
    scenarios.find((scenario) => scenario.id === selectedScenarioId) ?? scenarios[0]
  const isLive = realtime.status === "live"
  const isConnecting = realtime.status === "connecting"

  const activeMaterial = materials.find((material) => activeMaterialIds.includes(material.id)) ?? materials[0]
  const hasUploadedMaterial = Boolean(activeMaterial && activeMaterial.id !== "sample-bakery")
  const materialTitle = hasUploadedMaterial
    ? activeMaterial?.title
    : selectedScenario.defaultMaterial.name
  const materialMeta = hasUploadedMaterial
    ? activeMaterial?.kind === "pdf"
      ? `PDF · ${activeMaterial.chunkCount} fragmenten`
      : `Tekst · ${activeMaterial?.chunkCount ?? 0} fragmenten`
    : selectedScenario.defaultMaterial.size
  const conversationTurns = realtime.transcript.length
    ? realtime.transcript
    : createSeedConversationTurns(seedExchange, showCorrectionNote)

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
        updatePreferences((current) => {
          const nextMaterialIds = current.activeMaterialIds.filter((id) =>
            data.materials.some((material) => material.id === id),
          )

          return {
            ...current,
            activeMaterialIds: nextMaterialIds.length ? nextMaterialIds : [data.materials[0].id],
          }
        })
      })
      .catch(() => {
        if (isActive) {
          setUploadState({ status: "error", message: "Lokaal lesmateriaal niet beschikbaar" })
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  function selectLevel(level: PracticeLevel) {
    const nextScenario = scenarios.find((scenario) => scenario.level === level)
    const nextFocus = nextScenario ? focusForScenario(nextScenario) : null
    updatePreferences((current) => ({
      ...current,
      selectedLevel: level,
      selectedScenarioId: nextScenario?.id ?? current.selectedScenarioId,
      selectedVocabularyGoals: nextFocus?.selectedVocabularyGoals ?? current.selectedVocabularyGoals,
      focusedGrammar: nextFocus?.focusedGrammar ?? current.focusedGrammar,
    }))
  }

  function selectScenario(scenario: Scenario) {
    const nextFocus = focusForScenario(scenario)
    updatePreferences((current) => ({
      ...current,
      selectedLevel: scenario.level,
      selectedScenarioId: scenario.id,
      selectedVocabularyGoals: nextFocus.selectedVocabularyGoals,
      focusedGrammar: nextFocus.focusedGrammar,
    }))
  }

  async function handlePracticeToggle() {
    if (isLive) {
      realtime.disconnect()
      updatePreferences((current) => ({
        ...current,
        feedback: current.feedback.map((item, index) => ({
          ...item,
          score: Math.min(96, item.score + (index === 1 ? 4 : 2)),
        })),
        sessionScore: Math.min(98, current.sessionScore + 3),
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
      focusedVocabulary: selectedVocabularyGoals,
      focusedGrammar,
      correctionStyle,
    })
  }

  function toggleVocabularyGoal(goal: string) {
    updatePreferences((current) => {
      return {
        ...current,
        selectedVocabularyGoals: updateVocabularyGoals(current.selectedVocabularyGoals, goal),
      }
    })
  }

  function openGrammarFocus(point: string) {
    updatePreferences((current) => ({ ...current, focusedGrammar: point }))
    setActivePanel({ type: "grammar", point })
  }

  function resetLocalSessionState() {
    if (isLive) realtime.disconnect()
    savePreferences(cloneDefaultPreferences(defaultPreferences))
    setUploadState({ status: "idle", message: "Lokale oefenstatus gereset" })
    setActivePanel(null)
  }

  async function handleUpload(fileList: FileList | null) {
    const file = fileList?.[0]
    if (!file) return

    if (!/\.(txt|md|pdf)$/i.test(file.name)) {
      setUploadState({ status: "error", message: "Gebruik een .txt, .md of .pdf bestand" })
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setUploadState({ status: "uploading", message: "Lesmateriaal uploaden" })
    const formData = new FormData()
    formData.append("file", file)

    try {
      const response = await fetch("/api/materials", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null
        setUploadState({ status: "error", message: payload?.error ?? "Upload mislukt" })
        return
      }

      const payload = (await response.json()) as { material: LessonMaterialSummary }
      setMaterials((current) => [payload.material, ...current])
      updatePreferences((current) => ({ ...current, activeMaterialIds: [payload.material.id] }))
      setUploadState({ status: "success", message: "Lesmateriaal klaar" })
    } catch {
      setUploadState({ status: "error", message: "Upload-route nog niet beschikbaar" })
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

  const phaseCopy = {
    idle: "Ik luister…",
    connecting: "Verbinden…",
    listening: "Ik luister…",
    transcribing: "Transcriptie loopt…",
    "tutor-speaking": "Docent antwoordt…",
    "searching-materials": "Lesmateriaal zoeken…",
    reconnecting: "Opnieuw verbinden…",
    "missing-key": "API-sleutel ontbreekt",
    "mic-error": "Microfoon geblokkeerd",
    error: "Verbinding mislukt",
  }[realtime.phase]

  const headlineClass =
    "font-serif text-[34px] leading-[38px] tracking-tight text-[#1f2420] sm:text-[38px] sm:leading-[42px]"

  return (
    <main className="min-h-[100dvh] overflow-x-hidden bg-[#f4f1ea] text-[#1f2420]">
      <div className="grid min-h-[100dvh] w-full grid-cols-1 lg:grid-cols-[244px_minmax(0,1fr)_390px]">
        {/* LEFT RAIL */}
        <aside className="border-b border-[#e0ddd2] bg-[#f4f1ea] px-5 py-6 sm:px-7 sm:py-7 lg:sticky lg:top-0 lg:min-h-[100dvh] lg:border-b-0 lg:border-r">
          <div className="flex h-full flex-col gap-5">
            <p className="text-[18px] font-semibold leading-none tracking-tight text-[#1f2420]">
              Vlaams Studio
            </p>

            <Section eyebrow="Niveau">
              <div className="max-w-[300px] space-y-1.5 sm:max-w-none">
                {levels.map((level) => {
                  const isSelected = selectedLevel === level.id
                  return (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => selectLevel(level.id)}
                      aria-pressed={isSelected}
                      className={cn(
                        "group flex w-full items-center justify-between rounded-[8px] px-4 py-2.5 text-left transition active:scale-[0.99]",
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

            <RailRule />

            <Section eyebrow="Vandaag">
              <div className="flex items-start justify-between">
                <div>
                  <p className="tabular text-[40px] font-semibold leading-[42px] tracking-tight">
                    {streakDays}
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

            <RailRule />

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

            <div className="-mx-5 mt-auto border-t border-[#e0ddd2] sm:-mx-7">
              <button
                type="button"
                onClick={() => setActivePanel({ type: "profile" })}
                className="flex w-full items-center gap-3 border-b border-[#e0ddd2] px-5 py-4 text-left transition hover:bg-white/65 sm:px-7"
              >
                <span className="grid size-10 place-items-center rounded-full bg-[#607568] text-[12px] font-semibold text-white">
                  {learnerInitials}
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[13px] font-semibold">{learnerName}</span>
                  <span className="text-[11px] text-[#8a8e87]">Bekijk profiel</span>
                </span>
                <ChevronDown className="ml-auto size-4 text-[#8a8e87]" aria-hidden="true" />
              </button>
              <RailRow icon={Settings} onClick={() => setActivePanel({ type: "settings" })}>
                Instellingen
              </RailRow>
              <RailRow icon={LogOut} onClick={() => setActivePanel({ type: "reset" })}>
                Uitloggen
              </RailRow>
            </div>
          </div>
        </aside>

        {/* CENTER */}
        <section className="min-w-0 bg-[#fbfaf6] px-6 py-5 sm:px-8 lg:min-h-[100dvh] lg:px-16 lg:py-10">
          <div className="mx-auto w-full max-w-[1120px]">
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
                    "relative flex h-[156px] flex-col items-start justify-end overflow-hidden rounded-[8px] border px-5 pb-4 pt-3.5 text-left transition active:scale-[0.99]",
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
              {phaseCopy}
            </p>

            <div
              className="mt-2 flex h-[58px] w-full max-w-[600px] items-end justify-center gap-[3px]"
              aria-hidden="true"
            >
              <VoiceWaveform active={isLive} />
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
                  title={realtime.isMuted ? "Microfoon weer aan" : "Microfoon dempen"}
                  data-control-tooltip={realtime.isMuted ? "Microfoon weer aan" : "Microfoon dempen"}
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
                  title={isLive ? "Sessie beëindigen" : "Live sessie starten"}
                  data-control-tooltip={isLive ? "Sessie beëindigen" : "Live sessie starten"}
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
                  {isLive ? "Gesprek actief" : "Klik om te praten"}
                </span>
              </div>

              <div className="flex w-12 flex-col items-center">
                <button
                  type="button"
                  onClick={() => isLive && realtime.disconnect()}
                  aria-label="Gesprek beëindigen"
                  title="Gesprek beëindigen"
                  data-control-tooltip="Gesprek beëindigen"
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

          <PracticeConversation
            turns={conversationTurns}
            isLive={isLive}
            showCaptions={showCaptions}
            showSeedCorrectionNote={showCorrectionNote}
            onToggleSeedCorrectionNote={() => setShowCorrectionNote((value) => !value)}
          />

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
                className="rounded-[8px] border border-[#dcd8cb] bg-[#ece7d9] p-3.5"
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
                  onClick={() => setActivePanel({ type: "metric", metric: item })}
                  className="mt-3 inline-flex items-center rounded-md border border-[#e0ddd2] px-3 py-1.5 text-[12px] font-medium text-[#1f2420] transition hover:border-[#2f6f57] hover:text-[#2f6f57]"
                >
                  Details
                </button>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* RIGHT RAIL — flat-on-rail layout: full-width hairlines separate sections,
            content sits directly on the ivory background. The only surfaces with
            their own card are the file upload (functional grouping) and the
            teacher note (visual emphasis). */}
        <aside className="border-t border-[#e0ddd2] bg-[#f4f1ea] lg:sticky lg:top-0 lg:min-h-[100dvh] lg:border-l lg:border-t-0">
          <RailSection eyebrow="Lesmateriaal" first>
            <div className="rounded-[8px] border border-dashed border-[#d6d1c3] bg-white px-4 py-4">
              <div className="grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-4">
                <span className="flex h-12 items-center justify-center border-r border-[#e0ddd2] text-[#1f2420]">
                  <FileText className="size-8" strokeWidth={1.35} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold leading-none">
                    {materialTitle}
                  </p>
                  <p className="mt-1 text-[11px] text-[#8a8e87]">{materialMeta}</p>
                </div>
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-white",
                    uploadState.status === "error"
                      ? "bg-[#c98b3a]"
                      : uploadState.status === "uploading"
                        ? "animate-pulse bg-[#c98b3a]"
                        : "bg-[#2f6f57]",
                  )}
                >
                  {uploadState.status === "error" ? (
                    <AlertCircle className="size-3.5" strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <CheckMark />
                  )}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadState.status === "uploading"}
              className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-[8px] border border-[#e0ddd2] bg-white px-3 text-[13px] font-medium text-[#1f2420] transition hover:border-[#2f6f57] hover:text-[#2f6f57] disabled:opacity-60"
            >
              <RotateCcw className="size-4" strokeWidth={1.6} aria-hidden="true" />
              {uploadState.status === "uploading" ? "Materiaal verwerken" : "Materiaal vervangen"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf"
              className="hidden"
              onChange={(event) => void handleUpload(event.currentTarget.files)}
            />
            {uploadState.message && (
              <p
                className={cn(
                  "mt-2 text-[11px]",
                  uploadState.status === "error" ? "text-[#9a5b28]" : "text-[#8a8e87]",
                )}
              >
                {uploadState.message}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between">
              <p className="text-[13px] font-medium text-[#5a615b]">
                Gebruik dit materiaal in sessie
              </p>
              <Switch
                checked={useMaterialInSession}
                onCheckedChange={(checked) =>
                  updatePreferences((current) => ({ ...current, useMaterialInSession: checked }))
                }
                className="data-[state=checked]:bg-[#2f6f57]"
              />
            </div>
          </RailSection>

          <RailSection eyebrow="Actief lesonderwerp">
            <p className="text-[14px] font-semibold leading-tight">{selectedScenario.topic}</p>
            <p className="mt-1.5 text-[12px] text-[#8a8e87]">{selectedScenario.topicCategory}</p>
            <button
              type="button"
              onClick={() => setActivePanel({ type: "setup" })}
              className="mt-3 inline-flex items-center rounded-[8px] border border-[#e0ddd2] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1f2420] transition hover:border-[#2f6f57] hover:text-[#2f6f57]"
            >
              Aanpassen
            </button>
          </RailSection>

          <RailSection eyebrow="Woordenschatdoelen">
            <div className="flex flex-wrap gap-x-2 gap-y-1.5">
              {selectedScenario.vocabularyGoals.map((word) => {
                const isGoalSelected = selectedVocabularyGoals.includes(word)
                return (
                <button
                  key={word}
                  type="button"
                  onClick={() => toggleVocabularyGoal(word)}
                  aria-pressed={isGoalSelected}
                  className={cn(
                    "inline-flex items-center rounded-[5px] border px-2.5 py-1.5 text-[11px] font-medium leading-none text-[#5a615b] transition hover:border-[#2f6f57] hover:text-[#2f6f57]",
                    isGoalSelected
                      ? "border-[#cbd9cf] bg-[#eef5f0] text-[#2f6f57]"
                      : "border-[#e6e2d6] bg-white",
                  )}
                >
                  {word}
                </button>
                )
              })}
            </div>
          </RailSection>

          <RailSection eyebrow="Grammaticafocus">
            <ul className="-mx-1">
              {selectedScenario.grammarPoints.map((point) => (
                <li key={point}>
                  <button
                    type="button"
                    onClick={() => openGrammarFocus(point)}
                    aria-pressed={focusedGrammar === point}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-[6px] px-1 py-2 text-left text-[13px] leading-[20px] transition hover:text-[#2f6f57]",
                      focusedGrammar === point ? "text-[#2f6f57]" : "text-[#1f2420]",
                    )}
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
      <StudioPanelOverlay
        panel={activePanel}
        preferences={preferences}
        selectedScenario={selectedScenario}
        materials={materials}
        activeMaterial={activeMaterial}
        onClose={() => setActivePanel(null)}
        onReset={resetLocalSessionState}
        onSelectLevel={selectLevel}
        onSelectScenario={selectScenario}
        onToggleVocabulary={toggleVocabularyGoal}
        onSetCorrectionStyle={(style) =>
          updatePreferences((current) => ({ ...current, correctionStyle: style }))
        }
        onSetShowCaptions={(checked) =>
          updatePreferences((current) => ({ ...current, showCaptions: checked }))
        }
        onSetUseMaterial={(checked) =>
          updatePreferences((current) => ({ ...current, useMaterialInSession: checked }))
        }
      />
    </main>
  )
}

function VoiceWaveform({ active }: { active: boolean }) {
  const waveformHeights = useWaveform(active)

  return (
    <>
      {waveformHeights.map((value, index) => (
        <span
          key={index}
          className="block w-[2.5px] rounded-full bg-[#2f6f57] transition-[height] duration-100 ease-out"
          style={{ height: `${Math.max(4, Math.min(96, value))}%` }}
        />
      ))}
    </>
  )
}

function PracticeConversation({
  turns,
  isLive,
  showCaptions,
  showSeedCorrectionNote,
  onToggleSeedCorrectionNote,
}: {
  turns: TranscriptTurn[]
  isLive: boolean
  showCaptions: boolean
  showSeedCorrectionNote: boolean
  onToggleSeedCorrectionNote: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [isPinnedToLive, setIsPinnedToLive] = useState(true)

  useEffect(() => {
    if (!isPinnedToLive) return
    const container = scrollRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
  }, [turns, isPinnedToLive])

  function handleScroll() {
    const container = scrollRef.current
    if (!container) return
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
    setIsPinnedToLive(distanceFromBottom < 28)
  }

  function jumpToLive() {
    const container = scrollRef.current
    if (!container) return
    container.scrollTop = container.scrollHeight
    setIsPinnedToLive(true)
  }

  const visibleTurns = showCaptions
    ? turns
    : turns.filter((turn) => turn.speaker === "Correction" || turn.speaker === "Material" || turn.speaker === "System")

  return (
    <section className="mt-5 overflow-hidden rounded-[8px] border border-[#e6e2d6] bg-white">
      <div className="flex items-center justify-between border-b border-[#ededdf] px-5 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-4 text-[#2f6f57]" strokeWidth={1.6} aria-hidden="true" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8e87]">
            Gesprek
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
            isLive ? "text-[#2f6f57]" : "text-[#8a8e87]",
          )}
        >
          <span className={cn("size-1.5 rounded-full", isLive ? "bg-[#2f6f57]" : "bg-[#cfcec5]")} />
          {isLive ? "Live" : "Voorbeeld"}
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        role="log"
        aria-live="polite"
        aria-label="Gesprekstranscript"
        className="relative max-h-[320px] overflow-y-auto scroll-smooth"
      >
        <div className="divide-y divide-[#ededdf]">
          {!showCaptions && (
            <div className="px-5 py-3 text-[13px] leading-[20px] text-[#5a615b]">
              Bijschriften zijn verborgen. Correcties en lesmateriaal blijven zichtbaar.
            </div>
          )}
          {visibleTurns.length ? (
            visibleTurns.map((turn) => (
              <ConversationTurn
                key={turn.id}
                turn={turn}
                showSeedCorrectionNote={showSeedCorrectionNote}
                onToggleSeedCorrectionNote={onToggleSeedCorrectionNote}
              />
            ))
          ) : (
            <div className="px-5 py-4 text-[13px] leading-[20px] text-[#8a8e87]">
              Nog geen correcties in deze sessie.
            </div>
          )}
        </div>
        {!isPinnedToLive && (
          <button
            type="button"
            onClick={jumpToLive}
            className="sticky bottom-3 left-1/2 z-[1] -translate-x-1/2 rounded-full border border-[#d6d1c3] bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2f6f57] shadow-[0_8px_24px_rgba(31,36,32,0.08)]"
          >
            Nieuwste
          </button>
        )}
      </div>
    </section>
  )
}

function ConversationTurn({
  turn,
  showSeedCorrectionNote,
  onToggleSeedCorrectionNote,
}: {
  turn: TranscriptTurn
  showSeedCorrectionNote: boolean
  onToggleSeedCorrectionNote: () => void
}) {
  if (turn.speaker === "Correction" && turn.correction) {
    return (
      <div className="px-5 py-4">
        <div className="grid gap-4 sm:grid-cols-[88px_minmax(0,1fr)_auto] sm:items-start">
          <span className="text-[13px] text-[#8a8e87]">Verbeterd</span>
          <CorrectionCard correction={turn.correction} showReason={turn.id !== "seed-correction" || showSeedCorrectionNote} />
          {turn.id === "seed-correction" && (
            <button
              type="button"
              onClick={onToggleSeedCorrectionNote}
              aria-label={showSeedCorrectionNote ? "Verberg toelichting" : "Toon toelichting"}
              title={showSeedCorrectionNote ? "Verberg toelichting" : "Toon toelichting"}
              data-control-tooltip={showSeedCorrectionNote ? "Verberg toelichting" : "Toon toelichting"}
              className="grid size-7 place-items-center rounded-full border border-[#e0ddd2] text-[#5a615b] transition hover:border-[#2f6f57] hover:text-[#2f6f57]"
            >
              <ChevronDown
                className={cn(
                  "size-4 transition-transform",
                  showSeedCorrectionNote ? "rotate-180" : "rotate-0",
                )}
              />
            </button>
          )}
        </div>
      </div>
    )
  }

  if (turn.speaker === "Material") {
    return (
      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 bg-[#f7faf6] px-5 py-3.5">
        <span className="text-[13px] text-[#8a8e87]">Materiaal</span>
        <p className="flex items-center gap-2 text-[13px] leading-[20px] text-[#2f6f57]">
          <BookOpen className="size-4 shrink-0" strokeWidth={1.6} aria-hidden="true" />
          {turn.text}
        </p>
      </div>
    )
  }

  if (turn.speaker === "System") {
    return (
      <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 bg-[#fff8ed] px-5 py-3.5">
        <span className="text-[13px] text-[#8a8e87]">Systeem</span>
        <p className="flex items-center gap-2 text-[13px] leading-[20px] text-[#765327]">
          <AlertCircle className="size-4 shrink-0" strokeWidth={1.6} aria-hidden="true" />
          {turn.text}
        </p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-4 px-5 py-3.5">
      <span className="text-[13px] text-[#8a8e87]">{transcriptLabel(turn.speaker)}</span>
      <div>
        <p
          className={cn(
            "text-[14px] leading-[22px] text-[#1f2420]",
            turn.status === "partial" && "text-[#5a615b] italic",
          )}
        >
          {turn.text}
        </p>
        {turn.status === "partial" && (
          <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.14em] text-[#8a8e87]">
            live transcriptie
          </p>
        )}
      </div>
    </div>
  )
}

function CorrectionCard({
  correction,
  showReason,
}: {
  correction: CorrectionPayload
  showReason: boolean
}) {
  return (
    <div className="rounded-[8px] border border-[#d8e4da] bg-[#f7faf6] p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-[#2f6f57] text-white">
          <CheckMark />
        </span>
        <div className="min-w-0">
          <p className="mb-1 text-[12px] leading-[18px] text-[#8a8e87] line-through decoration-[#c98b3a]/50">
            {correction.original}
          </p>
          <p className="text-[14px] leading-[22px] text-[#1f2420]">
            <span className="font-semibold text-[#2f6f57] underline decoration-[#2f6f57]/40 decoration-1 underline-offset-4">
              {correction.corrected}
            </span>
          </p>
          {showReason && (
            <div className="mt-2 space-y-1 text-[12.5px] leading-[19px] text-[#5a615b]">
              <p>{correction.reason}</p>
              {correction.grammarPoint && (
                <p className="text-[#8a8e87]">Focus: {correction.grammarPoint}</p>
              )}
              {correction.retryPrompt && (
                <p className="font-medium text-[#2f6f57]">{correction.retryPrompt}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StudioPanelOverlay({
  panel,
  preferences,
  selectedScenario,
  materials,
  activeMaterial,
  onClose,
  onReset,
  onSelectLevel,
  onSelectScenario,
  onToggleVocabulary,
  onSetCorrectionStyle,
  onSetShowCaptions,
  onSetUseMaterial,
}: {
  panel: ActivePanel
  preferences: PracticePreferences
  selectedScenario: Scenario
  materials: LessonMaterialSummary[]
  activeMaterial?: LessonMaterialSummary
  onClose: () => void
  onReset: () => void
  onSelectLevel: (level: PracticeLevel) => void
  onSelectScenario: (scenario: Scenario) => void
  onToggleVocabulary: (goal: string) => void
  onSetCorrectionStyle: (style: PracticePreferences["correctionStyle"]) => void
  onSetShowCaptions: (checked: boolean) => void
  onSetUseMaterial: (checked: boolean) => void
}) {
  if (!panel) return null

  const title = panelTitleFor(panel)

  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-[#1f2420]/18 px-4 py-6 backdrop-blur-[2px]">
      <section className="w-full max-w-[520px] overflow-hidden rounded-[10px] border border-[#d6d1c3] bg-[#fbfaf6] shadow-[0_24px_70px_-30px_rgba(31,36,32,0.45)]">
        <div className="flex items-center justify-between border-b border-[#e0ddd2] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8e87]">
              Vlaams Studio
            </p>
            <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-[#1f2420]">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Paneel sluiten"
            className="grid size-8 place-items-center rounded-full border border-[#e0ddd2] bg-white text-[#5a615b] transition hover:border-[#2f6f57] hover:text-[#2f6f57]"
          >
            <X className="size-4" strokeWidth={1.7} />
          </button>
        </div>
        <div className="max-h-[70dvh] overflow-y-auto p-5">
          {panel.type === "profile" && (
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <span className="grid size-12 place-items-center rounded-full bg-[#607568] text-[13px] font-semibold text-white">
                  {learnerInitials}
                </span>
                <div>
                  <p className="text-[15px] font-semibold">{learnerName}</p>
                  <p className="text-[13px] text-[#8a8e87]">
                    {preferences.streakDays} dagen op rij · {preferences.progress[preferences.selectedLevel]}% {preferences.selectedLevel}
                  </p>
                </div>
              </div>
              <PanelStat label="Huidig niveau" value={preferences.selectedLevel} note={selectedScenario.topicCategory} />
              <PanelStat label="Sessiescore" value={`${preferences.sessionScore} / 100`} note="Laatste lokale oefensessie" />
              <PanelStat label="Actieve doelen" value={`${preferences.selectedVocabularyGoals.length}`} note={preferences.selectedVocabularyGoals.join(", ")} />
            </div>
          )}

          {panel.type === "settings" && (
            <div className="space-y-5">
              <PanelSwitch
                label="Bijschriften tonen"
                checked={preferences.showCaptions}
                onCheckedChange={onSetShowCaptions}
              />
              <PanelSwitch
                label="Lesmateriaal gebruiken"
                checked={preferences.useMaterialInSession}
                onCheckedChange={onSetUseMaterial}
              />
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8a8e87]">
                  Correctiestijl
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(["gentle", "direct"] as const).map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => onSetCorrectionStyle(style)}
                      aria-pressed={preferences.correctionStyle === style}
                      className={cn(
                        "rounded-[8px] border px-3 py-2 text-[13px] font-medium transition",
                        preferences.correctionStyle === style
                          ? "border-[#2f6f57] bg-[#eef5f0] text-[#2f6f57]"
                          : "border-[#e0ddd2] bg-white text-[#1f2420] hover:border-[#2f6f57]",
                      )}
                    >
                      {style === "gentle" ? "Rustig" : "Direct"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {panel.type === "reset" && (
            <div className="space-y-4">
              <p className="text-[14px] leading-[22px] text-[#5a615b]">
                Er is geen account in deze lokale MVP. Deze actie reset alleen je lokale niveau,
                scenario, score, doelen en sessiestatus.
              </p>
              <div className="flex justify-end gap-2">
                <PanelButton onClick={onClose}>Annuleren</PanelButton>
                <PanelButton tone="danger" onClick={onReset}>
                  Reset lokaal
                </PanelButton>
              </div>
            </div>
          )}

          {panel.type === "setup" && (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8a8e87]">
                  Niveau
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {levels.map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => onSelectLevel(level.id)}
                      className={cn(
                        "rounded-[8px] border px-3 py-2 text-[13px] font-semibold transition",
                        preferences.selectedLevel === level.id
                          ? "border-[#2f6f57] bg-[#2f6f57] text-white"
                          : "border-[#e0ddd2] bg-white text-[#1f2420] hover:border-[#2f6f57]",
                      )}
                    >
                      {level.id}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[12px] font-semibold uppercase tracking-[0.16em] text-[#8a8e87]">
                  Scenario
                </p>
                <div className="space-y-2">
                  {scenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => onSelectScenario(scenario)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[8px] border px-3 py-2 text-left transition",
                        preferences.selectedScenarioId === scenario.id
                          ? "border-[#2f6f57] bg-[#eef5f0]"
                          : "border-[#e0ddd2] bg-white hover:border-[#2f6f57]",
                      )}
                    >
                      <span>
                        <span className="block text-[13px] font-semibold">{scenario.title}</span>
                        <span className="text-[12px] text-[#8a8e87]">{scenario.topicCategory}</span>
                      </span>
                      {preferences.selectedScenarioId === scenario.id && (
                        <CheckCircle2 className="size-4 text-[#2f6f57]" strokeWidth={1.8} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
              <PanelStat
                label="Actief materiaal"
                value={activeMaterial?.title ?? "Geen materiaal"}
                note={`${materials.length} lokaal opgeslagen bestand${materials.length === 1 ? "" : "en"}`}
              />
            </div>
          )}

          {panel.type === "metric" && (
            <div className="space-y-4">
              <PanelStat
                label={panel.metric.label}
                value={`${panel.metric.score} / 100`}
                note={panel.metric.note}
              />
              <div className="rounded-[8px] border border-[#e0ddd2] bg-white p-4">
                <p className="text-[13px] leading-[21px] text-[#5a615b]">
                  {metricDetailCopy(panel.metric)}
                </p>
              </div>
            </div>
          )}

          {panel.type === "grammar" && (
            <div className="space-y-4">
              <PanelStat label="Focus" value={panel.point} note={selectedScenario.topic} />
              <div className="rounded-[8px] border border-[#e0ddd2] bg-white p-4">
                <p className="text-[13px] leading-[21px] text-[#5a615b]">
                  De volgende live sessie stuurt de tutor om dit punt actief te oefenen, met een
                  korte correctie zodra je het gebruikt.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedScenario.vocabularyGoals.map((goal) => (
                  <button
                    key={goal}
                    type="button"
                    onClick={() => onToggleVocabulary(goal)}
                    className={cn(
                      "rounded-[5px] border px-2.5 py-1.5 text-[11px] font-medium transition",
                      preferences.selectedVocabularyGoals.includes(goal)
                        ? "border-[#cbd9cf] bg-[#eef5f0] text-[#2f6f57]"
                        : "border-[#e6e2d6] bg-white text-[#5a615b] hover:border-[#2f6f57]",
                    )}
                  >
                    {goal}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function PanelStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[8px] border border-[#e0ddd2] bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8e87]">{label}</p>
      <p className="mt-2 text-[18px] font-semibold leading-tight text-[#1f2420]">{value}</p>
      <p className="mt-1 text-[13px] leading-[20px] text-[#5a615b]">{note}</p>
    </div>
  )
}

function PanelSwitch({
  label,
  checked,
  onCheckedChange,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[8px] border border-[#e0ddd2] bg-white p-4">
      <p className="text-[13px] font-medium text-[#1f2420]">{label}</p>
      <Switch checked={checked} onCheckedChange={onCheckedChange} className="data-[state=checked]:bg-[#2f6f57]" />
    </div>
  )
}

function PanelButton({
  children,
  onClick,
  tone = "neutral",
}: {
  children: React.ReactNode
  onClick: () => void
  tone?: "neutral" | "danger"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-[8px] border px-3 py-2 text-[13px] font-medium transition",
        tone === "danger"
          ? "border-[#c98b3a] bg-[#fff8ed] text-[#765327] hover:bg-[#f9eddc]"
          : "border-[#e0ddd2] bg-white text-[#1f2420] hover:border-[#2f6f57] hover:text-[#2f6f57]",
      )}
    >
      {children}
    </button>
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

function RailRule() {
  return <div className="h-px bg-[#e0ddd2]" aria-hidden="true" />
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
        "px-8",
        first ? "pb-8 pt-10" : "py-8",
        !first && "border-t border-[#e0ddd2]",
        last && "border-b border-[#e0ddd2]",
      )}
    >
      <div className="max-w-[292px]">
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8e87]">
          {eyebrow}
        </p>
        {children}
      </div>
    </section>
  )
}

function RailRow({
  icon: Icon,
  onClick,
  children,
}: {
  icon: typeof Settings
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 border-b border-[#e0ddd2] px-5 py-4 text-left text-[13px] text-[#5a615b] transition hover:bg-white/65 sm:px-7"
    >
      <Icon className="size-4" strokeWidth={1.6} aria-hidden="true" />
      {children}
    </button>
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

function transcriptLabel(speaker: "Tutor" | "You" | "Correction" | "Material" | "System") {
  if (speaker === "You") return "Jij zei"
  if (speaker === "Correction") return "Verbeterd"
  if (speaker === "Material") return "Materiaal"
  if (speaker === "System") return "Systeem"
  return "Docent"
}

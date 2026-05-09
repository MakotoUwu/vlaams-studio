import type { FeedbackItem, Scenario } from "@/lib/practice-data"

export type StudioPanelType = "profile" | "settings" | "reset" | "setup" | "metric" | "grammar"

export function updateVocabularyGoals(currentGoals: string[], goal: string) {
  const exists = currentGoals.includes(goal)
  const nextGoals = exists ? currentGoals.filter((item) => item !== goal) : [...currentGoals, goal]

  return nextGoals.length ? nextGoals : [goal]
}

export function focusForScenario(scenario: Scenario) {
  return {
    selectedVocabularyGoals: [scenario.vocabularyGoals[0] ?? scenario.vocabulary[0] ?? "spreken"],
    focusedGrammar: scenario.grammarPoints[0] ?? null,
  }
}

export function panelTitleFor(panel: { type: StudioPanelType; metric?: FeedbackItem }) {
  if (panel.type === "profile") return "Profiel"
  if (panel.type === "settings") return "Instellingen"
  if (panel.type === "reset") return "Lokale sessie resetten"
  if (panel.type === "setup") return "Oefening aanpassen"
  if (panel.type === "grammar") return "Grammaticafocus"
  return panel.metric?.label ?? "Details"
}

export function metricDetailCopy(metric: FeedbackItem) {
  return `Volgende sessie: vraag de tutor om twee korte herhalingen, een natuurlijker Vlaams alternatief en een snelle retry voor ${metric.label.toLowerCase()}.`
}

export function cloneDefaultPreferences<T>(defaults: T): T {
  return JSON.parse(JSON.stringify(defaults)) as T
}

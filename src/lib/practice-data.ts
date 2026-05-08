export type PracticeLevel = "A1" | "A2" | "B1" | "B2"

export type Scenario = {
  id: string
  title: string
  location: string
  level: PracticeLevel
  objective: string
  vocabulary: string[]
  grammarFocus: string
  starter: string
}

export type FeedbackItem = {
  label: string
  score: number
  note: string
}

export type LessonMaterialSummary = {
  id: string
  title: string
  kind: "text" | "pdf"
  chunkCount: number
  createdAt: string
}

export const levels: Array<{
  id: PracticeLevel
  label: string
  detail: string
  progress: number
}> = [
  { id: "A1", label: "Starter", detail: "survival phrases", progress: 38 },
  { id: "A2", label: "Daily flow", detail: "routine topics", progress: 54 },
  { id: "B1", label: "Independent", detail: "opinions and plans", progress: 29 },
  { id: "B2", label: "Sharp", detail: "nuance and pace", progress: 12 },
]

export const scenarios: Scenario[] = [
  {
    id: "bakery-antwerp",
    title: "At the bakery",
    location: "Antwerp",
    level: "A1",
    objective: "Order bread, ask for price, and respond naturally.",
    vocabulary: ["brood", "pistolet", "graag", "hoeveel", "meenemen"],
    grammarFocus: "Polite requests with graag and mag ik.",
    starter: "Goeiemorgen, wat mag het zijn?",
  },
  {
    id: "tram-stop",
    title: "At the tram stop",
    location: "Mechelen",
    level: "A2",
    objective: "Ask for directions, platform, and timing.",
    vocabulary: ["halte", "richting", "overstappen", "vertraging", "ticket"],
    grammarFocus: "Er is and er zijn for transport context.",
    starter: "Pardon, weet u of tram 7 hier stopt?",
  },
  {
    id: "doctor-appointment",
    title: "Doctor appointment",
    location: "Leuven",
    level: "B1",
    objective: "Describe symptoms and confirm next steps.",
    vocabulary: ["afspraak", "keelpijn", "duizelig", "voorschrift", "onderzoek"],
    grammarFocus: "Past tense with hebben and zijn.",
    starter: "Vertel eens, waar hebt ge last van?",
  },
  {
    id: "apartment-viewing",
    title: "Apartment viewing",
    location: "Ghent",
    level: "B2",
    objective: "Negotiate details and ask precise follow-up questions.",
    vocabulary: ["huurwaarborg", "gemeenschappelijke kosten", "plaatsbeschrijving", "opzegtermijn"],
    grammarFocus: "Conditional phrasing with zou and kunnen.",
    starter: "Kom binnen, dan toon ik eerst de leefruimte.",
  },
]

export const seedFeedback: FeedbackItem[] = [
  {
    label: "Pronunciation",
    score: 74,
    note: "Keep short vowels crisp in words like mag and tram.",
  },
  {
    label: "Vocabulary",
    score: 68,
    note: "Use graag earlier in the sentence for natural requests.",
  },
  {
    label: "Confidence",
    score: 81,
    note: "You recovered well after a correction.",
  },
]

export const seedMaterials: LessonMaterialSummary[] = [
  {
    id: "sample-bakery",
    title: "Course topic: shopping and food",
    kind: "text",
    chunkCount: 4,
    createdAt: new Date("2026-05-08T12:00:00.000Z").toISOString(),
  },
]

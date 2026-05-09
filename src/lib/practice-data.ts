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
  duration: string
  topic: string
  topicCategory: string
  vocabularyGoals: string[]
  grammarPoints: string[]
  teacherNote: string
  teacherNoteAuthor: string
  teacherNoteEditedAt: string
  defaultMaterial: {
    name: string
    size: string
  }
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
  { id: "A1", label: "Beginner", detail: "overlevingsfrasen", progress: 38 },
  { id: "A2", label: "Elementair", detail: "dagelijks leven", progress: 64 },
  { id: "B1", label: "Gevorderd", detail: "meningen en plannen", progress: 29 },
  { id: "B2", label: "Hooggevorderd", detail: "nuance en tempo", progress: 12 },
]

export const scenarios: Scenario[] = [
  {
    id: "bakery-antwerp",
    title: "At the bakery in Antwerp",
    location: "Antwerpen",
    level: "A2",
    objective:
      "Oefen een natuurlijk gesprek in de bakkerij. Vraag naar brood, prijzen en specialiteiten.",
    vocabulary: ["brood", "pistolet", "graag", "hoeveel", "meenemen"],
    grammarFocus: "Beleefde vragen met 'zou graag' en 'mag ik'.",
    starter: "Goeiemorgen, wat mag het zijn?",
    duration: "8–10 min",
    topic: "Eten en drinken / Bakkerswinkel",
    topicCategory: "A2 — Dagelijks leven",
    vocabularyGoals: [
      "broodsoorten",
      "prijzen",
      "hoeveelheid",
      "betalen",
      "specialiteiten",
      "vers",
    ],
    grammarPoints: [
      "Vraagzinnen met 'zou graag'",
      "Hoeveelheid + eenheden",
      "Gebruik van 'alstublieft'",
    ],
    teacherNote:
      "Leerling wil vloeiender worden in korte servicegesprekken. Focus op natuurlijke uitspraak en samenstellingen (bv. volkorenbrood). Let op intonatie bij vragen.",
    teacherNoteAuthor: "Sofie V.",
    teacherNoteEditedAt: "Vandaag, 09:15",
    defaultMaterial: {
      name: "bakkerij-dialogen.pdf",
      size: "PDF · 420 KB",
    },
  },
  {
    id: "tram-stop",
    title: "At the tram stop",
    location: "Mechelen",
    level: "A1",
    objective: "Vraag naar de richting, het perron en de aankomsttijd.",
    vocabulary: ["halte", "richting", "overstappen", "vertraging", "ticket"],
    grammarFocus: "'Er is' en 'er zijn' bij vervoer.",
    starter: "Pardon, weet u of tram 7 hier stopt?",
    duration: "6–8 min",
    topic: "Mobiliteit / Openbaar vervoer",
    topicCategory: "A1 — Onderweg",
    vocabularyGoals: ["halte", "richting", "perron", "ticket", "frequentie"],
    grammarPoints: [
      "Vragen met 'weet u of'",
      "Tijdsaanduidingen",
      "Beleefdheidsvormen 'u'",
    ],
    teacherNote:
      "Werk aan het vragen om herhaling. Trainings­gesprekjes mogen kort blijven, focus op duidelijkheid en intonatie.",
    teacherNoteAuthor: "Sofie V.",
    teacherNoteEditedAt: "Vorige week, 14:02",
    defaultMaterial: {
      name: "tramhaltes.pdf",
      size: "PDF · 312 KB",
    },
  },
  {
    id: "doctor-appointment",
    title: "At the doctor appointment",
    location: "Leuven",
    level: "B1",
    objective: "Beschrijf je symptomen en bevestig de volgende stappen.",
    vocabulary: ["afspraak", "keelpijn", "duizelig", "voorschrift", "onderzoek"],
    grammarFocus: "Verleden tijd met 'hebben' en 'zijn'.",
    starter: "Vertel eens, waar hebt ge last van?",
    duration: "10–12 min",
    topic: "Gezondheid / Bij de arts",
    topicCategory: "B1 — Lichaam en gezondheid",
    vocabularyGoals: ["symptomen", "lichaam", "voorschrift", "tijdspad", "verzekering"],
    grammarPoints: [
      "Voltooid verleden tijd",
      "Hulpwerkwoorden 'hebben' / 'zijn'",
      "Indirecte vragen",
    ],
    teacherNote:
      "Leerling moet zelfverzekerd om verduidelijking durven vragen. Oefen het herformuleren wanneer iets niet duidelijk is.",
    teacherNoteAuthor: "Sofie V.",
    teacherNoteEditedAt: "Vorige maand",
    defaultMaterial: {
      name: "huisarts-script.pdf",
      size: "PDF · 540 KB",
    },
  },
  {
    id: "apartment-viewing",
    title: "Apartment viewing",
    location: "Gent",
    level: "B2",
    objective: "Onderhandel over details en stel gerichte vervolgvragen.",
    vocabulary: [
      "huurwaarborg",
      "gemeenschappelijke kosten",
      "plaatsbeschrijving",
      "opzegtermijn",
    ],
    grammarFocus: "Conditioneel met 'zou' en 'kunnen'.",
    starter: "Kom binnen, dan toon ik eerst de leefruimte.",
    duration: "12–15 min",
    topic: "Wonen / Bezichtiging",
    topicCategory: "B2 — Wonen",
    vocabularyGoals: ["contract", "kosten", "termijnen", "voorwaarden", "staat"],
    grammarPoints: [
      "Conditioneel 'zou'",
      "Bijzinnen met 'omdat' / 'hoewel'",
      "Indirecte rede",
    ],
    teacherNote:
      "Daag de leerling uit met onverwachte vragen over kosten. Stuur op precieze formulering en intonatie.",
    teacherNoteAuthor: "Sofie V.",
    teacherNoteEditedAt: "2 weken geleden",
    defaultMaterial: {
      name: "huurcontract-vragen.pdf",
      size: "PDF · 612 KB",
    },
  },
]

export const seedFeedback: FeedbackItem[] = [
  {
    label: "Uitspraak",
    score: 72,
    note: "Let op: lange klinkers",
  },
  {
    label: "Woordenschat",
    score: 81,
    note: "Sterk gebruik van vocabulaire",
  },
  {
    label: "Zelfvertrouwen",
    score: 67,
    note: "Blijf volhouden, je groeit!",
  },
]

export const seedMaterials: LessonMaterialSummary[] = [
  {
    id: "sample-bakery",
    title: "bakkerij-dialogen.pdf",
    kind: "pdf",
    chunkCount: 4,
    createdAt: new Date("2026-05-08T12:00:00.000Z").toISOString(),
  },
]

# Vlaams Studio

Local web app for practicing Flemish with GPT Realtime 2, CEFR levels, roleplay scenarios, and uploaded lesson material context.

## Setup

```bash
pnpm install
cp .env.local.example .env.local
```

Add your OpenAI API key to `.env.local`:

```bash
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
```

Use `OPENAI_BASE_URL=https://eu.api.openai.com/v1` only if your OpenAI account is configured for the EU endpoint.

## Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Local Data

- Uploaded `.txt`, `.md`, and `.pdf` lesson material is parsed and stored under `.local/materials`.
- `.local/` is ignored by git.
- Level selection, scenario selection, progress, material toggle, streak, session score, and recent feedback are stored in browser `localStorage`.
- Live voice sessions are unavailable until `OPENAI_API_KEY` is present.

## Realtime Flow

- The browser never receives the standard OpenAI API key.
- `POST /api/realtime/session` creates a short-lived Realtime client secret.
- The browser uses that ephemeral secret to connect to `/v1/realtime/calls` over WebRTC.
- The Realtime model can call `search_lesson_materials` to pull chunks from uploaded course material.
- The live transcript handles learner speech, tutor speech, material lookup notices, and Realtime errors as chat turns.

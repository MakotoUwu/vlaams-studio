# Vlaams Studio — Design Reference

The single source of truth for how the studio screen should look. Every UI change must be checked against the reference screenshot at `public/design/studio-reference.png` (or against this file when the asset is unavailable). When the implementation drifts, update the implementation, not this doc.

## Layout

Three-column app shell on desktop, full-bleed on the page background. The shell does **not** sit on a card — the columns themselves are the surfaces.

```
┌─────────────┬──────────────────────────────┬─────────────┐
│  Left rail  │      Studio (main)           │ Right rail  │
│  ~232 px    │      flexible (1fr)          │  ~328 px    │
└─────────────┴──────────────────────────────┴─────────────┘
```

- Left and right rails get a faint vertical divider against the studio column.
- Max content width ~ 1480 px. Center the shell on wider screens.
- Vertical rhythm: 24 px section gap, 16 px tile gap, 12 px chip gap.

## Color tokens

Warm ivory page, deep forest green accent, charcoal-ink text. No pure black or pure white anywhere except as sparing accents.

| Token            | Hex        | Usage                                            |
| ---------------- | ---------- | ------------------------------------------------ |
| `--ivory`        | `#f4f1ea`  | Page background                                  |
| `--ivory-rail`   | `#ebe7dd`  | (reserved) subtle rail tint                      |
| `--paper`        | `#ffffff`  | Cards, scenario tiles, transcript bubbles        |
| `--ink`          | `#1f2420`  | Primary text                                     |
| `--ink-soft`     | `#5a615b`  | Secondary text, eyebrow labels                   |
| `--ink-muted`    | `#8a8e87`  | Tertiary text, captions                          |
| `--line`         | `#e0ddd2`  | Hairline borders, divider lines                  |
| `--green`        | `#2f6f57`  | Primary accent, active state, CTA fill           |
| `--green-deep`   | `#245746`  | Hover state on primary CTA                       |
| `--green-tint`   | `#e8efe9`  | Active-card halo, success tint backgrounds      |
| `--amber`        | `#c98b3a`  | Streak flame, gentle warning numbers             |

Status colors stay subtle — never neon. Any green block (active scenario tile, mic button) is solid `--green`; any green text on white uses `--green` directly.

## Typography

- **Sans**: Geist (already loaded). Default body, UI, numbers in score panels.
- **Serif**: Instrument Serif. Used **only** for the big scenario headline and the large score number (`78 / 100`). Nowhere else.
- **Weights**: 500 for medium UI, 600 for emphasis, 700 only inside the active level badge. The serif headline is regular weight (400).
- **Eyebrow labels** (`NIVEAU`, `VANDAAG`, `LESMATERIAAL`, `WOORDENSCHATDOELEN`, etc.) — 11px uppercase, letter-spacing `0.18em`, color `--ink-muted`.

Font sizes:

| Role                     | Size / leading      |
| ------------------------ | ------------------- |
| Scenario headline        | 36 / 40 serif       |
| Section card title       | 16 / 22 sans 600    |
| Body                     | 14 / 22 sans 400    |
| Small body / captions    | 13 / 20 sans 400    |
| Eyebrow                  | 11 / 14 sans 600 caps |
| Score number (big)       | 32 / 32 serif 400   |
| Score detail number      | 24 / 28 sans 600    |

## Left rail

1. **Brand** — `Vlaams Studio` 18px sans 600. No logo.
2. **NIVEAU eyebrow** + four stacked level cards (A1–B2):
   - Resting: white card, hairline border, level letter on first line (sans 600 16px), label on second line (sans 400 13px `--ink-muted`).
   - Selected: solid `--green`, white text, white circle with green check on right edge.
3. **VANDAAG eyebrow**, then a streak block:
   - Big sans `7` (32 px 600) + lockup `dagen op rij` (13px `--ink-muted`).
   - Flame glyph in `--amber` to the right.
   - Below it a row of weekday dots — letters `M D W D V Z Z` (Dutch shorthand, dimmed) over filled `--green` dots for completed days; the rest are `--line` outlines.
4. **VOORTGANG <level> eyebrow**:
   - `64%` big sans 600 (28 px), caption `van niveau voltooid` underneath.
   - Slim 4 px progress bar in `--green` on `--line`.
5. **Profile** at the bottom: round avatar tile with initials, name + `Bekijk profiel` link. Below it `Instellingen` and `Uitloggen` rows with lucide icons (`Settings`, `LogOut`), 13 px text, full-row hover.

The whole rail is sticky on tall screens; nothing scrolls horizontally.

## Studio (center column)

Top status row, then the scenario block, then the practice arena, then the score panels.

### Status row
- Left: small green dot + `VERBONDEN` (sans 600 12 px caps).
- Adjacent pill: waveform glyph + `GPT Realtime 2` (sans 500 13 px, white pill with hairline).

### Scenario header
- `HUIDIG SCENARIO` eyebrow.
- Serif headline (e.g., `At the bakery in Antwerp`). Title stays in English when the source material is English; UI chrome around it is Dutch.
- 1–2 line description in 14 px `--ink-soft`.

### Scenario tiles
- 4 tiles in a row (auto-fit grid, min 168 px).
- Each tile: 132 px tall, 16 px radius, hairline border. Top-left small `ACTIEF` pill on the active tile. Centered icon (lucide) + bottom-aligned title (sans 600 15 px) + duration caption (`8–10 min`, 13 px `--ink-muted`).
- Active tile: solid `--green`, white type, `ACTIEF` pill is white-on-green darker.
- Hover: border → `--green`, slight lift.

### Practice arena
- Centered `Ik luister...` (15 px `--ink-soft`) above an animated 60-bar waveform in `--green`. Waveform animates only while `status === "live"`.
- Below: three controls in a row.
  - Left: ghost circular pause button (`II`).
  - Center: solid `--green` mic button, 88 px diameter, soft green outer halo. Caption `Houd ingedrukt om te praten` 12 px `--ink-muted`.
  - Right: ghost circular stop button (`■`).
- Stretch line beneath: two stacked transcript bubbles inside a single rounded card.
  - Row label on the left (`Jij zei`, `Verbeterd`) in 13 px `--ink-muted` (vertical-aligned center).
  - Sentence on the right in 14 px `--ink`. Highlighted corrections in `--green` with `<mark>`-style underline + bold.
  - Verbeterd row gets a green check chip on the right and a chevron toggle for the explanation note.

### Score block
- Eyebrow `SESSIESCORE`.
- Big serif `78 / 100` left, slim 6 px multi-color bar (red→amber→green gradient stops), and an arrow + `GOED BEZIG` pill on the right.
- Three sub-score cards underneath in equal columns:
  - Eyebrow + numeric `<score> / 100` (24 px sans 600 — color follows score: <60 amber, <80 ink, ≥80 green).
  - One-line tip in `--ink-soft`.
  - `Details` ghost button.

## Right rail

1. **LESMATERIAAL** eyebrow.
2. File card: PDF icon, filename (sans 500 14 px), meta line `PDF · 420 KB` (12 px muted). Solid green disc with white check on the right when this material is the one in use.
3. `Materiaal vervangen` ghost button (with rotate-CCW icon, full width).
4. Row toggle: `Gebruik dit materiaal in sessie` + `--green` switch.
5. **ACTIEF LESONDERWERP** eyebrow → `Eten en drinken / Bakkerswinkel` (sans 600 15 px) + `A2 — Dagelijks leven` (13 px muted) + `Aanpassen` ghost button.
6. **WOORDENSCHATDOELEN** eyebrow → wrap of pill chips (white, hairline border). Active goal pill gets `--green-tint` background.
7. **GRAMMATICAFOCUS** eyebrow → vertical list rows with chevron. Hover highlights row.
8. **DOCENTNOTITIES** eyebrow → italic teacher note (Crimson italic stand-in via `font-style: italic` on the serif). Below it small caption `Laatst bewerkt door Sofie V.` left, `Vandaag, 09:15` right.

## States

- **Idle** (no session): mic button is `--green` solid, waveform bars at low opacity, transcript shows last completed turns or seed copy.
- **Connecting**: status pill turns amber `VERBINDING…`, mic button shows spinner, controls disabled.
- **Live**: status pill green `VERBONDEN`, waveform animated, mic button caption changes to `Aan het opnemen…` in `--green`.
- **Mic blocked / missing key / error**: replace the practice arena heading with a single warning row — amber border + amber text — keeping the mic button visible but disabled.

## Motion

- Tile press: `scale(0.98)` 120 ms ease-out.
- Mic button hold: scale up 1.04 + halo grows from 8 px to 14 px.
- Waveform: each bar interpolates between two random heights every 220 ms, staggered 12 ms.
- Switch / chip selection: 160 ms ease.

Avoid bouncy springs. Everything is calm.

## Copy & tone

- UI chrome is Dutch / Vlaams (e.g. `Pauze`, `Gesprek beëindigen`, `Houd ingedrukt om te praten`).
- Source content (scenario titles like `At the bakery in Antwerp`) stays in the language the user uploaded.
- Numerics use a thin space before the slash (`78 / 100`) — render with `&thinsp;` or ` `.

## Don'ts

- No drop-shadows beyond `0 8px 24px rgba(31,36,32,0.08)` (cards) or `0 12px 28px rgba(47,111,87,0.18)` (active green tile).
- No emojis anywhere. Icons only.
- No gradients except the score bar.
- No rounded-full buttons except the mic, the avatar, and the calendar dots.
- No system fonts as fallback for the serif headline — load Instrument Serif before paint.

## Premium-AI tropes we lean on (2026)

These are the small details that separate "looks like a clone" from "looks like Linear/Granola":

- **Serif display + sans body** — Instrument Serif on the scenario headline and the big sessiescore number, Geist everywhere else. Tight tracking on the serif (`tracking-tight` ≈ -1px at 40px).
- **Tinted page, inset cards** — page is `--ivory` (#f4f1ea); cards are pure white with a hairline border and almost no shadow. The inverse of the old "white page, gray card" school.
- **Eyebrow caps** — every section starts with a tiny uppercase tracked label (`text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8a8e87]`). Linear and Mercury lean on this hard.
- **Tabular numerals** — every visible number (streak `7`, progress `64%`, scores `78/72/81/67`) uses `font-variant-numeric: tabular-nums`. Apply via the `.tabular` utility in `globals.css`. Single biggest "polish vs amateur" tell.
- **Color-tinted shadows** — instead of black at 10%, active green surfaces use `rgba(47,111,87,0.18–0.28)` so the accent gently blooms. See the active level button, the active scenario tile, and the mic button.
- **Gaussian-envelope waveform** — bars taper toward the edges (`exp(-((i-center)^2) / (2*sigma^2))` height multiplier), middle bars are tallest. Smoothed amplitude (`prev * 0.55 + target * 0.45`). Idle uses a slow sine ripple instead of going flat.
- **Pill chips with leading dot** — the `VERBONDEN` chip is just a 2 px dot + small caps text. Nothing else. Status is communicated through dot color (green/amber).
- **Lucide at 1.5–1.6 stroke** — scenario tile icons at `strokeWidth={1.5}`, rail row icons at `1.6`. The default 2 reads heavy on the rest of the type.
- **Underline-as-highlight** — the corrected word in the transcript uses `underline decoration-[#2f6f57]/40 decoration-1 underline-offset-4` instead of a `<mark>` background. Cleaner editorial feel.
- **Dot-grid utility** is available (`.dot-grid` class) for future surfaces that need texture without being loud. Not applied to the studio screen — the reference keeps the page flat.

When in doubt, copy these from elsewhere on the page first; only invent new patterns when the existing palette can't say what you need.

## Reference repos worth raiding

- [marvkr/better-design](https://github.com/marvkr/better-design) — 31 themed shadcn design systems. Pillow Light / Tactile Minimal / Editorial Dark are the closest tonal matches.
- [ElevenLabs UI](https://ui.elevenlabs.io/) — voice-AI specific shadcn primitives (LiveWaveform, BarVisualizer, VoiceButton). Crib their state machine for the waveform if we ever wire real FFT data.
- [Origin UI](https://originui.com/) — denser editorial primitives (timelines, refined dialogs, advanced inputs).
- [Magic UI](https://magicui.design/) — animated flourishes (number tickers, animated borders, dot patterns). Use sparingly.
- [tweakcn](https://tweakcn.com/) — visual editor for nailing CSS-var palettes.

## How to verify

After any UI change to `src/components/vlaams-studio-app.tsx` or shared tokens:

1. Run `pnpm dev` and open the home page.
2. Compare visually against the reference screenshot side by side.
3. Spot-check the four highest-risk areas: left-rail level cards (selected state), the active scenario tile, the mic + waveform area, and the right-rail eyebrow→content rhythm.
4. If any of those four drift, fix them before shipping.

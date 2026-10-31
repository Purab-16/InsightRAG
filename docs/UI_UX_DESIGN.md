# InsightRAG — UI/UX Design

**Version:** 1.1 (security added) · **Date:** 2026-10-31 · **Related:** `APP_FLOW.md`, `PRD.md`

---

## 1. Design principles

1. **Trust through sources.** Every answer shows where it came from; citations are one click away. Sources are the hero, not decoration.
2. **Zero friction start.** No login wall, no onboarding. The first screen is useful immediately.
3. **Calm, academic, readable.** Generous whitespace, comfortable line length (≤ 75 characters for prose), clear type hierarchy. Feels like a reading tool, not a chatbot toy.
4. **Status is always visible.** Processing, ready, failed and rate-limit states are never silent.
5. **Build fast with shadcn/ui.** Use its components as-is; customize only tokens.

## 2. Design system

### 2.1 Colour tokens (CSS variables, light + dark)

| Token | Light | Dark | Use |
|---|---|---|---|
| `--background` | `#FAFAF9` | `#0C0C0E` | Page |
| `--surface` | `#FFFFFF` | `#16161A` | Cards, panels |
| `--border` | `#E7E5E4` | `#2A2A30` | Borders, dividers |
| `--text` | `#1C1917` | `#EDEDEF` | Primary text |
| `--text-muted` | `#78716C` | `#A1A1AA` | Secondary text, metadata |
| `--primary` | `#4F46E5` (indigo) | `#818CF8` | Buttons, links, active tab, center graph node |
| `--primary-soft` | `#EEF2FF` | `#1E1B4B` | Citation chip background, selected rows |
| `--success` | `#16A34A` | `#4ADE80` | Ready badge |
| `--warning` | `#D97706` | `#FBBF24` | Processing badge |
| `--danger` | `#DC2626` | `#F87171` | Failed badge, errors |
| `--graph-ref` | `#0EA5E9` | `#38BDF8` | Reference nodes |
| `--graph-cite` | `#A855F7` | `#C084FC` | Citation nodes |

Map these to shadcn's theme variables. Support dark mode via `class` strategy and `prefers-color-scheme` default.

### 2.2 Typography
- UI font: **Inter** (Google Fonts). Reading font for answers and insights: **Inter** at 16 px / 1.65 line height (optionally **Source Serif 4** for paper titles).
- Mono: **JetBrains Mono** for arXiv IDs.

| Style | Size / weight | Use |
|---|---|---|
| H1 | 28 / 600 | Page titles |
| H2 | 20 / 600 | Paper title on paper page, section titles |
| H3 | 16 / 600 | Card titles |
| Body | 15–16 / 400 | Text |
| Small | 13 / 400 | Metadata, captions, badges |

### 2.3 Spacing, radius, elevation
- 4 px base grid; common spacings 8, 12, 16, 24, 32.
- Radius: 8 px (cards, inputs), 999 px (chips, badges).
- Shadows: only `shadow-sm` on cards and popovers; borders do most of the separation.

### 2.4 Icons
lucide-react (shipped with shadcn). Key icons: `Search`, `Upload`, `FileText`, `MessageSquare`, `GitCompare`, `Network`, `Download`, `Loader2`, `CheckCircle2`, `AlertCircle`, `RotateCw`, `X`.

## 3. Layout

### Desktop (≥ 1024 px)
```
┌──────────────────────────────────────────────────────────────────┐
│ ◆ InsightRAG    Library   Chats   Compare            [Guest ▾]   │  header 56px
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                 content (max-width 1200px, centered)             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```
### Mobile (< 768 px)
- Header collapses nav into a menu sheet.
- Two-panel screens (paper chat, multi-paper chat) become single column; the paper list / source drawer opens as a bottom sheet.

## 4. Screens

### 4.1 Library — `/`
```
┌──────────────────────────────────────────────────────────────────┐
│  Your research library                                           │
│  ┌──────────────────────────────────────────────┐ ┌───────────┐  │
│  │ 🔍 Search arXiv (e.g. "diffusion models")    │ │ Upload PDF│  │
│  └──────────────────────────────────────────────┘ └───────────┘  │
│  or add by arXiv ID: [ 2310.06825            ] [Add]             │
│                                                                  │
│  ── Search results (when searching) ──────────────────────────── │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Title of paper                                    [ Add ]  │  │
│  │ A. Author, B. Author · 2023 · cs.LG                        │  │
│  │ Abstract preview, two lines max…                           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ── My papers (4) ──────────── [☐ select] [Chat with selected]   │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐              │
│  │ ☐            │ │ ☐            │ │ ☐            │              │
│  │ Paper title  │ │ Paper title  │ │ Paper title  │              │
│  │ Authors·2023 │ │ Authors·2024 │ │ upload.pdf   │              │
│  │ ● Ready      │ │ ◌ Processing │ │ ✕ Failed ↻   │              │
│  └──────────────┘ └──────────────┘ └──────────────┘              │
└──────────────────────────────────────────────────────────────────┘
```
- Grid: 3 columns desktop, 2 tablet, 1 mobile.
- Selection mode: checkboxes appear; sticky bottom bar "N selected · Chat · Compare (2–3)".
- Empty state: illustration-free card "Start with a paper" + 3 **Try these** example cards + focused search bar.

### 4.2 Paper page — `/paper/[id]`
```
┌──────────────────────────────────────────────────────────────────┐
│ ← Library                                                        │
│ Paper Title in Serif                                [Export ▾]   │
│ A. Author, B. Author · 2023 · arXiv:2310.06825 ↗                 │
│ [ Insights ] [ Chat ] [ Citation graph ]                         │
├──────────────────────────────────────────────────────────────────┤
│ INSIGHTS TAB                                                     │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ TL;DR  Two plain-language sentences…                         │ │
│ └──────────────────────────────────────────────────────────────┘ │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐            │
│ │ Problem       │ │ Method        │ │ Key results   │            │
│ └───────────────┘ └───────────────┘ └───────────────┘            │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐            │
│ │ Datasets      │ │ Metrics       │ │ Limitations   │            │
│ └───────────────┘ └───────────────┘ └───────────────┘            │
│ Contributions · Field: NLP                                       │
└──────────────────────────────────────────────────────────────────┘
```
- Datasets and Metrics render as chips; lists as bullets.

**Chat tab**
```
┌───────────────────────────────────────────────┬──────────────────┐
│ (empty) Suggested:                            │ SOURCE  [1]   ✕  │
│  [Summarize the main idea]                    │ Paper title      │
│  [What datasets and metrics are used?]        │ Experiments · p.6│
│  [What are the limitations?]                  │ "…snippet text…" │
│                                               │ Open PDF at p.6 ↗│
│ You: What are the limitations?                │                  │
│ InsightRAG: The authors note that … [1][3]    │                  │
│                                               │                  │
│ ┌───────────────────────────────────┐ [Send]  │                  │
│ │ Ask about this paper…             │         │                  │
│ └───────────────────────────────────┘         │                  │
└───────────────────────────────────────────────┴──────────────────┘
```
- Source drawer: right side panel on desktop (320 px), bottom sheet on mobile.
- Citation chips: small rounded `[1]` in `--primary-soft`; hover shows a tooltip with "Section · p.X".

**Citation graph tab**
```
  references (left)          center              citations (right)
  ○ Ref A 2019 ─────┐                         ┌────▶ ○ Cite X 2024
  ○ Ref B 2020 ─────┼────▶  ● THIS PAPER  ────┤
  ○ Ref C 2021 ─────┘                         └────▶ ○ Cite Y 2025
```
- dagre layout, direction LR. Edges follow influence (cited → citing): reference → center → citation, so dagre naturally places references left and citations right.
- Node: rounded rect, title truncated to 40 chars + year; size scales with `log(citation_count)` (min 140 px, max 220 px wide).
- Colours: center `--primary`, references `--graph-ref`, citations `--graph-cite`.
- Controls: zoom, fit view, filter toggle (References / Citations / Both), legend.
- Click → right panel with details, "Open on Semantic Scholar ↗", "Add to library" (if arXiv ID).

### 4.3 Multi-paper chat — `/chat/[sessionId]`
```
┌────────────────────┬─────────────────────────────────────────────┐
│ Papers in this chat│ Chat title                    [Export .md]  │
│ ■ Paper A          │                                             │
│ ■ Paper B          │ You: How do their methods differ?           │
│ ■ Paper C          │ InsightRAG: Paper A uses … [1], while       │
│                    │ Paper B … [4]. Paper C …                    │
│                    │                                             │
│                    │ [ Ask across these papers…        ] [Send]  │
└────────────────────┴─────────────────────────────────────────────┘
```
- Each paper gets a stable colour square (from a 5-colour palette); its citation chips use that colour as a left border so users see which paper a source comes from.

### 4.4 Chats list — `/chats`
- Simple list: title, paper count, "x papers · 2h ago"; "New chat" button opens a paper picker dialog.

### 4.5 Compare — `/compare`
```
┌──────────────────────────────────────────────────────────────────┐
│ Compare papers   [ + Select papers (2–3) ]     [Chat about these]│
├──────────────┬───────────────────┬───────────────┬───────────────┤
│              │ Paper A           │ Paper B       │ Paper C       │
├──────────────┼───────────────────┼───────────────┼───────────────┤
│ TL;DR        │ …                 │ …             │ …             │
│ Problem      │ …                 │ …             │ …             │
│ Method       │ …                 │ …             │ …             │
│ Datasets     │ chips             │ chips         │ chips         │
│ Metrics      │ chips             │ chips         │ chips         │
│ Key results  │ • …               │ • …           │ • …           │
│ Limitations  │ • …               │ • …           │ • …           │
│ Contributions│ • …               │ • …           │ • …           │
└──────────────┴───────────────────┴───────────────┴───────────────┘
```
- First column sticky; table scrolls horizontally on mobile.
- Paper header cells link to the paper page.

## 5. Component inventory

| Component | Based on (shadcn) | Notes |
|---|---|---|
| `AppHeader` | NavigationMenu, DropdownMenu | Account chip (Guest / user) |
| `ArxivSearch` | Input, Card, Button | Debounced; results list with Add / In library |
| `AddByIdInput` | Input, Button | Client validation of ID/URL |
| `UploadDropzone` | (custom) + Progress | Drag-and-drop, 20 MB limit |
| `PaperCard` | Card, Checkbox, Badge | Click → paper page if ready |
| `StatusBadge` | Badge | Ready / Processing (spinner) / Failed (tooltip + retry) |
| `InsightsPanel` | Card | TL;DR + field cards |
| `ChatPanel` | ScrollArea, Textarea, Button | Auto-scroll, Enter to send, Shift+Enter newline |
| `MessageBubble` | (custom) | Markdown + KaTeX; converts `[n]` to `SourceChip` |
| `SourceChip` | Badge, Tooltip | Paper colour border in multi-paper chat |
| `SourceDrawer` | Sheet | Right on desktop, bottom on mobile |
| `PaperSelector` | Dialog, Command, Checkbox | Min/max selection rules |
| `CompareTable` | Table | Sticky first column |
| `CitationGraph` | React Flow | dagre LR, custom node, legend, filter |
| `ExportButton` | DropdownMenu | Triggers file download |
| `EmptyState` | Card | Icon + title + one line + action |
| `Toaster` | Sonner | Success, error, rate-limit messages |
| `TurnstileGate` | (custom, `@marsidev/react-turnstile`) | Invisible on first visit; renders a challenge only if needed |
| `UsageMeter` | (custom) small text | "4 of 5 papers left today" / "25 of 30 messages left today" |
| `LimitBanner` | Alert | Daily limit reached + local reset time |

## 6. States and microcopy

| State | Where | Copy |
|---|---|---|
| Empty library | Library | "Your library is empty. Search arXiv or try one of these papers." |
| Processing | Paper card | "Processing… usually under a minute" |
| Failed | Paper card | "Couldn't process this paper: {reason}" + Retry |
| Paper ready | Toast | "'{short title}' is ready" |
| Thinking | Chat | "Reading the papers…" (animated dots) |
| Not in paper | Answer | The model says so; no special UI |
| Rate limited | Chat / toast | "We're at the free-tier limit. Try again in a minute." |
| Cold start | Global (after 5 s) | "Waking up the server — this can take up to a minute on the free plan." |
| No graph data | Graph tab | "No citation data found for this paper." |
| No insights | Insights / compare | "Insights couldn't be generated for this paper. Chat still works." |
| Invalid ID | Add by ID | "Enter a valid arXiv ID (e.g. 2310.06825) or link." |
| File too large | Upload | "PDF must be 20 MB or smaller." |
| Too many pages | Paper card (failed) | "This PDF has more than 100 pages. Try the arXiv version or a shorter file." |
| Unreadable PDF | Paper card (failed) | "We couldn't read this PDF. It may be scanned, damaged or protected." |
| Daily paper limit | Library banner | "You've added 5 papers today. You can add more after {local time}." |
| Daily message limit | Chat banner | "You've used today's 30 messages. Chat resets at {local time}." |
| Global AI budget reached | Library / chat banner | "The free AI quota for today is used up. Try again after {local time}." |
| Burst limit | Toast | "Slow down a little — try again in {n} seconds." |
| Session check | First visit (only if challenged) | "Quick check to keep the free service fair for everyone." |

Loading: use skeletons for cards, insights and tables (not spinners) — spinners only inside buttons and status badges.

## 7. Interaction details

- **Keyboard:** `/` focuses search; `Enter` sends a message; `Esc` closes drawers/dialogs.
- **Optimistic UI:** user message appears immediately; failed send shows "Retry" on that bubble.
- **Auto-scroll:** chat scrolls to bottom on new message unless the user has scrolled up.
- **Polling:** stop when tab hidden; resume on focus.
- **Open PDF at page:** link to arXiv PDF URL with `#page=X` (works in most browser PDF viewers).

## 8. Accessibility (WCAG 2.1 AA targets)

- Text contrast ≥ 4.5:1 (check muted text and chips in both themes).
- All interactive elements reachable by keyboard with visible focus rings (shadcn default).
- Status badges include text, not colour only.
- Turnstile challenge (when shown) is keyboard accessible; keep its container labelled.
- Citation chips have `aria-label="Source 1: Experiments, page 6"`.
- Graph: provide a "View as list" toggle that shows references and citations as an accessible list.
- Respect `prefers-reduced-motion` (disable graph animations and typing dots).
- Touch targets ≥ 40 × 40 px on mobile.

## 9. Security-related UI rules

- Render answers and paper text only through `react-markdown` (+ math plugins); never use `dangerouslySetInnerHTML` or `rehype-raw`.
- External links (arXiv, Semantic Scholar, links inside answers) open in a new tab with `rel="noopener noreferrer"`.
- Never show raw server error stacks; show the `message` from the error body.
- Upload hint under the dropzone: "PDF only · up to 20 MB · up to 100 pages · visible only to you".
- Privacy note in footer: "Papers you upload are private to you. Don't upload unpublished drafts — free-tier AI providers may use inputs to improve their models."

## 10. README visuals (portfolio)

- Hero screenshot: paper page with chat + open source drawer.
- GIF: add paper → processing → ready → ask → click citation.
- Screenshot: compare table and citation graph.
- Architecture diagram (from `TRD.md`).

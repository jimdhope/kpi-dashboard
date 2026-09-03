# KPI Quest — Post Generator Feature: Implementation Plan (v2)

## 1. Overview

Generate celebratory weekly posts inside KPI Quest for Viva Engage and Microsoft Teams. Two editable markdown template sets (VE + Teams), five fixed sections each with a word count target, TipTap editors with an insert toolbar for data tokens, and a generator page that picks competitions, fills the tokens, calls OpenRouter, and returns editable output.

---

## 2. Scope

**In scope:**
- Settings page: API key (OpenRouter) + two template sets (VE + Teams) with section editors
- Competitions menu item: Post Generator page — select competitions, theme, generate
- Backend: OpenRouter call, token resolution, AppSetting storage
- Permissions: new permission key for the feature

**Out of scope:**
- Auto-posting to Viva Engage or Teams (copy-paste only)
- Certificate generation (already exists, downloaded separately)
- Score table rendering (screenshot from dashboard)
- Hermes integration
- Weekly cron scheduling (manual generation for now)

---

## 3. Data model

No new Prisma models. Reuse `AppSetting` (key + Json value).

| Key | Value shape | Purpose |
|---|---|---|
| `postGenerator.openrouterApiKey` | `{ apiKey: *** }` | OpenRouter API key |
| `postGenerator.veTemplate` | `{ sections: Section[] }` | Viva Engage template |
| `postGenerator.teamsTemplate` | `{ sections: Section[] }` | Teams template |

**Section shape:**
```ts
interface Section {
  name: string;        // e.g. "Introduction"
  wordCount: number;   // single target, e.g. 80
  content: string;     // TipTap JSON string (ProseMirror JSON)
  enabled: boolean;    // toggle on/off in the five-section list
}
```

Five fixed section names (not user-renamable for v1):
1. `introduction`
2. `scoresAndWinners`
3. `newThemeAndTeams`
4. `pepTalk`
5. `conclusion`

The `enabled` flag lets you hide sections without deleting them. Section order is fixed (the five in that order). Word count is a single number target per section, passed to the LLM as guidance.

Default templates get created on first access if no settings exist — sensible defaults so the feature isn't blank the first time.

---

## 4. Backend — Services layer

### 4.1 AppSetting service extension

Add to a new `src/server/services/post-generator-service.ts` (preferred — keeps logic isolated rather than crowding `app-setting-service.ts`):

- `getPostGeneratorSettings()` — reads all three AppSetting rows, returns `{ apiKey, veTemplate, teamsTemplate }` with typed defaults
- `savePostGeneratorApiKey(apiKey: string)` — upserts the key row
- `saveTemplate(type: 've' | 'teams', sections: Section[])` — upserts the template row

Typed default sections (so the UI never sees null):

```ts
const DEFAULT_SECTIONS: Section[] = [
  { name: 'Introduction', wordCount: 80, content: '', enabled: true },
  { name: 'Scores & Winners', wordCount: 100, content: '', enabled: true },
  { name: 'New Theme & Teams', wordCount: 80, content: '', enabled: true },
  { name: 'Pep Talk & Teamwork', wordCount: 80, content: '', enabled: true },
  { name: 'Conclusion', wordCount: 40, content: '', enabled: true },
];
```

### 4.2 Token resolution service

A pure function that takes a competition + next-week competition + theme + post type and returns a flat token map:

```ts
type TokenMap = Record<string, string>;

function resolveTokens(
  thisWeekCompetition: Competition,
  nextWeekCompetition: Competition | null,
  theme: string,
  postType: 'Viva Engage' | 'Teams',
  winners: WinnerData,
  topPerformers: TopPerformer[],
  totalCompetitors: number,
): TokenMap
```

**Tokens available** (every token maps to a string; empty string if data unavailable):

| Token | Source |
|---|---|
| `{competitionName}` | this week's competition name |
| `{competitionDescription}` | this week's competition description (or empty) |
| `{competitionDuration}` | e.g. "September 1–7, 2026" derived from startsAt/endsAt |
| `{totalCompetitors}` | entry count |
| `{winningTeamName}` | top-ranked team name |
| `{winningTeamMembers}` | team members as a bulleted list (names) |
| `{winningTeamScore}` | team final score |
| `{topPerformer1Name}` / `{topPerformer1Score}` | 1st place |
| `{topPerformer2Name}` / `{topPerformer2Score}` | 2nd place |
| `{topPerformer3Name}` / `{topPerformer3Score}` | 3rd place |
| `{nextWeekCompetitionName}` | next week's competition name (or empty) |
| `{nextWeekTheme}` | the theme string entered at generation time |
| `{postType}` | "Viva Engage" or "Teams" |

**Competition data fetching** uses existing services/endpoints:
- Basic competition: `competitionService.getSummaries()` for the list, then fetch the selected competition's entries + teams + entries with user names (similar to the standings route)
- BYB: `beatYourBestService` — PB breakers + top improver. Map to the winner/top-performer token shape
- League: `divisionTitleService` + division standings — most recent title holders + top 3 by points. Map to the same token shape

The token resolver doesn't care which feature type it came from — it just consumes the resolved winner/top-performer data.

**Standings reuse:** Use `scoreEventProjectionService.getCompetitionStandings()` (the same service the standings and BYB pages use) rather than reimplementing aggregation. This ensures the generator uses the corrected score-event data (post-dedup fix) and doesn't drift.

### 4.3 TipTap JSON → text serialization

Before token replacement and prompt assembly, the stored TipTap JSON content must be converted to plain text/markdown. Use `@tiptap/markdown` or a custom serializer:

```ts
import { generateMarkdown } from '@tiptap/markdown'; // or equivalent

function sectionContentToMarkdown(tipTapJson: string): string {
  // Parse ProseMirror JSON → markdown/plain text
  // This runs at generation time, not storage time
}
```

This is a critical step — without it, you'd send ProseMirror JSON blobs to the LLM.

### 4.4 OpenRouter service

A small server-only module:

```ts
// src/server/services/openrouter-service.ts
async function generatePost(prompt: string, apiKey: string): Promise<string>
```

**API call:**
```bash
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{
    "model": "openrouter/free",
    "messages": [
      { "role": "system", "content": "<system prompt>" },
      { "role": "user", "content": "<assembled prompt>" }
    ],
    "reasoning": { "enabled": true }
  }'
```

- **Model:** `openrouter/free` — the free router that routes to available models. No specific model pinned; the API key's tier determines routing.
- **System prompt:** "You are a celebratory post writer for a workplace competition platform..."
- **User prompt:** assembled from the template sections + word count guidance + filled tokens
- **Returns:** raw markdown text for one platform

**Two LLM calls — run in parallel:**
```ts
const [vePost, teamsPost] = await Promise.all([
  generatePost(vePrompt, apiKey),
  generatePost(teamsPrompt, apiKey),
]);
```
Each gets its own template + the same token map. Cleaner output, simpler parsing, half the latency. Slightly more API cost but post generation is infrequent (a few times per week).

**Error handling:**
- API key invalid → descriptive error
- Rate limited → retry once after a short delay, then fail with message
- Network error → fail with message
- Empty/short response → return as-is (the UI editor lets the user fix it)

### 4.5 Generator Route Handler

`POST /api/competitions/post-generator/generate`

Request body:
```ts
{
  type: 'basic' | 'byb' | 'league',
  thisWeekCompetitionId: string,
  nextWeekCompetitionId: string | null,
  theme: string,
}
```

Flow:
1. Auth check (`requireResourceAccess("nav.competitions.postGenerator", "VIEW")`)
2. Fetch this week's competition + next week's competition (if provided)
3. Resolve winner/top-performer data based on `type` (reuse existing standings services)
4. Read templates from AppSetting
5. For each enabled section in each template:
   - Convert TipTap JSON → markdown (Section 4.3)
   - Replace tokens in the content
   - Build the section prompt with word count guidance
6. Assemble the full prompt per platform (VE template → VE prompt, Teams template → Teams prompt)
7. Call OpenRouter in parallel (read API key from AppSetting)
8. Return `{ vivaEngagePost: string, teamsPost: string }`

Response:
```ts
{
  vivaEngagePost: string,  // markdown text, empty if type is byb/league
  teamsPost: string,
}
```

For BYB and league: `vivaEngagePost` is empty string (consistent UI handling).

**Permission checks:**
- `GET /api/competitions/post-generator/settings` (read templates/key): **VIEW**
- `POST /api/competitions/post-generator/settings/*` (save key/template): **MANAGE**
- `POST /api/competitions/post-generator/generate`: **VIEW**

---

## 5. Settings UI

### 5.1 Settings navigation

Add to `src/components/settings/settings-navigation.ts`:

```ts
setting("post-generator", "Post Generator", "OpenRouter API key and post templates", "/settings/post-generator", Sparkles, "nav.competitions.postGenerator", "MANAGE")
```

Under the General group (or its own group — under General is fine since it's configuration). Permission key `nav.competitions.postGenerator` with `MANAGE` level — only people who can manage competitions should edit templates and the API key.

Add to `PERMISSION_SECTIONS` in `permission-catalog.ts`:
```ts
{ key: "nav.competitions.postGenerator", label: "Post Generator", description: "Generate weekly competition posts with AI" }
```

### 5.2 Settings page: `src/app/(app)/settings/post-generator/page.tsx`

Two sections on one page:

**Section A — OpenRouter API key**
- Password-input field (masked)
- Save button
- Test button (lightweight call to OpenRouter that confirms the key works — e.g. a minimal chat completion that returns immediately). Shows success/failure toast.
- Key stored in AppSetting, read on page load

**Section B — Template editor (two tabs: Viva Engage / Teams)**
- Tab switcher for the two template sets
- For each of the five sections, in order:
  - Section name (read-only label)
  - Word count input (number, 1–500)
  - Enable/disable toggle (checkbox or switch)
  - TipTap markdown editor with insert toolbar
- Save all button (saves both templates + any dirty section)

**Insert toolbar (inside each TipTap editor):**
Buttons that insert tokens at the cursor:
- Competition Name, Description, Duration, Total Competitors
- Winning Team Name, Members, Score
- 1st/2nd/3rd Place (name + score)
- Next Week's Competition, Next Week's Theme
- Post Type

Tokens render as plain text in the editor so they're visible and editable. The toolbar is a small horizontal strip above each editor — similar in spirit to the existing `TiptapToolbar` but with token-insert buttons instead of formatting buttons. You can keep the formatting toolbar too — both coexist.

**TipTap content storage:** Same pattern as the KB editor — store as JSON string in AppSetting. The editor component handles JSON ↔ editor content.

### 5.3 Component structure

- `src/components/post-generator/template-editor.tsx` — the two-tab template editor with section list + per-section TipTap + insert toolbar
- `src/components/post-generator/token-toolbar.tsx` — the insert token buttons, reusable across editors
- `src/components/post-generator/api-key-section.tsx` — API key input + test/save

---

## 6. Generator page UI

### 6.1 Competitions menu item

In `app-navbar.tsx`, add to the Competitions dropdown:
```ts
{ label: 'Post Generator', href: '/competitions/post-generator', icon: Megaphone, permissionKey: 'nav.competitions.postGenerator' }
```

Use `Megaphone` or `MessageSquare` icon (something post/message related). Permission key: `nav.competitions.postGenerator` (consistent with settings).

### 6.2 Page: `src/app/(app)/competitions/post-generator/page.tsx`

Flow on the page:

1. **Type selector** — three options: Basic Competition | Beat Your Best | League Table (tabs or segmented control)
2. **This week's competition dropdown** — populated based on type:
   - Basic: dropdown of completed (or recently completed) competitions from `GET /api/competitions` or the summaries endpoint
   - BYB: no dropdown needed — it's the current BYB period (auto-resolved)
   - League: dropdown of active leagues
3. **Next week's competition dropdown** — searchable dropdown of competitions (all, not just completed). Optional — can be empty if no next competition set yet. Label explains it's used for the theme/team intro section.
4. **Next week's theme** — text input (required for generation)
5. **Generate button** — calls `POST /api/competitions/post-generator/generate`
6. **Loading state** during generation (the OpenRouter call can take a few seconds)
7. **Output** — two TipTap editors (read-only or lightly editable) showing the generated posts:
   - Viva Engage post (hidden/disabled when type is BYB or league)
   - Teams post
   - Copy buttons on each
   - Regenerate button (if you want to re-roll the same inputs)

**Competition dropdowns — search/selection:**
The existing competition dropdown in `page.tsx` (the admin dashboard) uses a `Select` component. For this page, you want a searchable dropdown since there could be many competitions. The existing `creatable-combobox` component in the UI library might fit, or a `Select` with a search input that filters the list client-side. Start with a `Select` + client-side filter if the list is short, upgrade to a searchable combobox if needed.

**Competition data for dropdowns:**
- Basic: `GET /api/competitions?includeDrafts=false` — already returns completed + ongoing. Filter to completed for the "this week" dropdown.
- Next week: same endpoint, all competitions (draft or not). The user said they set up next week's competition before writing posts, so it exists in the system.
- League: `GET /api/divisions/leagues` — active leagues.

**BYB handling:** No competition dropdown — BYB is a single current period. The generator resolves it from the BYB service. The "this week" field is hidden/disabled for BYB type. The `{competitionName}` and `{competitionDuration}` tokens come from the current BYB period metadata (not a Competition row).

---

## 7. Permissions

| Resource key | Label | Default level |
|---|---|---|
| `nav.competitions.postGenerator` | Post Generator | MANAGE |

Add to `PERMISSION_SECTIONS` under `nav.competitions`.

Role defaults (in `permission-service.ts` seed/default permissions): assign `MANAGE` to `admin`, `campaignManager`, `podManager`, `teamLeader`, `competitionRunner` — same as `nav.competitions.manage`. Or `VIEW` if you want a broader audience to generate posts but only MANAGE to edit templates. **Decision:** templates are edited in settings (MANAGE), generation is in the competitions menu — could be VIEW. But for v1, keep it simple: one permission key, MANAGE for both. Split later if needed.

The settings page requires MANAGE (editing API key + templates). The generator page — MANAGE for v1 too (same key). If you later want agents/competitionRunners to generate but not edit templates, split into two keys.

---

## 8. OpenRouter API details

**Endpoint:** `POST https://openrouter.ai/api/v1/chat/completions`

**Auth:** `Authorization: Bearer $OPENROUTER_API_KEY` header

**Request shape:**
```json
{
  "model": "openrouter/free",
  "messages": [
    { "role": "system", "content": "<system prompt>" },
    { "role": "user", "content": "<assembled prompt>" }
  ],
  "reasoning": { "enabled": true }
}
```

**Model selection:**
- `openrouter/free` — the free router that routes to available models. No specific model pinned; the API key's tier determines routing.
- The free tier gives access to a rotating set of models. The API call stays the same; the model selection is the variable.
- For v1, hardcode `openrouter/free` in the service; the user can change the API key to a different tier if they want.

**System prompt (shared):**
A short prompt establishing the role, tone (celebratory, professional, workplace-appropriate), and constraints (fill in tokens, respect word counts per section, don't invent data, keep it concise).

**Per-platform user prompt:**
Assembled from the template sections. For each enabled section, the prompt includes:
- The section name
- The word count target
- The section content with tokens replaced by actual values
- Instructions to write in that style/length

Example assembled prompt for the Introduction section:
```
## Introduction (~80 words)
Write an engaging introduction for the Viva Engage post about [Competition Name], which ran from [duration] with [totalCompetitors] competitors.

[rest of section content with tokens filled in]
```

The full prompt concatenates all enabled sections in order.

---

## 9. File manifest

### New files
- `src/server/services/post-generator-service.ts` — AppSetting read/write + token resolution + default templates
- `src/server/services/openrouter-service.ts` — the OpenRouter API call
- `src/app/api/competitions/post-generator/generate/route.ts` — the generator endpoint
- `src/app/api/competitions/post-generator/settings/route.ts` — settings read/write endpoints
- `src/app/(app)/settings/post-generator/page.tsx` — settings page
- `src/app/(app)/competitions/post-generator/page.tsx` — generator page
- `src/components/post-generator/template-editor.tsx` — two-tab template editor
- `src/components/post-generator/token-toolbar.tsx` — insert token buttons
- `src/components/post-generator/api-key-section.tsx` — API key input + test

### Modified files
- `src/lib/permission-catalog.ts` — add `nav.competitions.postGenerator`
- `src/components/settings/settings-navigation.ts` — add settings nav item
- `src/components/app-navbar.tsx` — add competitions menu item
- `src/app/(app)/settings/layout.tsx` — no change needed (existing layout handles auth)
- `src/app/(app)/competitions/page.tsx` — no change (new page is separate)

### No changes
- Prisma schema (no new models)
- Existing competition services (reuse, don't modify)
- Certificate pipeline
- Teams webhook / adaptive card pipeline

---

## 10. Implementation order

1. **Permissions + nav** — add permission key to catalog, settings nav item, competitions menu item (unblocks the pages)
2. **OpenRouter API verification** — manually test the API call with curl using a free-tier key and model `openrouter/free` to confirm the endpoint works. If it 404s again, investigate the correct endpoint/model before building the service.
3. **Post-generator service** — AppSetting read/write, token resolution, default templates, TipTap JSON → markdown serializer
4. **OpenRouter service** — the API call with parallel execution
5. **Generator route handler** — `POST /api/competitions/post-generator/generate`
6. **Settings route handler** — `GET/POST /api/competitions/post-generator/settings`
7. **Settings page** — API key section + template editor with insert toolbar
8. **Generator page** — competition dropdowns + theme + generate + output editors
9. **Validation** — typecheck, build, smoke-test the generate flow with a real competition

---

## 11. Edge cases & decisions

| Situation | Handling |
|---|---|
| No API key set | Settings page shows empty field; generator returns error "OpenRouter API key not configured" |
| No template saved | Default template used (empty sections with defaults) — user edits before generating |
| Competition has no teams | `{winningTeamName}` etc. are empty strings — LLM handles gracefully (template shouldn't require teams if it's an individual competition) |
| BYB type selected | No "this week" dropdown; VE post output hidden; generator pulls from BYB service; `{competitionName}` / `{competitionDuration}` come from current BYB period metadata |
| League type selected | League dropdown instead of competition dropdown; VE post hidden; tokens come from division title service |
| Next week competition not set | Dropdown can be empty/null; `{nextWeekCompetitionName}` token is empty string |
| OpenRouter rate limited | One retry after short delay, then error message in UI |
| OpenRouter returns garbage | Output editors are editable — user fixes before copy-pasting |
| Word count 0 or missing | Section skipped in prompt (or treated as no guidance) — defaults ensure it's always set |
| Tokens not in template | Left as literal text in output (visible to user, easy to spot) — easier to debug than silently stripping. The user will notice `{winningTeamName}` in the final post and know the token wasn't filled. |
| TipTap JSON → markdown | Serialize at generation time (not storage time) using `@tiptap/markdown` or equivalent. Without this, ProseMirror JSON blobs get sent to the LLM. |
| Standings data | Reuse `scoreEventProjectionService.getCompetitionStandings()` — don't reimplement aggregation. Ensures generator uses corrected score-event data (post-dedup fix). |

---

## 12. Validation checklist

Before handing off:
- `npm run typecheck`
- `npm run build`
- `npx prisma validate`
- OpenRouter API call verified with curl (model `openrouter/free`, reasoning enabled)
- Smoke test: set an API key in settings, save a basic template with at least the Introduction section, pick a completed competition, generate, verify both outputs appear and tokens are filled
- Verify BYB type hides the competition dropdown and VE output
- Verify league type shows the league dropdown and hides VE output
- Verify permission gating: a non-MANAGE user can't access the settings page or generator page (redirects)
- Verify TipTap JSON → markdown serialization works (section content converts to plain text before prompt assembly)

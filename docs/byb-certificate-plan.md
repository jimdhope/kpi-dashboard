# BYB Certificate Generation — Implementation Plan

## Goal
Add a certificates tab to the Beat Your Best page that generates and downloads certificates for:
1. **Weekly champion** — agent with the highest % improvement (ratio) over their rolling best
2. **Personal best breakers** — every agent who exceeded their rolling best that week

The certificate design matches the attached SVG (dark background, cyan `#24E7FF` / magenta `#FF4FD8` accents, "KPI Quest" logo top-right).

---

## Existing Certificate Pipeline (to match)

```
Competition certificates (existing):
  competitions/certificates/page.tsx          ← UI: select comp+pod+manager → generates certs
    → POST /api/competitions/[id]/certificates  ← generates HTML via certificateService.generateCertificateHtml()
    → GET  /api/certificate?rank=&name=&...     ← renders PNG via ImageResponse (next/og)
    → downloadSingleCertificate() / downloadAllCertificates()  ← fetch PNG → blob → zip

BYB certificates (new, mirrors above):
  beat-your-best/page.tsx  (new tab)          ← UI: shows leaderboard + cert download buttons
    → new API route (TBD)                     ← generates SVG/PNG for BYB awards
    → download buttons                         ← fetch → blob → save
```

Key things to reuse:
- Download pattern: `fetch(url)` → `blob()` → `URL.createObjectURL` → `<a>.click()` (see `downloadSingleCertificate` in existing page)
- ZIP bundle: `jszip` import (dynamic, already in package.json) for "download all"
- `date-fns` for date formatting (already a dependency)

---

## Design Mapping (SVG → cert data)

| SVG element | Dynamic value |
|---|---|
| "BEAT YOUR BEST" header | Static |
| "PERSONAL BEST UNLOCKED" subtitle | **Changes per cert type**: `PERSONAL BEST UNLOCKED` (breaker) or `TOP IMPROVEMENT` (champion) |
| "AWARDED TO" + name | Agent name |
| "You didn't beat the leaderboard. You beat yourself." | Static tagline |
| "% of Best" big number | Ratio (e.g. 112.5%) — for breaker certs, this is their ratio; for champion, the champion's ratio |
| "This Week's PTS" | Current week raw points |
| "Improvement" | Ratio − 100 (for breakers: how much they beat their best by; for champion: their improvement) |
| "Previous Best PTS" | Rolling best |
| Date bottom | Competition week date range |
| "KPI Quest" top-right | Static |

**Cert types:**
- **Personal Best Unlocked** — awarded to any agent whose `rawPoints > rollingBest` (ratio > 100%). Title shows "PERSONAL BEST UNLOCKED". Stats panel shows their numbers.
- **Top Improvement** — awarded to the single agent with the highest ratio among qualified players. Title shows "TOP IMPROVEMENT". Same stats panel layout.

---

## Files to create / modify

### 1. `src/server/services/byb-certificate-service.ts` (new)
Server-only service that builds SVG markup for a BYB certificate.

**Input:**
```ts
interface BybCertData {
  agentName: string;
  rawPoints: number;
  rollingBest: number;
  ratio: number;        // percentage, e.g. 112.5
  competitionName: string;
  dateRange: string;    // e.g. "Aug 19 – Aug 25, 2026"
  certType: 'personal-best' | 'top-improvement';
}
```

**Output:** React JSX element for `ImageResponse` (PNG, 1600×1000). All text values injected. Colors match the SVG: bg `#08051d`, outer border `#24E7FF` 5px, inner border `#FF4FD8` 2px, title gradient gold→orange→magenta, etc.

**Note:** `byb-certificate-service.ts` no longer renders SVG — it returns a data object + the JSX factory function. The route handler calls `ImageResponse` with the JSX.

### 2. `src/app/api/competitions/[id]/beat-your-best/certificate/route.tsx` (new)
Next.js Route Handler using `ImageResponse` (same as `/api/certificate/route.tsx`).

- `GET` — renders PNG via React JSX. Query params:
  - `agentId` — which agent
  - `certType` — `personal-best` | `top-improvement`
  - `name` — agent name (pre-populated for convenience)
- Loads `lexend-900.ttf` for the big title/name stats, `mrdafoe.woff` for signature-style text (or just use lexend-900 throughout since the SVG uses Arial Black heavy weights)
- Returns `ImageResponse` with 1600×1000 dimensions
- Returns `NextResponse` with `Content-Type: image/svg+xml` and `Content-Disposition: attachment`

### 3. `src/app/(app)/competitions/beat-your-best/page.tsx` (modify)
Add a second tab next to the existing leaderboard:

```
┌─────────────────────────────────────────────┐
│ Beat Your Best          [Leaderboard][Certs]│
└─────────────────────────────────────────────┘
```

**Leaderboard tab** — existing UI, unchanged.

**Certificates tab:**
- Shows two sections:
  - **Personal Bests Broken** — list of agents who beat their rolling best this week, each with a download button (renders `personal-best` cert)
  - **Weekly Champion** — the top improver, with a download button (renders `top-improvement` cert)
- Each row shows: agent name, ratio%, raw points, previous best — so the user knows what they're downloading
- "Download All" button that bundles all visible certs into a ZIP (jszip, matching existing pattern)

### 4. `src/app/(app)/competitions/beat-your-best/page.tsx` — tab state
Add a `useState<'leaderboard' | 'certs'>` tab switcher. The certs tab fetches standings (same API) and derives cert-eligible agents client-side:
- **Personal best breakers:** `standing.rawPoints > standing.rollingBest` (and `standing.ranked === true`)
- **Weekly champion:** `standings.filter(s => s.qualified)` → sort by ratio desc → first

---

## Data flow

```
User opens BYB page → selects competition → fetches /api/competitions/[id]/beat-your-best
  → gets standings (each has: userId, name, rawPoints, rollingBest, ratio, qualified, ranked)
  → switches to Certs tab
    → computes:
      breakers = standings.filter(s => s.ranked && s.rawPoints > s.rollingBest)
      champion = standings.filter(s => s.qualified).sort((a,b) => b.ratio! - a.ratio!)[0]
    → renders list with download buttons

Click download (breaker):
  → GET /api/competitions/[id]/beat-your-best/certificate?agentId=...&certType=personal-best
    → route fetches standing for that agent (or uses cached data)
    → calls bybCertificateService.render({ agentName, rawPoints, rollingBest, ratio, competitionName, dateRange, certType })
    → returns SVG with Content-Disposition: attachment

Click "Download All":
  → fetches each cert PNG/SVG in parallel → adds to jszip → downloads zip
```

---

## API route details

`GET /api/competitions/[id]/beat-your-best/certificate`

Query params:
| Param | Required | Description |
|---|---|---|
| `agentId` | yes | User ID for the certificate |
| `certType` | yes | `personal-best` or `top-improvement` |

The route:
1. Calls `beatYourBestService.getStandings(competitionId)` (cached, so cheap)
2. Finds the standing for `agentId`
3. Validates: for `personal-best`, agent must have `rawPoints > rollingBest`; for `top-improvement`, agent must be the top qualified ratio
4. Builds `dateRange` from competition `startsAt`/`endsAt` (same format as existing: "Aug 19 – Aug 25, 2026")
5. Calls `bybCertificateService.render(certData)` → returns JSX
6. Returns `new ImageResponse(jsx, { width: 1600, height: 1000, fonts: [...] })` with `Content-Disposition: attachment; filename="byb-${certType}-${agentName}.png"`

---

## Rendering: ImageResponse PNG (matches existing/ competition certs)

The existing `/api/certificate/route.tsx` uses `ImageResponse` (React JSX → PNG, 1200×848). BYB certs follow the same pattern at 1600×1000.

**Fonts:** `public/fonts/lexend-900.ttf` (heavy weight, matches Arial Black from the SVG), `public/fonts/mrdafoe.woff` (signature/cursive style, optional). The SVG uses Arial Black for big numbers and titles — Lexend 900 is the closest available heavy weight.

**Layout approach:** The SVG is the visual spec. We build JSX that approximates it:
- Dark radial-ish background (solid `#08051d` with a subtle overlay, since `ImageResponse` doesn't do SVG gradients natively — we fake it with layered divs)
- Dual border: outer cyan 5px, inner magenta 2px (absolute-positioned divs like the existing cert route does)
- Title with gradient fill (CSS `background: linear-gradient(...); WebkitBackgroundClip: text; WebkitTextFillColor: transparent` — same trick the existing config uses for rank titles)
- Stats panel as a bordered box with the big % number in green gradient text
- KPI Quest text top-right

**Content-Disposition:** `attachment; filename="byb-${certType}-${agentName}.png"`

---

## Visual details to match from the SVG

- **Canvas:** 1600×1000 viewBox, responsive `width="100%" height="100%"`
- **Background:** radial gradient `#08051d` (center) → `#050414` (edge), via `<radialGradient id="_Radial1">`
- **Outer border:** rounded rect, stroke `#24E7FF`, 5px, no fill
- **Inner border:** rounded rect, stroke `#FF4FD8`, 2px, opacity 0.9
- **Title "BEAT YOUR BEST":** 102px Arial Black, stroke `#FFF3A1` 2px, fill via `_Linear2` gradient (gold `#FFE84A` → orange `#FF9F1C` → magenta `#FF4FD8`)
- **Subtitle "PERSONAL BEST UNLOCKED" / "TOP IMPROVEMENT":** 25px Arial, `#24E7FF`, inside a dark banner (`#171344` fill, `#24E7FF` stroke 3px)
- **Recipient name:** 76px Arial Black, `#EFEFFE` (near-white)
- **Tagline:** two lines, 23px Arial, `#DDEDEE` — second line "You beat yourself." in `#FF4FD8`
- **Stats panel:** rounded rect with `_Linear3` gradient fill (dark), stroke `#FF4FD8` 4px, inner stroke `#24E7FF` 2px opacity 0.7
  - "OF RECENT BEST FORM" label — 18px, `#BDD7FF`
  - Big % number — 90px Arial Black, `_Linear4` gradient (green `#B6FF3B` → `#39E879`)
  - Three columns: "THIS WEEK'S PTS" / "IMPROVEMENT" / "PREVIOUS BEST PTS" — 26px Arial Black, white / `#FF4FD8` / white
- **KPI Quest logo:** top-right, 20px Arial Black, `#DDEDEE` — text only (no image asset; the SVG uses styled text)
- **Corner dots:** 8px squares in `#24E7FF` at four corners
- **Date:** bottom-center, inside a dark banner

---

## Cert type → title text mapping

| `certType` | Subtitle text | Stats panel label |
|---|---|---|
| `personal-best` | "PERSONAL BEST UNLOCKED" | "% of Best" / "This Week's PTS" / "Improvement" / "Previous Best PTS" |
| `top-improvement` | "TOP IMPROVEMENT" | Same layout, but the % is the champion's ratio |

For `personal-best` certs, the big % number is the agent's ratio (e.g. 112.5%). The "Improvement" column shows `ratio - 100` (e.g. +12.5%). For `top-improvement`, same columns, just the champion's numbers.

---

## Scope boundaries

**In scope:**
- BYB certificate service (JSX factory for ImageResponse)
- API route for BYB certs (ImageResponse PNG)
- Tab + download UI on the BYB page
- Download All (ZIP) for BYB certs

**Out of scope (for now):**
- Email delivery of certs
- Admin bulk generate for all agents
- Team/organization-level BYB certs

---

## Checklist

- [ ] Create `src/server/services/byb-certificate-service.ts`
- [ ] Create `src/app/api/competitions/[id]/beat-your-best/certificate/route.ts`
- [ ] Add tab state + certs tab UI to `beat-your-best/page.tsx`
- [ ] Add download button per cert + "Download All" ZIP
- [ ] Verify: breaker list matches `rawPoints > rollingBest`; champion is top qualified ratio
- [ ] Verify: SVG renders correctly in browser (open the downloaded .svg)
- [ ] Typecheck passes

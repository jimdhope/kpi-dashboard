# V3 UI & UX Overhaul Task List

## Specifications Sourced
"Shadcn UI must be utilized across all components... Dark Mode Standard: The app must use a dark mode by default... Core Color Scheme: --onyx: #0d0a0bff; --bright-snow: #f8f8f8ff; --green: #3f7d20ff; --cerulean: #4281a4ff; --goldenrod: #d5a021ff... Retain the consistent AppNavBar top-navigation layout present in V2... Upgrade existing V3 pages (Dashboard, Performance, Competitions) to use Shadcn components natively with the updated theme."

## Execution Plan 

### Phase 1: Foundation (CSS & Theme)
- [x] **Task 1.1**: Initialize Shadcn UI in V3 (`npx shadcn-ui@latest init` or manual config) and install base components (`button`, `dropdown-menu`, `sheet`, `avatar`).
- [x] **Task 1.2**: Standardize Dark Mode default and apply Core Color Scheme to `v3/src/app/globals.css` and `v3/tailwind.config.ts` mapping colors correctly (`--onyx`, etc.).

### Phase 2: Core Components 
- [x] **Task 2.1**: Port V2's `AppNavBar` component structure into V3 (`v3/src/components/app-navbar.tsx`). Ensure necessary Lucide React icons are installed. Ensure `NavDropdown` and standard desktop/mobile drawer are intact but wired to V3 auth schemas. 
- [x] **Task 2.2**: Update V3's primary layout (`v3/src/app/layout.tsx`) to utilize the newly ported `AppNavBar`. 

### Phase 3: Page Overhaul 
- [x] **Task 3.1**: Upgrade Dashboard pages (`v3/src/app/dashboard`, `v3/src/components/dashboard-overview.tsx`) to use modern Shadcn elements, card outlines, and matched styling.
- [x] **Task 3.2**: Upgrade Performance Page (`v3/src/app/performance/page.tsx`) rendering logic to match V2 premium layouts with the fresh color scheme.
- [x] **Task 3.3**: Upgrade Competitions elements (`v3/src/app/competitions/page.tsx`, `leaderboard-card.tsx`) with modern Shadcn tables or stylized grid flex layouts.

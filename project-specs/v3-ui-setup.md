# V3 UI & UX Overhaul Setup

## Context
V3's backend has been successfully migrated to Postgres and is fully functional. The UI presently uses a basic shell layout. We need to overhaul the V3 frontend UI to match the aesthetic and layout of V2. 

## Design Requirements
1. **Shadcn UI**: Must be utilized across all components for consistency and modern feel.
2. **Dark Mode Standard**: The app must use a dark mode by default/as standard. 
3. **Core Color Scheme**:
   - `--onyx`: #0d0a0bff
   - `--bright-snow`: #f8f8f8ff
   - `--green`: #3f7d20ff
   - `--cerulean`: #4281a4ff
   - `--goldenrod`: #d5a021ff

## Structural Requirements 
1. **App Header Layout**: Retain the consistent `AppNavBar` top-navigation layout present in V2. The V2 design was "spot on", so porting the `AppNavBar` layout into the V3 application's primary layout is crucial.
2. **Component Parity**: Ensure V3 pages use similar UI structures (cards, grids, data presentation) to match the premium feel of V2.

## Goals
- Overhaul V3 frontend CSS and tailwind variables to match the new color scheme.
- Port V2's `AppNavBar` and shared app layout to V3.
- Upgrade existing V3 pages (Dashboard, Performance, Competitions) to use Shadcn components natively with the updated theme.

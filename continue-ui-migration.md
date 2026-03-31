# KPI Quest 2: Continued UI Migration (V3 to V2 standard)

Hello, Gemini! You are taking over the ongoing UI/UX overhaul for **KPI Quest 2**. 

## Context: The State of the Project
- The project is split into directories:
  - `v2/`: The old Firebase-based frontend. It has a **beautiful, premium glassmorphic UI system** and operational flow that the user loved.
  - `v3/`: The new full-stack rebuild. It uses PostgreSQL, Prisma, app-owned sessions, and a custom API layer. The backend is solid.
- **The Core Goal**: We are migrating the robust V3 backend application to **achieve 100% feature and UI parity with V2**. 
- **The Design Standard**:
  - We want to re-establish the original UI layouts and data logging flows from V2 exactly as they were (e.g., logging achievements, viewing competitions, interacting with dashboards).
  - The application strictly uses **Dark Mode** and **ShadCN UI**.
  - We use a specialized color palette: `--onyx`, `--bright-snow`, `--green`, `--cerulean`, `--goldenrod`.
  - The "Glassmorphism" standard has been ported cleanly into `v3/src/app/globals.css` and `v3/tailwind.config.ts` using `.glass-card` classes.
  - New V3-specific pages (like postgres admin tools) must be laid out to seamlessly match the V2 aesthetics.
  - **Important Constraint**: V3 uses Tailwindcss `v3.4.17` because `v4` fundamentally broke ShadCN and Next.js postcss interoperability inside the project path. **Do not upgrade to Tailwind v4.**

## What Has Already Been Accomplished
- **Layout**: The global shell (`v3/src/components/app-shell.tsx`) was rebuilt to replicate V2's top nav bar layout (`v3/src/components/app-navbar.tsx`). The old V3 sidebar is permanently gone.
- **Completed Components**: 
  - `AppNavBar` (Top-nav wrapper with auth & dropdowns)
  - `DashboardOverview` (ShadCN grid with metric numbers & activity feed)
  - `PerformanceWorkspace` (ShadCN grid with forms to log progress)
  - `CompetitionsWorkspace` (ShadCN leaderboard tracking)
  - `LeaderboardCard` & `PodComparison`

## What You Need to Do Next
Your task is to comprehensively convert the **remaining V3 workspace pages** to match the new Shadcn + Glassmorphism standard mapped out in the completed components, **while ensuring 1:1 UI layout feature parity referencing the `v2/` directory codebase.**

1. **Review V2 Reference Material**
   - For every V3 page you overhaul, check the corresponding page or component in the `v2/` directory first to see how it was laid out and how users originally operated it.
   - Re-establish the original logging flows for achievements, competitions, etc., within the V3 backend logic but with the exact V2 UI experience.

2. **Migrate Existing V3 Pages**
   - Strip out old raw CSS wrapper classes (e.g., `<div className="dashboard-grid">`, `<section className="card">`, `<form className="form-card inline-form">`) from remaining V3 components.
   - Replace them strictly with matching ShadCN layouts (e.g., `<Card className="glass-card">`, Tailwind Flex/Grid, standardized inputs).
   - Target Pages: Profile (`/profile`), Campaigns (`/campaigns`), Pods (`/pods`), Trackers (`/trackers`), Users (`/admin/users`), Manage Competitions (`/competitions/manage`), Reports (`/reports`), Teams Integration (`/integrations/teams/*`), Notifications (`/notifications`), and Minigames (`/games/rps`).

3. **Style New V3 Infrastructure**
   - Make sure any backend tools or infrastructure pages exclusively built for V3 mirror the overarching V2 glassmorphic theme.

### Immediate Next Step For Gemini
1. Perform a scan of `v3/src/components` and `v3/src/app` to verify the state of `profile-workspace.tsx` or similar Admin pages.
2. Select the next unstyled page and cross-reference its V2 counterpart. Initiate the refactor using the `<Card className="glass-card">` design pattern visible in `v3/src/components/dashboard-overview.tsx`. 
3. You may need to install missing ShadCN form components (`npx -y shadcn@latest add input label table select dialog` etc) as you encounter them.

Good luck! Maintain the *Hum* and preserve the dark mode glass aesthetics.

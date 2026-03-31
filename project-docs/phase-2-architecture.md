# Phase 2: Technical Architecture Foundation

## 1. Data Mode Enhancements (Prisma)
We need to enhance the `Activity` model to support rich logging for games and system events.

### Activity Model (Existing)
Already has `type`, `title`, `description`, `metadataJson`.

### Proposed Types
- `game_played`: Record of a user playing a mini-game.
- `achievement_unlocked`: Record of a user hitting a milestone.
- `performance_alert`: Automated alert from Teams automation.

## 2. Shared Contracts (`src/lib/contracts.ts`)
Add the following interfaces:
```typescript
export interface ActivityRecord {
  id: string;
  userId: string | null;
  userName: string | null;
  type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface RpsGameResult {
  playerThrow: "rock" | "paper" | "scissors";
  opponentThrow: "rock" | "paper" | "scissors";
  result: "win" | "loss" | "draw";
  cooldownSeconds: number;
}
```

## 3. Server Actions Pattern
We will use Next.js Server Actions for all game logic to ensure security and prevent client-side manipulation of results.
- `src/server/actions/rps.ts`: `playRps(throw: Throw)`

## 4. UI Component Strategy
- Use the unified `globals.css` classes.
- Create a reusable `GameCard` component in `src/components/games/game-card.tsx`.
- The RPS game will live at `/games/rps`.
- The Game Hub will live at `/games`.

## 5. Permissions
- Middleware for `/admin`.
- Role-based visibility in the sidebar (AppShell).

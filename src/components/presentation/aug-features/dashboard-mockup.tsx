"use client";

import { BetaBadge } from "./ui";

function Medal({ rank }: { rank: number }) {
  return (
    <span className="w-4 text-center text-[10px]">
      {rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : rank}
    </span>
  );
}

function MockCard({
  children,
  className = "",
  dimmed,
}: {
  children: React.ReactNode;
  className?: string;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-white/10 bg-slate-900/85 backdrop-blur-xl transition-opacity ${
        dimmed ? "opacity-35" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

const TRACKER_RULES = [
  { emoji: "📞", title: "Calls", points: 10, qty: 3 },
  { emoji: "✅", title: "Wrap-up tasks", points: 5, qty: 6 },
  { emoji: "💬", title: "Reviews", points: 15, qty: 1 },
];

const AGENT_STANDINGS = [
  { rank: 1, name: "Sam", score: "1,412" },
  { rank: 2, name: "Jordan", score: "1,305" },
  { rank: 3, name: "Riley", score: "1,278" },
  { rank: 4, name: "You", score: "1,190", you: true },
];

const BYB_STANDINGS = [
  { rank: 1, name: "Sam", pts: "812", ratio: "104.2%", pb: true },
  { rank: 2, name: "You", pts: "790", ratio: "97.3%", you: true },
  { rank: 3, name: "Casey", pts: "774", ratio: "96.1%" },
];

export function DashboardMockup({ highlight }: { highlight?: "byb" }) {
  const dim = highlight ? true : false;
  return (
    <div className="w-full overflow-hidden rounded-xl border border-white/12 bg-slate-950/70 p-4 shadow-[0_16px_48px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <p className="text-sm font-bold text-white/90">Welcome back, Alex!</p>

      <MockCard className="mt-3 p-3" dimmed={dim}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-bold text-white/90">
            🏆 My daily score tracker
          </p>
          <div className="flex gap-1.5">
            <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-white/80">
              Today <span className="text-teal-300">45</span> pts
            </span>
            <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-[9px] font-bold text-white/80">
              Comp <span className="text-teal-300">1,240</span> pts
            </span>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {TRACKER_RULES.map((rule) => (
            <div
              key={rule.title}
              className="rounded-md border border-white/10 bg-black/25 p-1.5"
            >
              <p className="truncate text-[9px] font-bold uppercase tracking-wide text-white/75">
                {rule.emoji} {rule.title}
                <span className="ml-1 rounded-full bg-teal-400/15 px-1 text-[8px] font-semibold normal-case text-teal-300">
                  {rule.points} pts
                </span>
              </p>
              <div className="mt-1.5 flex items-center gap-1">
                <span className="grid h-4 w-6 place-items-center rounded border border-white/10 bg-black/40 text-[9px] tabular-nums text-white/80">
                  {rule.qty}
                </span>
                <span className="grid h-4 flex-1 place-items-center rounded bg-teal-500/25 text-[8px] font-bold text-teal-200">
                  Log
                </span>
              </div>
            </div>
          ))}
        </div>
      </MockCard>

      <div className="mt-2 grid grid-cols-3 gap-2">
        <MockCard className="p-2.5" dimmed={dim}>
          <p className="text-[10px] font-bold text-white/90">🏅 Competitions</p>
          <p className="mb-1.5 mt-0.5 text-[8px] uppercase tracking-wider text-white/45">
            Agent standings
          </p>
          <div className="space-y-1">
            {AGENT_STANDINGS.map((row) => (
              <div
                key={row.rank}
                className={`flex items-center gap-1 rounded px-1 py-0.5 text-[9px] ${
                  row.you ? "bg-teal-400/15 font-bold text-teal-200" : "text-white/70"
                }`}
              >
                <Medal rank={row.rank} />
                <span className="flex-1 truncate">{row.name}</span>
                <span className="tabular-nums">{row.score}</span>
              </div>
            ))}
          </div>
        </MockCard>

        <MockCard
          className={
            highlight === "byb"
              ? "relative z-10 border-sky-400/60 p-2.5 shadow-[0_0_28px_rgba(56,189,248,0.4)]"
              : "p-2.5"
          }
        >
          <div className="flex items-center justify-between gap-1">
            <p className="text-[10px] font-bold text-white/90">⚡ Beat Your Best</p>
            <BetaBadge />
          </div>
          <p className="mb-1.5 mt-0.5 text-[8px] uppercase tracking-wider text-white/45">
            This week vs your best
          </p>
          <div className="space-y-1">
            {BYB_STANDINGS.map((row) => (
              <div
                key={row.rank}
                className={`flex items-center gap-1 rounded px-1 py-0.5 text-[9px] ${
                  row.you
                    ? "bg-sky-400/15 font-bold text-sky-200"
                    : "text-white/70"
                }`}
              >
                <span className="w-3 text-center">{row.rank}</span>
                <span className="flex-1 truncate">{row.name}</span>
                {row.pb ? (
                  <span className="rounded-full bg-emerald-400/20 px-1 text-[7px] font-bold uppercase text-emerald-300">
                    PB
                  </span>
                ) : null}
                <span className="tabular-nums">{row.ratio}</span>
              </div>
            ))}
          </div>
        </MockCard>

        <MockCard className="p-2.5" dimmed={dim}>
          <p className="text-[10px] font-bold text-white/90">📊 Performance</p>
          <p className="mb-1.5 mt-0.5 text-[8px] uppercase tracking-wider text-white/45">
            6-week KPIs
          </p>
          <div className="space-y-1">
            {[
              { kpi: "Adherence", cells: ["98%", "95%", "96%"] },
              { kpi: "QA", cells: ["92%", "94%", "93%"] },
              { kpi: "AHT", cells: ["7:10", "6:58", "7:02"] },
            ].map((row) => (
              <div key={row.kpi} className="flex items-center gap-1 text-[8px]">
                <span className="w-11 truncate font-semibold text-white/60">
                  {row.kpi}
                </span>
                {row.cells.map((cell, i) => (
                  <span
                    key={i}
                    className="flex-1 rounded-sm bg-emerald-500/20 py-px text-center tabular-nums text-emerald-200"
                  >
                    {cell}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </MockCard>
      </div>
    </div>
  );
}

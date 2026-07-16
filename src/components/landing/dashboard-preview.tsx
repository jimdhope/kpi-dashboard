"use client";

import { useState } from "react";
import { BarChart3, Gamepad2, Medal, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

const agents = [
  { name: "Morgan Reed", pod: "Northern Stars", points: "1,240" },
  { name: "You", pod: "Momentum", points: "1,180" },
  { name: "Taylor Quinn", pod: "Trailblazers", points: "1,025" },
];

const teams = [
  { name: "Momentum Makers", points: "3,420" },
  { name: "Northern Lights", points: "3,180" },
  { name: "Trailblazers", points: "2,940" },
];

const pods = [
  { name: "Northern Stars", agents: 14, achievements: "860" },
  { name: "Momentum", agents: 12, achievements: "745" },
  { name: "Trailblazers", agents: 11, achievements: "690" },
];

const kpis = [
  { name: "Quality", values: ["89%", "91%", "94%", "92%"], average: "91.5%" },
  { name: "Resolution", values: ["82%", "84%", "87%", "90%"], average: "85.8%" },
  { name: "Reviews", values: ["18", "21", "20", "24"], average: "83" },
];

function Rank({ index }: { index: number }) {
  return index < 3 ? (
    <Medal className={cn("h-3.5 w-3.5", index === 0 ? "text-yellow-400" : index === 1 ? "text-gray-300" : "text-orange-400")} />
  ) : <span>{index + 1}</span>;
}

function PreviewCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("min-w-0 overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] shadow-lg shadow-black/10", className)}>{children}</div>;
}

function CardHeading({ icon: Icon, title, description, color = "text-primary", action }: { icon: typeof Trophy; title: string; description?: string; color?: string; action?: React.ReactNode }) {
  return (
    <div className="border-b border-white/8 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div className="rounded-lg bg-white/5 p-1.5"><Icon className={cn("h-3.5 w-3.5", color)} /></div>
          <div className="min-w-0"><h3 className="truncate text-xs font-semibold">{title}</h3>{description && <p className="truncate text-[9px] text-muted-foreground">{description}</p>}</div>
        </div>
        {action}
      </div>
    </div>
  );
}

function MiniTable({ headers, rows, highlight }: { headers: string[]; rows: string[][]; highlight?: number }) {
  return (
    <div className="w-full text-[9px]">
      <div className="grid border-b border-white/8 bg-white/[0.035] font-semibold uppercase text-muted-foreground" style={{ gridTemplateColumns: `1.5rem repeat(${headers.length - 1}, minmax(0, 1fr))` }}>
        {headers.map((header) => <span key={header} className={cn("px-1.5 py-2", header === headers.at(-1) && "text-right")}>{header}</span>)}
      </div>
      {rows.map((row, rowIndex) => (
        <div key={row.join("-")} className={cn("grid items-center border-b border-white/5 last:border-0", rowIndex === highlight && "bg-primary/10 text-primary")} style={{ gridTemplateColumns: `1.5rem repeat(${row.length - 1}, minmax(0, 1fr))` }}>
          {row.map((cell, cellIndex) => <span key={`${cell}-${cellIndex}`} className={cn("truncate px-1.5 py-2", cellIndex === row.length - 1 && "text-right font-semibold")}>{cellIndex === 0 ? <Rank index={rowIndex} /> : cell}</span>)}
        </div>
      ))}
    </div>
  );
}

function AgentPreview() {
  return (
    <>
      <div className="mb-4"><h2 className="text-lg font-bold sm:text-xl">Welcome back, Jordan!</h2></div>
      <div className="grid items-start gap-3 lg:grid-cols-3">
        <PreviewCard>
          <CardHeading icon={Trophy} title="Competitions" action={<span className="rounded border border-white/10 px-2 py-1 text-[9px] text-muted-foreground">Summer Sprint⌄</span>} />
          <div className="p-3">
            <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Team Standings</p>
            <MiniTable headers={["#", "Team", "Score"]} rows={teams.map((team) => ["", team.name, team.points])} highlight={1} />
            <p className="mb-1.5 mt-3 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Agent Standings</p>
            <MiniTable headers={["#", "Agent", "Score"]} rows={agents.map((agent) => ["", agent.name, agent.points])} highlight={1} />
          </div>
        </PreviewCard>

        <PreviewCard>
          <CardHeading icon={BarChart3} title="Performance" description="6-week KPI breakdown" color="text-blue-500" />
          <div className="border-b border-white/8 bg-white/[0.065] px-3 py-2 text-[10px] font-semibold">Jordan Lee</div>
          <div className="overflow-hidden p-2">
            <div className="grid grid-cols-[1.2fr_repeat(4,0.7fr)_0.8fr] bg-white/[0.035] text-[8px] font-bold uppercase text-muted-foreground">
              {["KPI", "09/06", "16/06", "23/06", "30/06", "AVG"].map((item) => <span key={item} className="px-1 py-2 text-center first:text-left last:border-l last:border-primary/40 last:text-primary">{item}</span>)}
            </div>
            {kpis.map((kpi, index) => <div key={kpi.name} className={cn("grid grid-cols-[1.2fr_repeat(4,0.7fr)_0.8fr] text-[8px]", index % 2 === 1 && "bg-white/[0.025]")}><span className="truncate px-1 py-2 font-semibold">{kpi.name}</span>{kpi.values.map((value) => <span key={value} className="border-l border-white/5 px-1 py-2 text-center">{value}</span>)}<span className="border-l border-primary/40 bg-primary/5 px-1 py-2 text-center font-bold text-primary">{kpi.average}</span></div>)}
          </div>
        </PreviewCard>

        <PreviewCard>
          <CardHeading icon={Gamepad2} title="Mini Games" description="Top 10 scores for each game" color="text-purple-400" />
          <div className="space-y-3 p-3">
            {[{ name: "Daily Word", label: "Guesses", scores: ["3", "4", "5"] }, { name: "Higher or Lower", label: "Streak", scores: ["18", "15", "12"] }].map((game) => <div key={game.name}><div className="mb-1 flex justify-between border-b border-white/8 pb-1.5 text-[9px]"><span className="font-semibold">{game.name}</span><span className="uppercase text-muted-foreground">{game.label}</span></div>{agents.map((agent, index) => <div key={`${game.name}-${agent.name}`} className={cn("grid grid-cols-[1.5rem_1fr_auto] items-center gap-1 rounded px-1 py-1.5 text-[9px]", index === 1 && "bg-purple-500/15 text-purple-300")}><Rank index={index} /><span>{index === 1 ? "You" : agent.name}</span><strong>{game.scores[index]}</strong></div>)}</div>)}
          </div>
        </PreviewCard>
      </div>
    </>
  );
}

function AdminPreview() {
  return (
    <>
      <div className="mb-4"><h2 className="text-lg font-bold sm:text-xl">Admin Dashboard</h2><p className="text-[10px] text-muted-foreground">Real-time overview of KPI Quest</p></div>
      <div className="grid items-start gap-3 lg:grid-cols-3">
        <PreviewCard>
          <CardHeading icon={BarChart3} title="Pod Performance" description="Today’s combined metrics by pod" color="text-blue-500" />
          <MiniTable headers={["#", "Pod", "Agents", "Achievements"]} rows={pods.map((pod) => ["", pod.name, String(pod.agents), pod.achievements])} />
        </PreviewCard>
        <PreviewCard>
          <CardHeading icon={Trophy} title="Latest Competition" description="Summer Sprint (Jun 24 – Jul 5, 2026)" action={<span className="text-[9px] text-primary">View All →</span>} />
          <div className="p-3"><p className="mb-1.5 text-[9px] font-medium text-muted-foreground">Team Standings</p><MiniTable headers={["#", "Team", "Score"]} rows={teams.map((team) => ["", team.name, team.points])} /></div>
        </PreviewCard>
        <PreviewCard>
          <CardHeading icon={Target} title="Top 10 Performers" description="Summer Sprint · Today" color="text-green-500" action={<div className="rounded border border-white/10 p-0.5 text-[8px]"><span className="rounded bg-white/10 px-1.5 py-1">Day</span><span className="px-1.5 py-1 text-muted-foreground">Competition</span></div>} />
          <MiniTable headers={["#", "Agent", "Pod", "Points"]} rows={agents.map((agent) => ["", agent.name === "You" ? "Jordan Lee" : agent.name, agent.pod, agent.points])} />
        </PreviewCard>
      </div>
    </>
  );
}

export function DashboardPreview() {
  const [view, setView] = useState<"agent" | "admin">("agent");

  return (
    <div className="relative mx-auto w-full max-w-6xl" aria-label="Illustrative KPI Quest dashboard preview">
      <div className="absolute -inset-8 -z-10 rounded-[3rem] bg-primary/10 blur-3xl" />
      <div className="overflow-hidden rounded-[1.75rem] border border-primary/25 bg-background/70 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="flex flex-col gap-3 border-b border-white/10 bg-white/[0.035] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-red-400/80" /><span className="h-2.5 w-2.5 rounded-full bg-goldenrod/80" /><span className="h-2.5 w-2.5 rounded-full bg-primary/80" /><span className="ml-2 text-xs text-muted-foreground">Dashboard preview · fictional data</span></div>
          <div className="inline-flex w-fit rounded-lg border border-white/10 bg-black/20 p-1" role="group" aria-label="Dashboard preview role">
            {(["agent", "admin"] as const).map((role) => <button key={role} type="button" aria-pressed={view === role} onClick={() => setView(role)} className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary motion-reduce:transition-none", view === role ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{role} view</button>)}
          </div>
        </div>
        <div className="p-4 sm:p-6">{view === "agent" ? <AgentPreview /> : <AdminPreview />}</div>
      </div>
    </div>
  );
}

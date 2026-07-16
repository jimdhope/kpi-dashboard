import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowDown, ArrowRight, BookOpen, Bot, Calculator, CloudCog, Gamepad2,
  Gauge, LockKeyhole, ShieldCheck, Sparkles, Trophy, Users, WifiOff,
} from "lucide-react";
import { DashboardPreview } from "@/components/landing/dashboard-preview";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "KPI Quest | Turn team performance into progress",
  description: "KPI Quest brings competitions, KPI performance, team pods, daily games, knowledge and practical tools into one role-aware workspace.",
};

const capabilities = [
  { title: "Competitions that motivate", description: "Build KPI competitions with flexible scoring, live standings, pods and downloadable winner certificates.", icon: Trophy },
  { title: "Performance made visible", description: "Give agents, managers and administrators the right view of daily results, targets and longer-term trends.", icon: Gauge },
  { title: "Teams that progress together", description: "Organise agents into pods, recognise achievements and celebrate individual and team improvement.", icon: Users },
  { title: "Daily moments of fun", description: "Keep engagement fresh with Daily Word, Higher or Lower, Sudoku and Rock Paper Scissors leaderboards.", icon: Gamepad2 },
  { title: "Knowledge in one place", description: "Combine a searchable directory, rich knowledge base, guided call flows and practical calculation tools.", icon: BookOpen },
  { title: "Connected workflows", description: "Bring competition updates into Microsoft Teams and keep scheduled work reliable with background jobs.", icon: CloudCog },
];

const roleViews = [
  { role: "Agents", description: "Personal standings, KPI breakdowns, pod highlights, achievements and daily games in one focused dashboard." },
  { role: "Managers", description: "Team performance, competition progress and operational tools without exposing unnecessary administration." },
  { role: "Administrators", description: "Organisation-wide insight, competition control, user permissions, reports, integrations and safe backups." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <nav className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8" aria-label="Public navigation">
        <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
          <Image src="/logo.svg" alt="" width={42} height={42} priority unoptimized />
          <span className="text-lg font-semibold tracking-tight">KPI Quest</span>
        </Link>
        <Button asChild><Link href="/login">Sign in <ArrowRight className="h-4 w-4" /></Link></Button>
      </nav>

      <section className="relative px-4 pb-16 pt-14 text-center sm:px-6 sm:pt-20 lg:px-8 lg:pb-24">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-[34rem] max-w-5xl rounded-full bg-primary/10 blur-[120px]" />
        <div className="mx-auto max-w-4xl">
          <div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-2 text-xs font-medium text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Performance, competition and teamwork in one place
          </div>
          <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
            Turn everyday targets into <span className="bg-gradient-to-r from-primary via-cyan-200 to-goldenrod bg-clip-text text-transparent">visible progress</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-muted-foreground sm:text-lg">
            KPI Quest gives every role a clear view of performance, friendly competition and team achievement—without losing the practical tools people need to do their work.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg"><Link href="/login">Sign in to KPI Quest <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button asChild size="lg" variant="outline"><a href="#product-preview">Explore the platform <ArrowDown className="h-4 w-4" /></a></Button>
          </div>
        </div>
      </section>

      <section id="product-preview" className="scroll-mt-8 px-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
        <DashboardPreview />
      </section>

      <section id="features" className="border-y border-white/8 bg-black/10 px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">One connected workspace</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Built around how teams actually work</h2>
            <p className="mt-4 text-muted-foreground">Measure progress, keep knowledge close and add the right amount of friendly competition.</p>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {capabilities.map(({ title, description, icon: Icon }) => (
              <Card key={title} variant="glass" className="group transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none motion-reduce:transition-none">
                <CardHeader><div className="mb-3 w-fit rounded-xl border border-primary/20 bg-primary/10 p-3"><Icon className="h-5 w-5 text-primary" /></div><CardTitle>{title}</CardTitle></CardHeader>
                <CardContent><p className="text-sm leading-6 text-muted-foreground">{description}</p></CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Role-aware by design</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">One dashboard address. The right experience for every role.</h2>
            <p className="mt-5 leading-7 text-muted-foreground">Users see only the navigation, information and controls their role permits. Multi-role users can move between authorised views without maintaining separate accounts.</p>
          </div>
          <div className="space-y-3">
            {roleViews.map(({ role, description }, index) => (
              <div key={role} className="glass-card flex gap-4 rounded-2xl p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">{index + 1}</span>
                <div><h3 className="font-semibold">{role}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 md:grid-cols-3">
          <Card variant="glass"><CardHeader><ShieldCheck className="h-6 w-6 text-primary" /><CardTitle className="mt-3">Controlled access</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">Role and ownership checks protect application actions, supported by secure sessions and auditable activity.</CardContent></Card>
          <Card variant="glass"><CardHeader><Bot className="h-6 w-6 text-primary" /><CardTitle className="mt-3">Safe operations</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">Fail-closed database migrations, explicit production seeding and full backup and restore workflows support safer upgrades.</CardContent></Card>
          <Card variant="glass"><CardHeader><WifiOff className="h-6 w-6 text-primary" /><CardTitle className="mt-3">Installable PWA</CardTitle></CardHeader><CardContent className="text-sm leading-6 text-muted-foreground">Install KPI Quest on supported devices with a branded offline fallback. Private dashboards and API data are never stored for offline use.</CardContent></Card>
        </div>
      </section>

      <section className="border-y border-white/8 bg-primary/[0.055] px-4 py-16 text-center sm:px-6 lg:px-8">
        <LockKeyhole className="mx-auto h-8 w-8 text-primary" />
        <h2 className="mt-5 text-3xl font-bold tracking-tight">Already part of a KPI Quest team?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">Sign in to open the dashboard selected for your role and continue where you left off.</p>
        <Button asChild size="lg" className="mt-7"><Link href="/login">Open your dashboard <ArrowRight className="h-4 w-4" /></Link></Button>
      </section>

      <footer className="mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
        <div className="flex items-center gap-2"><Image src="/logo.svg" alt="" width={28} height={28} unoptimized /><span>KPI Quest · Performance management for connected teams</span></div>
        <div className="flex items-center gap-4"><span>Version 3.6.0</span><Link href="/login" className="hover:text-foreground">Sign in</Link></div>
      </footer>
    </main>
  );
}

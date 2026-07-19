"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Zap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Rule = { id: string; title: string; points: number; emoji?: string | null; agentCanLog?: boolean };
type Competition = { id: string; name: string; podIds: string[]; rules: Rule[] };
type DashboardData = { user: { podIds?: string[] }; competitions: Competition[]; achievementCompetitionId?: string | null };

export default function QuickScorePage() {
  const { toast } = useToast();
  const [data, setData] = useState<DashboardData | null>(null);
  const [competitionId, setCompetitionId] = useState("");
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard/agent")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Unable to load quick score.")))
      .then((payload) => {
        setData(payload);
        setCompetitionId(payload.achievementCompetitionId || payload.competitions?.[0]?.id || "");
      })
      .catch(() => toast({ variant: "destructive", title: "Quick score unavailable", description: "Please refresh and try again." }));
  }, [toast]);

  const competition = useMemo(() => data?.competitions.find((item) => item.id === competitionId) ?? null, [data, competitionId]);
  const podId = useMemo(
    () => competition?.podIds.find((id) => data?.user.podIds?.includes(id)) ?? null,
    [competition, data],
  );
  const rules = useMemo(() => competition?.rules.filter((rule) => rule.agentCanLog) ?? [], [competition]);

  async function logScore(rule: Rule) {
    if (!competition || !podId) return;
    const quantity = Number(quantities[rule.id] || 1);
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast({ variant: "destructive", title: "Enter a whole number of at least 1." });
      return;
    }
    setSubmitting(rule.id);
    try {
      const response = await fetch("/api/agent/score-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ competitionId: competition.id, ruleId: rule.id, podId, quantity, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not record score.");
      setQuantities((current) => ({ ...current, [rule.id]: "1" }));
      toast({ title: "Score logged", description: `${quantity} × ${rule.title} recorded.` });
    } catch (error) {
      toast({ variant: "destructive", title: "Score not logged", description: error instanceof Error ? error.message : "Please try again." });
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl space-y-4 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/15 p-3"><Zap className="h-6 w-6 text-primary" /></div>
        <div><h1 className="text-2xl font-bold">Quick score</h1><p className="text-sm text-muted-foreground">Log an enabled competition rule.</p></div>
      </div>
      <Card className="glass-card">
        <CardHeader><CardTitle>Competition</CardTitle></CardHeader>
        <CardContent>
          <Select value={competitionId} onValueChange={setCompetitionId}>
            <SelectTrigger><SelectValue placeholder="Select competition" /></SelectTrigger>
            <SelectContent>{data?.competitions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
          </Select>
        </CardContent>
      </Card>
      {!data ? <Card><CardContent className="p-8 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></CardContent></Card> : !podId ? <Card><CardContent className="p-6 text-sm text-muted-foreground">You are not currently assigned to a pod in this competition.</CardContent></Card> : rules.length === 0 ? <Card><CardContent className="p-6 text-sm text-muted-foreground">No rules are enabled for agent scoring in this competition.</CardContent></Card> : (
        <Card className="glass-card border-2">
          <CardHeader className="border-b pb-4"><CardTitle className="text-base">🏆 Score tracker</CardTitle><CardDescription>Choose a quantity, then tap Log.</CardDescription></CardHeader>
          <CardContent className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3 pt-5">
            {rules.map((rule) => (
              <div key={rule.id} className="flex min-h-32 flex-col justify-between gap-4 rounded-lg border bg-background/50 p-3 transition-colors active:bg-muted/40">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2"><span className="text-xl">{rule.emoji || "🏆"}</span><span className="break-words text-xs font-bold uppercase leading-4 tracking-wider">{rule.title}</span></div>
                  <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{rule.points} pts</span>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Input className="h-12 w-14 bg-background px-1 text-center text-base" type="text" inputMode="numeric" pattern="[0-9]*" value={quantities[rule.id] ?? "1"} onChange={(event) => setQuantities((current) => ({ ...current, [rule.id]: event.target.value }))} aria-label={`Quantity for ${rule.title}`} />
                  <div className="flex flex-col gap-1">
                    <Button variant="secondary" size="icon" className="h-6 w-9 text-base" onClick={() => setQuantities((current) => ({ ...current, [rule.id]: String(Math.max(1, Number(current[rule.id] || 1) + 1)) }))} aria-label={`Increase ${rule.title}`}>+</Button>
                    <Button variant="secondary" size="icon" className="h-6 w-9 text-base" onClick={() => setQuantities((current) => ({ ...current, [rule.id]: String(Math.max(1, Number(current[rule.id] || 1) - 1)) }))} aria-label={`Decrease ${rule.title}`}>−</Button>
                  </div>
                  <Button className="h-12 min-w-14 px-3" onClick={() => logScore(rule)} disabled={submitting === rule.id}>{submitting === rule.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="mr-1 h-4 w-4" />Log</>}</Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
      <Card><CardContent className="p-4 text-xs text-muted-foreground">Scores are provisional. You can undo a recent entry from your agent dashboard.</CardContent></Card>
    </main>
  );
}

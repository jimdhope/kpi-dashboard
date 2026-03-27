"use client";

import React, { useState, useEffect, useMemo } from "react";
import { format, startOfDay } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarIcon, Filter, CheckSquare, Save, Loader2, Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Pod { id: string; name: string; }
interface Agent { id: string; name: string; }
interface Rule { id: string; title: string; points: number; }
interface Competition { id: string; name: string; startsAt: Date | string | null; endsAt: Date | string | null; rules: Rule[]; }

const LOG_POD_KEY = "compLog_selectedPodId";
const LOG_DATE_KEY = "compLog_selectedDate";

export function CompetitionsLogForm({
  pods,
  competitions,
  currentUserId,
}: {
  pods: Pod[];
  competitions: Competition[];
  currentUserId: string;
}) {
  const [selectedPodId, setSelectedPodId] = useState("");
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [agents, setAgents] = useState<Agent[]>([]);
  const [inputs, setInputs] = useState<{ [userId: string]: { [ruleId: string]: string } }>({});
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const savedPod = localStorage.getItem(LOG_POD_KEY);
    if (savedPod) setSelectedPodId(savedPod);
    const savedDate = localStorage.getItem(LOG_DATE_KEY);
    if (savedDate) setSelectedDate(startOfDay(new Date(savedDate)));
  }, []);

  useEffect(() => {
    if (!selectedPodId) { setAgents([]); setInputs({}); return; }
    setIsLoadingAgents(true);
    fetch(`/api/pods/${selectedPodId}/members`)
      .then((r) => r.json())
      .then((data) => setAgents(data))
      .catch(() => setAgents([]))
      .finally(() => setIsLoadingAgents(false));
  }, [selectedPodId]);

  const activeCompetition = useMemo(() => {
    return competitions.find((c) => {
      const s = c.startsAt ? new Date(c.startsAt) : new Date(0);
      const e = c.endsAt ? new Date(c.endsAt) : new Date();
      return selectedDate >= s && selectedDate <= e;
    });
  }, [competitions, selectedDate]);

  const handlePodChange = (podId: string) => {
    setSelectedPodId(podId);
    localStorage.setItem(LOG_POD_KEY, podId);
    setInputs({});
  };

  const handleDateChange = (date: Date | undefined) => {
    if (date) {
      const d = startOfDay(date);
      setSelectedDate(d);
      localStorage.setItem(LOG_DATE_KEY, d.toISOString());
      setInputs({});
    }
  };

  const handleInputChange = (userId: string, ruleId: string, value: string) => {
    if (value !== "" && !/^\d*$/.test(value)) return;
    setInputs((prev) => ({
      ...prev,
      [userId]: { ...(prev[userId] ?? {}), [ruleId]: value },
    }));
  };

  const adjustValue = (userId: string, ruleId: string, delta: number) => {
    setInputs((prev) => {
      const current = parseInt(prev[userId]?.[ruleId] || "0", 10) || 0;
      const next = Math.max(0, current + delta);
      return {
        ...prev,
        [userId]: { ...(prev[userId] ?? {}), [ruleId]: String(next) },
      };
    });
  };

  const handleSaveAll = async () => {
    if (!activeCompetition) return;
    setIsSaving(true);
    setMessage(null);

    const scoresToLog: { userId: string; score: number }[] = [];
    
    // Calculate total score changes
    for (const userId in inputs) {
      let totalPoints = 0;
      for (const ruleId in inputs[userId]) {
        const val = parseInt(inputs[userId][ruleId], 10);
        if (!isNaN(val) && val > 0) {
          const rule = activeCompetition.rules.find(r => r.id === ruleId);
          if (rule) totalPoints += val * rule.points;
        }
      }
      if (totalPoints > 0) {
        scoresToLog.push({ userId, score: totalPoints });
      }
    }

    try {
      if (scoresToLog.length === 0) throw new Error("No values to save");
      
      await Promise.all(scoresToLog.map(log => 
        fetch("/api/competitions/logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            competitionId: activeCompetition.id,
            userId: log.userId,
            score: log.score,
          }),
        })
      ));

      setMessage({ type: "success", text: "All scores submitted to leaderboard." });
      setInputs({});
    } catch {
      setMessage({ type: "error", text: "Failed to save points or no new points entered." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Date & Pod</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end justify-between">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="grid gap-2">
                <Label htmlFor="pod-select">Pod</Label>
                <Select onValueChange={handlePodChange} value={selectedPodId}>
                  <SelectTrigger id="pod-select" className="w-[200px]">
                    <SelectValue placeholder="Select Pod" />
                  </SelectTrigger>
                  <SelectContent>
                    {pods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date-select">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button id="date-select" variant="outline" className={cn("w-[200px] justify-start", !selectedDate && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "PPP") : "Pick date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[380px] p-0 z-50">
                    <Calendar mode="single" selected={selectedDate} onSelect={handleDateChange} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <Button onClick={handleSaveAll} disabled={isSaving || Object.keys(inputs).length === 0}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? "Saving..." : "Log Points"}
            </Button>
          </div>
          {message && (
            <p className={cn("mt-3 text-sm font-medium", message.type === "success" ? "text-green-500" : "text-destructive")}>
              {message.text}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Score Matrix */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5" /> Competitor Log</CardTitle>
          <CardDescription>
            {activeCompetition ? `Recording entries for: ${activeCompetition.name}` : "No active competition on this date."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAgents ? (
            <Skeleton className="h-[200px] w-full" />
          ) : !selectedPodId ? (
            <div className="text-center py-8 text-muted-foreground">Please select a pod.</div>
          ) : !activeCompetition ? (
            <div className="text-center py-8 text-muted-foreground">No active competition found for this date.</div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No agents in this pod.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="min-w-[150px]">Agent</TableHead>
                    {activeCompetition.rules.map((rule) => (
                      <TableHead key={rule.id} className="min-w-[180px] text-center" title={`${rule.points} pts`}>
                        {rule.title} <span className="text-xs text-muted-foreground">({rule.points}pt)</span>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      {activeCompetition.rules.map((rule) => (
                        <TableCell key={rule.id}>
                          <div className="flex items-center justify-center gap-1">
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 text-muted-foreground"
                              onClick={() => adjustValue(agent.id, rule.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <Input
                              type="text"
                              placeholder="0"
                              value={inputs[agent.id]?.[rule.id] ?? ""}
                              onChange={(e) => handleInputChange(agent.id, rule.id, e.target.value)}
                              className="h-8 w-14 text-center px-1"
                            />
                            <Button 
                              variant="outline" 
                              size="icon" 
                              className="h-8 w-8 text-primary"
                              onClick={() => adjustValue(agent.id, rule.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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
import { CalendarIcon, Filter, CheckSquare, Save, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Pod { id: string; name: string; }
interface Kpi { id: string; name: string; initials: string; type: string; }
interface Agent { id: string; name: string; }

interface KpiInputState {
  [userId: string]: { [kpiId: string]: { value: string; initialValue: string; } };
}

interface KpiLogResponse {
  id: string;
  kpiId: string;
  userId: string | null;
  value: number;
  date: string;       // When the KPI was achieved
  loggedAt: string;  // When it was imported
}

const LOG_POD_KEY = "perfLog_selectedPodId";
const LOG_DATE_KEY = "perfLog_selectedDate";

// UTC-based start/end of day
function startOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfDayUTC(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

export function PerformanceLogForm({
  pods,
  kpis,
  currentUserId,
}: {
  pods: Pod[];
  kpis: Kpi[];
  currentUserId: string;
}) {
  const [selectedPodId, setSelectedPodId] = useState("");
  const [selectedDate, setSelectedDate] = useState(startOfDay(new Date()));
  const [agents, setAgents] = useState<Agent[]>([]);
  const [inputs, setInputs] = useState<KpiInputState>({});
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const savedPod = localStorage.getItem(LOG_POD_KEY);
    if (savedPod) setSelectedPodId(savedPod);
    const savedDate = localStorage.getItem(LOG_DATE_KEY);
    if (savedDate) setSelectedDate(startOfDay(new Date(savedDate)));
  }, []);

  // Load agents when pod changes
  useEffect(() => {
    if (!selectedPodId) { setAgents([]); setInputs({}); return; }
    setIsLoadingAgents(true);
    fetch(`/api/pods/${selectedPodId}/members`)
      .then((r) => {
        if (r.status === 401) {
          // Session expired - redirect to login
          window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname);
          return [];
        }
        if (!r.ok) return [];
        return r.json();
      })
      .then((data) => setAgents(data || []))
      .catch(() => setAgents([]))
      .finally(() => setIsLoadingAgents(false));
  }, [selectedPodId]);

  // Load existing KPI logs when pod or date changes
  useEffect(() => {
    if (!selectedPodId || agents.length === 0) return;
    
    const startDate = startOfDayUTC(selectedDate).toISOString();
    const endDate = endOfDayUTC(selectedDate).toISOString();
    
    fetch(`/api/performance/kpi-logs?podId=${selectedPodId}&startDate=${startDate}&endDate=${endDate}`)
      .then((r) => {
        if (r.status === 401) {
          window.location.href = "/login?redirect=" + encodeURIComponent(window.location.pathname);
          return { logs: [] };
        }
        if (!r.ok) return { logs: [] };
        return r.json();
      })
      .then((data: { logs?: KpiLogResponse[] }) => {
        const logs = data.logs || [];
        const newInputs: KpiInputState = {};
        logs.forEach((log) => {
          if (!log.userId) return; // Skip logs without userId
          if (!newInputs[log.userId]) newInputs[log.userId] = {};
          const val = String(log.value);
          newInputs[log.userId][log.kpiId] = { value: val, initialValue: val };
        });
        setInputs(newInputs);
      })
      .catch(() => {});
  }, [selectedPodId, selectedDate, agents]);

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

  const handleInputChange = (userId: string, kpiId: string, value: string) => {
    setInputs((prev) => ({
      ...prev,
      [userId]: {
        ...(prev[userId] ?? {}),
        [kpiId]: { value, initialValue: prev[userId]?.[kpiId]?.initialValue ?? "" },
      },
    }));
  };

  const hasChanges = useMemo(() => {
    for (const userId in inputs) {
      for (const kpiId in inputs[userId]) {
        if (inputs[userId][kpiId].value !== inputs[userId][kpiId].initialValue) return true;
      }
    }
    return false;
  }, [inputs]);

  const handleSaveAll = async () => {
    setIsSaving(true);
    setMessage(null);
    const logs: { userId: string; kpiId: string; value: number; loggedAt: string }[] = [];
    for (const userId in inputs) {
      for (const kpiId in inputs[userId]) {
        const entry = inputs[userId][kpiId];
        if (entry.value === entry.initialValue) continue;
        const num = parseFloat(entry.value);
        if (isNaN(num)) continue;
        logs.push({ userId, kpiId, value: num, loggedAt: startOfDayUTC(selectedDate).toISOString() });
      }
    }

    if (logs.length === 0) {
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/performance/kpi-logs/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logs }),
      });
      if (!res.ok) throw new Error("Failed to save");
      setMessage({ type: "success", text: "All scores saved successfully." });
      // Update initialValues to reflect saved state
      setInputs((prev) => {
        const next = { ...prev };
        for (const userId in next) {
          for (const kpiId in next[userId]) {
            next[userId][kpiId] = { ...next[userId][kpiId], initialValue: next[userId][kpiId].value };
          }
        }
        return next;
      });
    } catch {
      setMessage({ type: "error", text: "Failed to save scores. Please try again." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Filters</CardTitle>
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
                    <Button
                      id="date-select"
                      variant="outline"
                      className={cn("w-[200px] justify-start", !selectedDate && "text-muted-foreground")}
                    >
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
            <Button onClick={handleSaveAll} disabled={isSaving || !hasChanges}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {isSaving ? "Saving..." : "Save All Scores"}
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
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CheckSquare className="h-5 w-5" /> Log Scores</CardTitle>
          <CardDescription>Enter daily scores for each agent against each KPI.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAgents ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !selectedPodId ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Please select a pod to begin.</p>
            </div>
          ) : agents.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-3">No agents found in the selected pod.</p>
              <Button asChild size="sm" variant="secondary"><a href="/settings/pods">Manage Pods</a></Button>
            </div>
          ) : kpis.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-3">No KPIs configured yet.</p>
              <Button asChild size="sm"><a href="/performance/kpis">Set Up KPIs</a></Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-background">
                  <TableRow>
                    <TableHead className="min-w-[150px]">Agent</TableHead>
                    {kpis.map((kpi) => (
                      <TableHead key={kpi.id} className="min-w-[100px] text-center" title={kpi.name}>
                        <div className="flex flex-col items-center">
                          <span className="font-semibold">{kpi.initials || kpi.name.slice(0, 4)}</span>
                          <span className="text-xs font-normal text-muted-foreground">{kpi.name.slice(0, 10)}{kpi.name.length > 10 ? '...' : ''}</span>
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agents.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      {kpis.map((kpi) => (
                        <TableCell key={kpi.id}>
                          <Input
                            type="number"
                            placeholder="—"
                            value={inputs[agent.id]?.[kpi.id]?.value ?? ""}
                            min={0}
                            step="0.01"
                            onChange={(e) => handleInputChange(agent.id, kpi.id, e.target.value)}
                            className="h-8 text-center"
                          />
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

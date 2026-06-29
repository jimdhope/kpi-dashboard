"use client";

import { useState } from "react";
import { CompetitionRecord } from "@/lib/contracts";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Plus } from "lucide-react";

interface CompetitionsAdminProps {
  initialCompetitions: CompetitionRecord[];
}

interface RuleForm {
  title: string;
  points: string;
}

interface TeamForm {
  name: string;
}

interface CompetitionFormState {
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
  rules: RuleForm[];
  teams: TeamForm[];
}

const emptyForm: CompetitionFormState = {
  name: "",
  description: "",
  startsAt: "",
  endsAt: "",
  rules: [{ title: "Win", points: "10" }],
  teams: [{ name: "Team A" }, { name: "Team B" }],
};

export function CompetitionsAdmin({ initialCompetitions }: CompetitionsAdminProps) {
  const [competitions, setCompetitions] = useState(initialCompetitions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompetitionFormState>(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(competition: CompetitionRecord) {
    setEditingId(competition.id);
    setForm({
      name: competition.name,
      description: competition.description ?? "",
      startsAt: competition.startsAt ? competition.startsAt.slice(0, 16) : "",
      endsAt: competition.endsAt ? competition.endsAt.slice(0, 16) : "",
      rules: competition.rules.map((rule) => ({ title: rule.title, points: String(rule.points) })),
      teams: competition.teams.map((team) => ({ name: team.name })),
    });
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const response = await fetch(editingId ? `/api/competitions/${editingId}` : "/api/competitions", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        description: form.description || null,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
        rules: form.rules.filter((rule) => rule.title.trim()).map((rule) => ({ title: rule.title, points: Number(rule.points) || 0 })),
        teams: form.teams.filter((team) => team.name.trim()).map((team) => ({ name: team.name })),
      }),
    });

    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to save competition.");
      return;
    }

    if (editingId) {
      setCompetitions((current) => current.map((competition) => (competition.id === payload.id ? payload : competition)));
    } else {
      setCompetitions((current) => [payload, ...current]);
    }

    resetForm();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Competitions</CardTitle>
          <CardDescription>
            Competition configuration, rules, teams, and standings now live in V3.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
            {competitions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No competitions created yet.</p>
            ) : (
              <div className="flex flex-col gap-4 pr-4">
                {competitions.map((competition) => (
                  <div
                    key={competition.id}
                    className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{competition.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          {competition.entries.length} entries
                        </span>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startEdit(competition)}
                      >
                        Edit
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {competition.description || "No description yet."}
                    </p>
                    <div className="text-xs text-muted-foreground mt-1">
                      {competition.rules.length} rules · {competition.teams.length} teams
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex flex-col gap-1">
            <CardTitle>{editingId ? "Edit competition" : "Create competition"}</CardTitle>
            <CardDescription>
              This gives V3 a real competition lifecycle instead of placeholder routes.
            </CardDescription>
          </div>
          {editingId && (
            <Button variant="outline" size="sm" onClick={resetForm}>
              New competition
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(event) =>
                  setForm((current) => ({ ...current, name: event.target.value }))
                }
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="startsAt">Starts at</Label>
                <Input
                  id="startsAt"
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      startsAt: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="endsAt">Ends at</Label>
                <Input
                  id="endsAt"
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      endsAt: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Rules</Label>
              <div className="flex flex-col gap-2 p-3 border rounded-md bg-background/50">
                {form.rules.map((rule, index) => (
                  <div key={`rule-${index}`} className="flex gap-2 items-center">
                    <Input
                      placeholder="Rule title"
                      value={rule.title}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          rules: current.rules.map((r, i) =>
                            i === index ? { ...r, title: event.target.value } : r
                          ),
                        }))
                      }
                      className="flex-grow"
                    />
                    <Input
                      type="number"
                      placeholder="Pts"
                      value={rule.points}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          rules: current.rules.map((r, i) =>
                            i === index ? { ...r, points: event.target.value } : r
                          ),
                        }))
                      }
                      className="w-20"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          rules: current.rules.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      rules: [...current.rules, { title: "", points: "0" }],
                    }))
                  }
                  className="mt-1"
                >
                  <Plus className="mr-2 h-3 w-3" /> Add rule
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label>Teams</Label>
              <div className="flex flex-col gap-2 p-3 border rounded-md bg-background/50">
                {form.teams.map((team, index) => (
                  <div key={`team-${index}`} className="flex gap-2 items-center">
                    <Input
                      placeholder="Team name"
                      value={team.name}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          teams: current.teams.map((t, i) =>
                            i === index ? { ...t, name: event.target.value } : t
                          ),
                        }))
                      }
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          teams: current.teams.filter((_, i) => i !== index),
                        }))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      teams: [...current.teams, { name: "" }],
                    }))
                  }
                  className="mt-1"
                >
                  <Plus className="mr-2 h-3 w-3" /> Add team
                </Button>
              </div>
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending
                ? "Saving..."
                : editingId
                ? "Update competition"
                : "Create competition"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

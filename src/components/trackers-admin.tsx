"use client";

import { useState } from "react";
import { AppCampaign, TrackerKpiRecord } from "@/lib/contracts";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TrackersAdminProps {
  initialTrackers: TrackerKpiRecord[];
  campaigns: AppCampaign[];
}

interface FormState {
  campaignId: string;
  name: string;
  unit: string;
  targetValue: string;
}

const emptyForm: FormState = {
  campaignId: "",
  name: "",
  unit: "",
  targetValue: "",
};

export function TrackersAdmin({ initialTrackers, campaigns }: TrackersAdminProps) {
  const [trackers, setTrackers] = useState(initialTrackers);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(tracker: TrackerKpiRecord) {
    setEditingId(tracker.id);
    setForm({
      campaignId: tracker.campaignId ?? "",
      name: tracker.name,
      unit: tracker.unit ?? "",
      targetValue: tracker.targetValue?.toString() ?? "",
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

    const response = await fetch(editingId ? `/api/trackers/${editingId}` : "/api/trackers", {
      method: editingId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        campaignId: form.campaignId || null,
        name: form.name,
        unit: form.unit || null,
        targetValue: form.targetValue ? Number(form.targetValue) : null,
      }),
    });

    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to save tracker.");
      return;
    }

    if (editingId) {
      setTrackers((current) => current.map((tracker) => (tracker.id === payload.id ? payload : tracker)));
    } else {
      setTrackers((current) => [...current, payload].sort((a, b) => a.name.localeCompare(b.name)));
    }

    resetForm();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Tracker KPIs</CardTitle>
          <CardDescription>
            Tracker definitions are now first-class relational records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {trackers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trackers created yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {trackers.map((tracker) => (
                <div
                  key={tracker.id}
                  className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{tracker.name}</span>
                      {tracker.campaignName && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                          {tracker.campaignName}
                        </span>
                      )}
                      {tracker.unit && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                          {tracker.unit}
                        </span>
                      )}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => startEdit(tracker)}
                    >
                      Edit
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Target: {tracker.targetValue ?? 0}
                  </p>
                  <div className="text-xs text-muted-foreground mt-1">
                    Updated {new Date(tracker.updatedAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="glass-card">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex flex-col gap-1">
            <CardTitle>{editingId ? "Edit tracker" : "Create tracker"}</CardTitle>
            <CardDescription>
              This is the V3 source of truth for KPI definitions and targets.
            </CardDescription>
          </div>
          {editingId && (
            <Button variant="outline" size="sm" onClick={resetForm}>
              New tracker
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="campaign">Campaign</Label>
              <Select
                value={form.campaignId}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, campaignId: value }))
                }
              >
                <SelectTrigger id="campaign">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {campaigns.map((campaign) => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(event) =>
                  setForm((current) => ({ ...current, unit: event.target.value }))
                }
                placeholder="calls, sales, points"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="targetValue">Target value</Label>
              <Input
                id="targetValue"
                type="number"
                step="0.01"
                value={form.targetValue}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    targetValue: event.target.value,
                  }))
                }
              />
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}

            <Button type="submit" disabled={pending} className="w-full">
              {pending
                ? "Saving..."
                : editingId
                ? "Update tracker"
                : "Create tracker"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

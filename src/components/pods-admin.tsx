"use client";

import { useState } from "react";
import { AppCampaign, AppPod, PodMembershipOption, TeamsWebhookRecord } from "@/lib/contracts";
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
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PodsAdminProps {
  initialPods: AppPod[];
  campaigns: AppCampaign[];
  membershipOptions: PodMembershipOption[];
  webhookOptions: TeamsWebhookRecord[];
}

interface FormState {
  campaignId: string;
  incomingWebhookId: string;
  outgoingWebhookId: string;
  name: string;
  description: string;
}

const emptyForm: FormState = {
  campaignId: "",
  incomingWebhookId: "",
  outgoingWebhookId: "",
  name: "",
  description: "",
};

export function PodsAdmin({ initialPods, campaigns, membershipOptions, webhookOptions }: PodsAdminProps) {
  const [pods, setPods] = useState(initialPods);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedMemberships, setSelectedMemberships] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(pod: AppPod) {
    setEditingId(pod.id);
    setForm({
      campaignId: pod.campaignId ?? "",
      incomingWebhookId: pod.incomingWebhookId ?? "",
      outgoingWebhookId: pod.outgoingWebhookId ?? "",
      name: pod.name,
      description: pod.description ?? "",
    });
    setSelectedMemberships(pod.members.map((member) => member.id));
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setSelectedMemberships([]);
    setError(null);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const url = editingId ? `/api/pods/${editingId}` : "/api/pods";
    const method = editingId ? "PATCH" : "POST";

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        campaignId: form.campaignId || null,
        incomingWebhookId: form.incomingWebhookId || null,
        outgoingWebhookId: form.outgoingWebhookId || null,
        name: form.name,
        description: form.description || null,
      }),
    });

    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to save pod.");
      return;
    }

    if (editingId) {
      setPods((current) => current.map((pod) => (pod.id === payload.id ? payload : pod)));
    } else {
      setPods((current) => [...current, payload].sort((a, b) => a.name.localeCompare(b.name)));
    }

    resetForm();
  }

  async function saveMemberships() {
    if (!editingId) {
      setError("Create or select a pod before assigning memberships.");
      return;
    }

    setPending(true);
    setError(null);

    const response = await fetch(`/api/pods/${editingId}/memberships`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userIds: selectedMemberships,
      }),
    });

    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to update memberships.");
      return;
    }

    setPods((current) => current.map((pod) => (pod.id === payload.id ? payload : pod)));
  }

  function toggleMembership(userId: string) {
    setSelectedMemberships((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId],
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Pods</CardTitle>
          <CardDescription>
            Pods sit under campaigns and will eventually own memberships and scoring scopes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-300px)] min-h-[400px]">
            {pods.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pods created yet.</p>
            ) : (
              <div className="flex flex-col gap-4 pr-4">
                {pods.map((pod) => (
                  <div
                    key={pod.id}
                    className="flex flex-col gap-2 p-4 rounded-lg border border-border bg-card/50 hover:bg-card/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{pod.name}</span>
                        {pod.campaignName && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                            {pod.campaignName}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => startEdit(pod)}
                      >
                        Edit
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {pod.description || "No description yet."}
                    </p>
                    <div className="text-xs text-muted-foreground mt-1">
                      {pod.memberCount} members · In:{" "}
                      {pod.incomingWebhookName ?? "none"} · Out:{" "}
                      {pod.outgoingWebhookName ?? "none"}
                    </div>
                    {pod.members.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {pod.members.map((member) => (
                          <span
                            key={member.id}
                            className="text-xs px-2 py-1 rounded-full bg-muted/50 border border-border"
                          >
                            {member.name}
                          </span>
                        ))}
                      </div>
                    )}
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
            <CardTitle>{editingId ? "Edit pod" : "Create pod"}</CardTitle>
            <CardDescription>
              Pods now own memberships directly inside the V3 relational model.
            </CardDescription>
          </div>
          {editingId && (
            <Button variant="outline" size="sm" onClick={resetForm}>
              New pod
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
              <Label htmlFor="incomingWebhook">Incoming Teams webhook</Label>
              <Select
                value={form.incomingWebhookId}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, incomingWebhookId: value }))
                }
              >
                <SelectTrigger id="incomingWebhook">
                  <SelectValue placeholder="Select webhook (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {webhookOptions
                    .filter(
                      (webhook) =>
                        webhook.direction === "incoming" && webhook.isActive
                    )
                    .map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        {webhook.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="outgoingWebhook">Outgoing Teams webhook</Label>
              <Select
                value={form.outgoingWebhookId}
                onValueChange={(value) =>
                  setForm((current) => ({ ...current, outgoingWebhookId: value }))
                }
              >
                <SelectTrigger id="outgoingWebhook">
                  <SelectValue placeholder="Select webhook (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {webhookOptions
                    .filter(
                      (webhook) =>
                        webhook.direction === "outgoing" && webhook.isActive
                    )
                    .map((webhook) => (
                      <SelectItem key={webhook.id} value={webhook.id}>
                        {webhook.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                rows={5}
              />
            </div>

            <div className="grid gap-2">
              <Label>Memberships</Label>
              <Card className="border-border/50 bg-background/50">
                <ScrollArea className="h-[200px] w-full rounded-md p-4">
                  <div className="flex flex-col gap-2">
                    {membershipOptions.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-start space-x-2 p-2 hover:bg-accent/50 rounded-md transition-colors"
                      >
                        <Checkbox
                          id={`user-${user.id}`}
                          checked={selectedMemberships.includes(user.id)}
                          onCheckedChange={() => toggleMembership(user.id)}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label
                            htmlFor={`user-${user.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {user.name}
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            {user.email} · {user.roles.join(", ")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </Card>
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button type="submit" disabled={pending} className="w-full">
                {pending
                  ? "Saving..."
                  : editingId
                  ? "Update pod"
                  : "Create pod"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={pending || !editingId}
                onClick={saveMemberships}
                className="w-full"
              >
                Save memberships
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

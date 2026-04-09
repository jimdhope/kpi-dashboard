"use client";

import { useState } from "react";
import { 
  TEAMS_CHANNEL_CATEGORIES, 
  TEAMS_WEBHOOK_DIRECTIONS, 
  TEAMS_CHANNEL_CATEGORY_LABELS,
  TEAMS_WEBHOOK_DIRECTION_LABELS,
  TeamsChannelCategory, 
  TeamsWebhookRecord, 
  TeamsWebhookDirection 
} from "@/lib/contracts";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, getStatusVariant } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, TestTube, Pencil, Trash2, Webhook as WebhookIcon } from "lucide-react";

interface TeamsWebhooksAdminProps {
  initialWebhooks: TeamsWebhookRecord[];
}

interface FormState {
  name: string;
  friendlyName: string;
  direction: TeamsWebhookDirection;
  category: TeamsChannelCategory;
  url: string;
  description: string;
  isActive: boolean;
}

const emptyForm: FormState = {
  name: "",
  friendlyName: "",
  direction: "outgoing",
  category: "custom",
  url: "",
  description: "",
  isActive: true,
};

export function TeamsWebhooksAdmin({ initialWebhooks }: TeamsWebhooksAdminProps) {
  const [webhooks, setWebhooks] = useState(initialWebhooks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(webhook: TeamsWebhookRecord) {
    setEditingId(webhook.id);
    setForm({
      name: webhook.name,
      friendlyName: webhook.friendlyName ?? "",
      direction: webhook.direction,
      category: webhook.category ?? "custom",
      url: webhook.url,
      description: webhook.description ?? "",
      isActive: webhook.isActive,
    });
    setError(null);
    setShowModal(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(false);
  }

  async function testConnection(webhookId: string) {
    setTestingId(webhookId);
    try {
      const response = await fetch(`/api/integrations/teams-webhooks/${webhookId}/test`, {
        method: 'POST',
      });
      const result = await response.json();
      
      // Refresh the webhooks list to show updated test status
      const refreshRes = await fetch('/api/integrations/teams-webhooks');
      const refreshed = await refreshRes.json();
      if (Array.isArray(refreshed)) {
        setWebhooks(refreshed);
      }
    } catch (err) {
      console.error('Test failed:', err);
    } finally {
      setTestingId(null);
    }
  }

  async function handleSubmit() {
    setPending(true);
    setError(null);

    const response = await fetch(editingId ? `/api/integrations/teams-webhooks/${editingId}` : "/api/integrations/teams-webhooks", {
      method: editingId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: form.name,
        friendlyName: form.friendlyName || null,
        direction: form.direction,
        category: form.category,
        url: form.url,
        description: form.description || null,
        isActive: form.isActive,
      }),
    });

    const payload = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(payload.error ?? "Failed to save webhook.");
      return;
    }

    if (editingId) {
      setWebhooks((current) => current.map((webhook) => (webhook.id === payload.id ? payload : webhook)));
    } else {
      setWebhooks((current) => [...current, payload].sort((a, b) => a.name.localeCompare(b.name)));
    }

    resetForm();
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this webhook?")) return;
    
    setPending(true);
    const response = await fetch(`/api/integrations/teams-webhooks/${id}`, {
      method: "DELETE",
    });
    setPending(false);

    if (response.ok) {
      setWebhooks((current) => current.filter((w) => w.id !== id));
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Teams Channels</CardTitle>
          <CardDescription>
            Manage webhook endpoints for sending messages to Teams channels.
          </CardDescription>
        </div>
        <Button onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Channel
        </Button>
      </CardHeader>
      <CardContent>
        {webhooks.length === 0 ? (
          <EmptyState
            icon={WebhookIcon}
            title="No channels yet"
            description="Create a Teams webhook endpoint to start sending messages to channels."
            action={{
              label: "Create Channel",
              onClick: startCreate,
            }}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Test</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell>
                    <div className="font-medium">{webhook.friendlyName || webhook.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {webhook.url}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={webhook.direction === "outgoing" ? "default" : "pending"} size="sm">
                      {TEAMS_WEBHOOK_DIRECTION_LABELS[webhook.direction]}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {webhook.category && (
                      <StatusBadge status="default" size="sm">
                        {TEAMS_CHANNEL_CATEGORY_LABELS[webhook.category]}
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={webhook.isActive ? "active" : "inactive"} size="sm" />
                  </TableCell>
                  <TableCell>
                    {webhook.testStatus && (
                      <StatusBadge status={getStatusVariant(webhook.testStatus) || "default"} size="sm">
                        {webhook.testStatus}
                      </StatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => testConnection(webhook.id)}
                        disabled={testingId === webhook.id}
                      >
                        <TestTube className="mr-1 h-3 w-3" />
                        {testingId === webhook.id ? "Testing..." : "Test"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(webhook)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(webhook.id)}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Channel" : "Create New Channel"}</DialogTitle>
            <DialogDescription>
              Configure a webhook endpoint to send messages to a Teams channel.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                required
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                placeholder="e.g., general-webhook"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="friendlyName">Display Name</Label>
              <Input
                id="friendlyName"
                value={form.friendlyName}
                onChange={(e) => setForm((current) => ({ ...current, friendlyName: e.target.value }))}
                placeholder="e.g., General Channel"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="direction">Direction</Label>
                <Select
                  value={form.direction}
                  onValueChange={(value) => setForm((current) => ({ ...current, direction: value as TeamsWebhookDirection }))}
                >
                  <SelectTrigger id="direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAMS_WEBHOOK_DIRECTIONS.map((direction) => (
                      <SelectItem key={direction} value={direction}>
                        {TEAMS_WEBHOOK_DIRECTION_LABELS[direction]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((current) => ({ ...current, category: value as TeamsChannelCategory }))}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAMS_CHANNEL_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category}>
                        {TEAMS_CHANNEL_CATEGORY_LABELS[category]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url">Webhook URL</Label>
              <Input
                id="url"
                required
                type="url"
                value={form.url}
                onChange={(e) => setForm((current) => ({ ...current, url: e.target.value }))}
                placeholder="https://outlook.office.com/webhook/..."
              />
              <p className="text-xs text-muted-foreground">
                Get this from your Teams channel's webhook configuration.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={form.description}
                onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
                placeholder="What is this channel used for?"
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="isActive"
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
              />
              <Label htmlFor="isActive">Enable this channel</Label>
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? "Saving..." : editingId ? "Update Channel" : "Create Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

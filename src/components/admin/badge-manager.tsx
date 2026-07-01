'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, Loader2, X, GripVertical, AlertCircle } from "lucide-react";

const EMOJIS = [
  "🏆", "🥇", "🥈", "🥉", "⭐", "🌟", "🔥", "💯", "👑",
  "🎯", "🎖️", "🏅", "💎", "🔱", "⚡", "🛡️", "🎪", "🎭",
  "🌈", "🌊", "🔥", "💪", "🧠", "🎨", "🎵", "📈", "🚀",
  "💥", "✨", "🎉", "🎊", "🏁", "🎲", "♟️", "🔮", "💫",
];

const FIELD_OPTIONS = [
  { value: "rank", label: "Rank" },
  { value: "totalScore", label: "Total Score" },
  { value: "improvement", label: "Rank Improvement" },
  { value: "wasPresent", label: "Was Present" },
  { value: "streak", label: "Win Streak" },
  { value: "totalCompetitions", label: "Total Competitions" },
];

const OPERATOR_OPTIONS = [
  { value: "eq", label: "=" },
  { value: "neq", label: "≠" },
  { value: "gt", label: ">" },
  { value: "gte", label: "≥" },
  { value: "lt", label: "<" },
  { value: "lte", label: "≤" },
];

const SCOPE_OPTIONS = [
  { value: "COMPETITION", label: "Per Competition" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "YEARLY", label: "Yearly" },
  { value: "MANUAL", label: "Manual Only" },
];

interface CriteriaRule {
  op?: "and" | "or";
  field?: string;
  operator?: string;
  value?: number | boolean | string;
  rules?: CriteriaRule[];
}

interface BadgeData {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  iconType: string;
  scope: string;
  criteria: CriteriaRule | null;
  rankTinted: boolean;
  isActive: boolean;
  sortOrder: number;
}

function generateKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "badge";
}

function newLeafRule(): CriteriaRule {
  return { field: "rank", operator: "eq", value: 1 };
}

function newGroupRule(op: "and" | "or"): CriteriaRule {
  return { op, rules: [newLeafRule()] };
}

function RuleBuilder({ rule, onChange, onRemove, depth }: {
  rule: CriteriaRule;
  onChange: (r: CriteriaRule) => void;
  onRemove?: () => void;
  depth: number;
}) {
  const isGroup = rule.op === "and" || rule.op === "or";

  if (isGroup) {
    const rules = rule.rules ?? [];

    const addRule = () => {
      onChange({ ...rule, rules: [...rules, newLeafRule()] });
    };

    const addGroup = (op: "and" | "or") => {
      onChange({ ...rule, rules: [...rules, newGroupRule(op)] });
    };

    const updateChild = (index: number, child: CriteriaRule) => {
      const updated = [...rules];
      updated[index] = child;
      onChange({ ...rule, rules: updated });
    };

    const removeChild = (index: number) => {
      const updated = rules.filter((_, i) => i !== index);
      onChange({ ...rule, rules: updated.length > 0 ? updated : [newLeafRule()] });
    };

    return (
      <div className={`border rounded-lg p-3 space-y-2 ${depth > 0 ? "ml-4 border-dashed" : ""}`}>
        <div className="flex items-center gap-2">
          <select
            className="text-xs font-medium bg-muted rounded px-2 py-1 border"
            value={rule.op}
            onChange={e => onChange({ ...rule, op: e.target.value as "and" | "or" })}
          >
            <option value="and">ALL</option>
            <option value="or">ANY</option>
          </select>
          <span className="text-xs text-muted-foreground">of the following:</span>
          {onRemove && depth > 0 && (
            <button onClick={onRemove} className="ml-auto text-muted-foreground hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        <div className="space-y-2">
          {rules.map((child, i) => (
            <RuleBuilder
              key={i}
              rule={child}
              onChange={(c) => updateChild(i, c)}
              onRemove={() => removeChild(i)}
              depth={depth + 1}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={addRule}>+ Rule</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addGroup("and")}>+ Group (ALL)</Button>
          <Button type="button" variant="outline" size="sm" onClick={() => addGroup("or")}>+ Group (ANY)</Button>
        </div>
      </div>
    );
  }

  const isBoolField = rule.field === "wasPresent";

  return (
    <div className={`flex items-center gap-2 flex-wrap ${depth > 0 ? "ml-4" : ""}`}>
      <select
        className="text-sm bg-muted rounded px-2 py-1 border"
        value={rule.field ?? "rank"}
        onChange={e => onChange({ ...rule, field: e.target.value, value: e.target.value === "wasPresent" ? true : rule.value ?? 1 })}
      >
        {FIELD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {!isBoolField && (
        <select
          className="text-sm bg-muted rounded px-2 py-1 border"
          value={rule.operator ?? "eq"}
          onChange={e => onChange({ ...rule, operator: e.target.value })}
        >
          {OPERATOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {!isBoolField ? (
        <Input
          type="number"
          className="w-20 h-8 text-sm"
          value={String(rule.value ?? 0)}
          onChange={e => onChange({ ...rule, value: parseInt(e.target.value, 10) || 0 })}
        />
      ) : (
        <select
          className="text-sm bg-muted rounded px-2 py-1 border"
          value={rule.value ? "true" : "false"}
          onChange={e => onChange({ ...rule, value: e.target.value === "true" })}
        >
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )}
      {onRemove && depth > 0 && (
        <button onClick={onRemove} className="text-muted-foreground hover:text-destructive">
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

interface BadgeManagerProps {
  onBadgeChange?: () => void;
}

export default function BadgeManager({ onBadgeChange }: BadgeManagerProps) {
  const { toast } = useToast();
  const [badges, setBadges] = useState<BadgeData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingBadge, setEditingBadge] = useState<BadgeData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formKey, setFormKey] = useState("");
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formIcon, setFormIcon] = useState("🏆");
  const [formScope, setFormScope] = useState("COMPETITION");
  const [formCriteria, setFormCriteria] = useState<CriteriaRule | null>(null);
  const [formRankTinted, setFormRankTinted] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formSortOrder, setFormSortOrder] = useState(0);
  const [formKeyLocked, setFormKeyLocked] = useState(false);

  const fetchBadges = useCallback(async () => {
    try {
      const res = await fetch('/api/gamification/admin/badges/manage');
      if (res.ok) {
        const data = await res.json();
        setBadges(data.badges ?? []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchBadges(); }, [fetchBadges]);

  const resetForm = () => {
    setFormKey("");
    setFormName("");
    setFormDescription("");
    setFormIcon("🏆");
    setFormScope("COMPETITION");
    setFormCriteria(null);
    setFormRankTinted(false);
    setFormIsActive(true);
    setFormSortOrder(0);
    setFormKeyLocked(false);
    setEditingBadge(null);
    setIsCreating(false);
  };

  const openCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const openEdit = (badge: BadgeData) => {
    setEditingBadge(badge);
    setFormKey(badge.key);
    setFormName(badge.name);
    setFormDescription(badge.description ?? "");
    setFormIcon(badge.icon ?? "🏆");
    setFormScope(badge.scope);
    setFormCriteria(badge.criteria);
    setFormRankTinted(badge.rankTinted);
    setFormIsActive(badge.isActive);
    setFormSortOrder(badge.sortOrder);
    setFormKeyLocked(true);
    setIsCreating(true);
  };

  const handleNameChange = (name: string) => {
    setFormName(name);
    if (!formKeyLocked) {
      setFormKey(generateKey(name));
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!formKey.trim()) {
      toast({ title: "Key is required", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        key: formKey,
        name: formName.trim(),
        description: formDescription.trim(),
        icon: formIcon,
        iconType: "emoji",
        scope: formScope,
        criteria: formScope !== "MANUAL" && formCriteria ? formCriteria : null,
        rankTinted: formRankTinted,
        isActive: formIsActive,
        sortOrder: formSortOrder,
      };

      if (editingBadge) {
        const res = await fetch(`/api/gamification/admin/badges/manage/${editingBadge.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to update");
        }
        toast({ title: "Badge updated" });
      } else {
        const res = await fetch('/api/gamification/admin/badges/manage', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error ?? "Failed to create");
        }
        toast({ title: "Badge created" });
      }

      resetForm();
      await fetchBadges();
      onBadgeChange?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (badge: BadgeData) => {
    if (!confirm(`Delete "${badge.name}"? This will also remove it from all agents.`)) return;

    try {
      const res = await fetch(`/api/gamification/admin/badges/manage/${badge.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: `"${badge.name}" deleted` });
      await fetchBadges();
      onBadgeChange?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleToggleActive = async (badge: BadgeData) => {
    try {
      await fetch(`/api/gamification/admin/badges/manage/${badge.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !badge.isActive }),
      });
      await fetchBadges();
    } catch {
      toast({ title: "Failed to toggle", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isCreating) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>{editingBadge ? "Edit Badge" : "Create Badge"}</CardTitle>
          <CardDescription>Define a new badge and its award criteria.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formName} onChange={e => handleNameChange(e.target.value)} placeholder="e.g. Podium Finish" />
            </div>
            <div className="space-y-2">
              <Label>Key (auto-generated)</Label>
              <Input value={formKey} onChange={e => setFormKey(e.target.value)} placeholder="e.g. podium_finish" className="font-mono text-xs" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="What does this badge represent?" rows={2} />
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex items-center gap-4">
              <div className="text-4xl w-14 h-14 flex items-center justify-center rounded-lg border bg-muted/30">{formIcon}</div>
              <div className="flex-1">
                <div className="grid grid-cols-10 gap-1">
                  {EMOJIS.map(emoji => (
                    <button
                      key={emoji}
                      type="button"
                      className={`w-8 h-8 text-lg flex items-center justify-center rounded hover:bg-muted transition-colors ${formIcon === emoji ? "bg-primary/20 ring-2 ring-primary" : ""}`}
                      onClick={() => setFormIcon(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={formScope} onValueChange={v => setFormScope(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SCOPE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input type="number" value={formSortOrder} onChange={e => setFormSortOrder(parseInt(e.target.value, 10) || 0)} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={formRankTinted} onCheckedChange={setFormRankTinted} id="rankTinted" />
              <Label htmlFor="rankTinted">Rank-tinted (gold/silver/bronze shield)</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formIsActive} onCheckedChange={setFormIsActive} id="isActive" />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          {formScope !== "MANUAL" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>Award Criteria</Label>
                {!formCriteria && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setFormCriteria(newGroupRule("and"))}>
                    Add Criteria
                  </Button>
                )}
              </div>
              {formCriteria && (
                <div className="relative">
                  <RuleBuilder
                    rule={formCriteria}
                    onChange={setFormCriteria}
                    depth={0}
                  />
                </div>
              )}
            </div>
          )}

          {formScope === "MANUAL" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
              <AlertCircle className="h-4 w-4" />
              Manual badges are awarded by an admin, not automatically.
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {editingBadge ? "Update" : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{badges.length} badge{badges.length === 1 ? "" : "s"} defined</p>
        <Button onClick={openCreate} size="sm">
          <Plus className="h-4 w-4 mr-2" /> New Badge
        </Button>
      </div>
      {badges.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-muted-foreground mb-4">No badges defined yet.</p>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" /> Create First Badge</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {badges.map(badge => (
            <Card key={badge.id} className={`${!badge.isActive ? "opacity-50" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-3xl w-10 h-10 flex items-center justify-center shrink-0">{badge.icon ?? "🏆"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{badge.name}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted uppercase">{badge.scope}</span>
                      {badge.rankTinted && <span className="text-[10px] text-amber-500">✦</span>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{badge.description}</p>
                    {badge.criteria && (
                      <p className="text-[10px] text-muted-foreground/60 mt-1 font-mono truncate">
                        {badge.criteria.op === "and" ? "ALL" : "ANY"} ({badge.criteria.rules?.length ?? 0} rule{(badge.criteria.rules?.length ?? 0) === 1 ? "" : "s"})
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-2 border-t">
                  <button
                    onClick={() => handleToggleActive(badge)}
                    className={`text-xs px-2 py-1 rounded ${badge.isActive ? "text-green-600 bg-green-50 hover:bg-green-100" : "text-muted-foreground bg-muted hover:bg-muted/80"}`}
                  >
                    {badge.isActive ? "Active" : "Inactive"}
                  </button>
                  <button onClick={() => openEdit(badge)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted">
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button onClick={() => handleDelete(badge)} className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

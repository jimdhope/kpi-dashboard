"use client";

import { useState } from "react";
import { 
  TEAMS_CHANNEL_CATEGORIES, 
  TEAMS_AUTOMATION_DELIVERY_FORMATS, 
  TEAMS_CHANNEL_CATEGORY_LABELS,
  TEAMS_AUTOMATION_DELIVERY_FORMAT_LABELS,
  TeamsChannelCategory, 
  TeamsMessageTemplateRecord, 
  TeamsAutomationDeliveryFormat,
  TeamsAutomationFactTemplate
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { VariablePills, MESSAGE_VARIABLES } from "@/components/variable-pills";
import { Plus, Pencil, Trash2, LayoutTemplate } from "lucide-react";

// Image metric options for dropdown
const IMAGE_METRIC_OPTIONS = [
  { value: "none", label: "None" },
  { value: "{{agentScore}}", label: "Agent Score" },
  { value: "{{agentRank}}", label: "Agent Rank" },
  { value: "{{totalScore}}", label: "Total Score" },
  { value: "{{changeScore}}", label: "Score Change" },
  { value: "{{competitionGoal}}", label: "Competition Goal" },
  { value: "custom", label: "Custom..." },
] as const;

interface TeamsTemplatesAdminProps {
  initialTemplates: TeamsMessageTemplateRecord[];
}

interface FactItem {
  name: string;
  valueTemplate: string;
}

interface TemplateFormState {
  name: string;
  category: TeamsChannelCategory | "";
  deliveryFormat: TeamsAutomationDeliveryFormat;
  titleTemplate: string;
  messageTemplate: string;
  facts: FactItem[];
  imageTitleTemplate: string;
  imageSubtitleTemplate: string;
  imageMetricTemplate: string;
  imageFooterTemplate: string;
  imageAccentColor: string;
  isDefault: boolean;
  isActive: boolean;
}

const emptyForm: TemplateFormState = {
  name: "",
  category: "",
  deliveryFormat: "adaptiveCard",
  titleTemplate: "",
  messageTemplate: "",
  facts: [],
  imageTitleTemplate: "",
  imageSubtitleTemplate: "",
  imageMetricTemplate: "",
  imageFooterTemplate: "",
  imageAccentColor: "",
  isDefault: false,
  isActive: true,
};

export function TeamsTemplatesAdmin({ initialTemplates }: TeamsTemplatesAdminProps) {
  const [templates, setTemplates] = useState(initialTemplates);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");
  const [form, setForm] = useState<TemplateFormState>(emptyForm);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredTemplates = selectedCategory === "all"
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  function startEdit(template: TeamsMessageTemplateRecord) {
    setEditingId(template.id);
    setForm({
      name: template.name,
      category: template.category ?? "",
      deliveryFormat: template.deliveryFormat,
      titleTemplate: template.titleTemplate,
      messageTemplate: template.messageTemplate,
      facts: template.facts.map(f => ({ name: f.name, valueTemplate: f.valueTemplate })),
      imageTitleTemplate: template.imageTitleTemplate ?? "",
      imageSubtitleTemplate: template.imageSubtitleTemplate ?? "",
      imageMetricTemplate: template.imageMetricTemplate ?? "",
      imageFooterTemplate: template.imageFooterTemplate ?? "",
      imageAccentColor: template.imageAccentColor ?? "",
      isDefault: template.isDefault,
      isActive: template.isActive,
    });
    setActiveTab("edit");
    setError(null);
    setShowModal(true);
  }

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setActiveTab("edit");
    setError(null);
    setShowModal(true);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setActiveTab("edit");
    setError(null);
    setShowModal(false);
  }

  function addFact() {
    setForm((current) => ({
      ...current,
      facts: [...current.facts, { name: "", valueTemplate: "" }],
    }));
  }

  function updateFact(index: number, field: keyof FactItem, value: string) {
    setForm((current) => ({
      ...current,
      facts: current.facts.map((fact, i) => 
        i === index ? { ...fact, [field]: value } : fact
      ),
    }));
  }

  function removeFact(index: number) {
    setForm((current) => ({
      ...current,
      facts: current.facts.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit() {
    setPending(true);
    setError(null);

    const payload = {
      name: form.name,
      category: form.category || null,
      deliveryFormat: form.deliveryFormat,
      titleTemplate: form.titleTemplate,
      messageTemplate: form.messageTemplate,
      facts: form.facts.filter(f => f.name && f.valueTemplate),
      imageTitleTemplate: form.imageTitleTemplate || null,
      imageSubtitleTemplate: form.imageSubtitleTemplate || null,
      imageMetricTemplate: form.imageMetricTemplate || null,
      imageFooterTemplate: form.imageFooterTemplate || null,
      imageAccentColor: form.imageAccentColor || null,
      isDefault: form.isDefault,
      isActive: form.isActive,
    };

    const response = await fetch(
      editingId 
        ? `/api/integrations/teams-message-templates/${editingId}` 
        : "/api/integrations/teams-message-templates",
      {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const result = await response.json();
    setPending(false);

    if (!response.ok) {
      setError(result.error ?? "Failed to save template.");
      return;
    }

    if (editingId) {
      setTemplates((current) => current.map((t) => (t.id === result.id ? result : t)));
    } else {
      setTemplates((current) => [...current, result].sort((a, b) => a.name.localeCompare(b.name)));
    }

    resetForm();
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this template?")) return;
    
    setPending(true);
    const response = await fetch(`/api/integrations/teams-message-templates/${id}`, {
      method: "DELETE",
    });
    setPending(false);

    if (response.ok) {
      setTemplates((current) => current.filter((t) => t.id !== id));
    }
  }

  async function setAsDefault(id: string) {
    setPending(true);
    const response = await fetch(`/api/integrations/teams-message-templates/${id}/set-default`, {
      method: "POST",
    });
    setPending(false);

    if (response.ok) {
      const res = await fetch("/api/integrations/teams-message-templates");
      const refreshed = await res.json();
      if (Array.isArray(refreshed)) {
        setTemplates(refreshed);
      }
    }
  }

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Message Templates</CardTitle>
          <CardDescription>
            Create and manage templates for Teams messages.
          </CardDescription>
        </div>
        <Button onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="mb-4 flex flex-wrap">
            <TabsTrigger value="all">All</TabsTrigger>
            {TEAMS_CHANNEL_CATEGORIES.map((cat) => (
              <TabsTrigger key={cat} value={cat}>
                {TEAMS_CHANNEL_CATEGORY_LABELS[cat]}
              </TabsTrigger>
            ))}
          </TabsList>

          {["all", ...TEAMS_CHANNEL_CATEGORIES].map((cat) => (
            <TabsContent key={cat} value={cat}>
              {filteredTemplates.length === 0 ? (
                <EmptyState
                  icon={LayoutTemplate}
                  title="No templates yet"
                  description="Create a message template to send formatted messages to Teams channels."
                  action={{
                    label: "Create Template",
                    onClick: startCreate,
                  }}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTemplates.map((template) => (
                      <TableRow key={template.id}>
                        <TableCell>
                          <div className="font-medium">{template.name}</div>
                          <div className="text-xs text-muted-foreground truncate max-w-[250px]">
                            {template.titleTemplate}
                          </div>
                        </TableCell>
                        <TableCell>
                          {template.category && (
                            <StatusBadge status="default" size="sm">
                              {TEAMS_CHANNEL_CATEGORY_LABELS[template.category]}
                            </StatusBadge>
                          )}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status="pending" size="sm">
                            {TEAMS_AUTOMATION_DELIVERY_FORMAT_LABELS[template.deliveryFormat]}
                          </StatusBadge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={template.isActive ? "active" : "inactive"} size="sm" />
                            {template.isDefault && (
                              <StatusBadge status="warning" size="sm">Default</StatusBadge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!template.isDefault && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setAsDefault(template.id)}
                              >
                                Set Default
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => startEdit(template)}
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-600"
                              onClick={() => handleDelete(template.id)}
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
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>

      {/* Create/Edit Modal */}
      <Dialog open={showModal} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Template" : "Create New Template"}</DialogTitle>
            <DialogDescription>
              Define a message template for sending to Teams channels.
            </DialogDescription>
          </DialogHeader>
          
          {/* Tabs to switch between Edit and Preview - shown on all screen sizes */}
          <Tabs 
            value={activeTab} 
            onValueChange={(v) => setActiveTab(v as "edit" | "preview")}
            className="mx-4"
          >
            <TabsList className="w-full">
              <TabsTrigger value="edit" className="flex-1">Edit Form</TabsTrigger>
              <TabsTrigger value="preview" className="flex-1">Preview</TabsTrigger>
            </TabsList>
            
            {/* Edit Form Tab */}
            <TabsContent value="edit" className="mt-4 max-h-[calc(90vh-280px)] overflow-y-auto px-1">
              <div className="grid grid-cols-2 gap-4">
                <Label htmlFor="name">Template Name</Label>
                <Input
                  id="name"
                  required
                  value={form.name}
                  onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                  placeholder="e.g., Daily Summary - Compact"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((current) => ({ ...current, category: value as TeamsChannelCategory }))}
                >
                  <SelectTrigger id="category">
                    <SelectValue placeholder="Select category" />
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

              <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="deliveryFormat">Delivery Format</Label>
                <Select
                  value={form.deliveryFormat}
                  onValueChange={(value) => setForm((current) => ({ ...current, deliveryFormat: value as TeamsAutomationDeliveryFormat }))}
                >
                  <SelectTrigger id="deliveryFormat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAMS_AUTOMATION_DELIVERY_FORMATS.map((format) => (
                      <SelectItem key={format} value={format}>
                        {TEAMS_AUTOMATION_DELIVERY_FORMAT_LABELS[format]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="titleTemplate">Title</Label>
                <Input
                  id="titleTemplate"
                  required
                  value={form.titleTemplate}
                  onChange={(e) => setForm((current) => ({ ...current, titleTemplate: e.target.value }))}
                  placeholder="e.g., Daily KPI Update"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="messageTemplate">Message</Label>
              <VariablePills 
                onInsert={(code) => setForm((current) => ({ 
                  ...current, 
                  messageTemplate: current.messageTemplate + code 
                }))} 
              />
              <Textarea
                id="messageTemplate"
                required
                rows={3}
                value={form.messageTemplate}
                onChange={(e) => setForm((current) => ({ ...current, messageTemplate: e.target.value }))}
                placeholder="Your message content. Use {{variable}} for dynamic values."
              />
              <p className="text-xs text-muted-foreground">
                Click a pill above to insert a variable, or use {"{{variable}}"} placeholders.
              </p>
            </div>

            {/* Facts Section */}
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Key Facts (optional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addFact}>
                  <Plus className="mr-1 h-3 w-3" /> Add Fact
                </Button>
              </div>
              {form.facts.map((fact, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    placeholder="Label (e.g., Total Score)"
                    value={fact.name}
                    onChange={(e) => updateFact(index, "name", e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Value (e.g., {{score}})"
                    value={fact.valueTemplate}
                    onChange={(e) => updateFact(index, "valueTemplate", e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFact(index)}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            {/* Image fields (for adaptiveCardWithImage format) */}
            {(form.deliveryFormat === "adaptiveCardWithImage" || form.deliveryFormat === "adaptiveCard") && (
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div className="grid gap-2">
                  <Label htmlFor="imageTitleTemplate">Image Title</Label>
                  <Input
                    id="imageTitleTemplate"
                    value={form.imageTitleTemplate}
                    onChange={(e) => setForm((current) => ({ ...current, imageTitleTemplate: e.target.value }))}
                    placeholder="Title for image card"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="imageMetricTemplate">Metric (for Hero Image)</Label>
                  <p className="text-xs text-muted-foreground -mt-1">
                    Displays a large number at the top of the card (e.g., score, rank)
                  </p>
                  <Select
                    value={IMAGE_METRIC_OPTIONS.find(o => o.value === form.imageMetricTemplate) ? form.imageMetricTemplate : (form.imageMetricTemplate ? "custom" : "none")}
                    onValueChange={(value) => setForm((current) => ({ 
                      ...current, 
                      imageMetricTemplate: value === "custom" ? current.imageMetricTemplate : (value === "none" ? "" : value)
                    }))}
                  >
                    <SelectTrigger id="imageMetricTemplate">
                      <SelectValue placeholder="Select metric" />
                    </SelectTrigger>
                    <SelectContent>
                      {IMAGE_METRIC_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(form.imageMetricTemplate && form.imageMetricTemplate !== "none" && !IMAGE_METRIC_OPTIONS.find(o => o.value === form.imageMetricTemplate)) && (
                    <Input
                      value={form.imageMetricTemplate}
                      onChange={(e) => setForm((current) => ({ ...current, imageMetricTemplate: e.target.value }))}
                      placeholder="Custom metric variable"
                      className="mt-2"
                    />
                  )}
                  {/* Variable pills for image metric */}
                  {form.deliveryFormat === "adaptiveCardWithImage" && (
                    <VariablePills
                      variables={MESSAGE_VARIABLES.filter(v => 
                        v.code.includes("Score") || v.code.includes("Rank") || v.code.includes("Goal") || v.code.includes("Total")
                      )}
                      onSelect={(varName) => setForm((current) => ({ 
                        ...current, 
                        imageMetricTemplate: varName 
                      }))}
                      compact
                    />
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="imageSubtitleTemplate">Image Subtitle</Label>
                  <Input
                    id="imageSubtitleTemplate"
                    value={form.imageSubtitleTemplate}
                    onChange={(e) => setForm((current) => ({ ...current, imageSubtitleTemplate: e.target.value }))}
                    placeholder="Subtitle"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="imageFooterTemplate">Image Footer</Label>
                  <Input
                    id="imageFooterTemplate"
                    value={form.imageFooterTemplate}
                    onChange={(e) => setForm((current) => ({ ...current, imageFooterTemplate: e.target.value }))}
                    placeholder="Footer text"
                  />
                </div>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  id="isDefault"
                  checked={form.isDefault}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, isDefault: checked }))}
                />
                <Label htmlFor="isDefault">Set as default for category</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="isActive"
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
                />
                <Label htmlFor="isActive">Template is active</Label>
              </div>
            </div>

            {error && (
              <div className="text-sm font-medium text-destructive">{error}</div>
            )}
            </TabsContent>
            
            {/* Preview Tab */}
            <TabsContent value="preview" className="mt-4 max-h-[calc(90vh-280px)] overflow-y-auto px-1">
              <div className="sticky top-0">
                <p className="text-sm text-muted-foreground mb-4">Live preview of your Teams message</p>
              
              {/* Teams Message Preview Card */}
              <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900 shadow-sm">
                {/* Hero Image Preview (if configured) */}
                {(form.deliveryFormat === "adaptiveCardWithImage" && (form.imageTitleTemplate || form.imageMetricTemplate || form.imageSubtitleTemplate)) && (
                  <div className="relative bg-gradient-to-br from-green-600 to-green-700 p-4 text-white">
                    {form.imageTitleTemplate && (
                      <div className="text-lg font-bold">{form.imageTitleTemplate || "Title"}</div>
                    )}
                    {form.imageMetricTemplate && form.imageMetricTemplate !== "none" && (
                      <div className="text-4xl font-bold mt-1">
                        {form.imageMetricTemplate.replace(/\{\{/g, "").replace(/\}\}/g, "") || "123"}
                      </div>
                    )}
                    {form.imageSubtitleTemplate && (
                      <div className="text-sm opacity-90 mt-1">{form.imageSubtitleTemplate}</div>
                    )}
                    {form.imageFooterTemplate && (
                      <div className="text-xs opacity-75 mt-2">{form.imageFooterTemplate}</div>
                    )}
                  </div>
                )}
                
                {/* Message Body */}
                <div className="p-4">
                  {/* Title */}
                  <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {form.titleTemplate || "Your Title Here"}
                  </div>
                  
                  {/* Message */}
                  <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {form.messageTemplate || "Your message content will appear here..."}
                  </div>
                  
                  {/* Facts Table Preview */}
                  {form.facts.length > 0 && (
                    <div className="mt-4 border-t pt-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Details</div>
                      <div className="space-y-1">
                        {form.facts.slice(0, 4).map((fact, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-gray-500">{fact.name}:</span>
                            <span className="font-medium">{fact.valueTemplate || "value"}</span>
                          </div>
                        ))}
                        {form.facts.length > 4 && (
                          <div className="text-xs text-gray-400">+{form.facts.length - 4} more...</div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Format Badge */}
                  <div className="mt-4 pt-3 border-t flex items-center justify-between">
                    <span className="text-xs text-gray-400">Format:</span>
                    <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                      {TEAMS_AUTOMATION_DELIVERY_FORMAT_LABELS[form.deliveryFormat]}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Tips */}
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-xs text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Tips:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Use variables like {"{{agentName}}"} to personalize messages</li>
                  <li>Preview shows sample data - actual values come from your automations</li>
                  <li>Select "Hero Image" format to add a large metric display at the top</li>
                </ul>
              </div>
            </div>
          </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={pending}>
              {pending ? "Saving..." : editingId ? "Update Template" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

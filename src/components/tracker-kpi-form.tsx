"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export interface TrackerKpiFormData {
  name: string;
  initials: string;
}

interface TrackerKpiFormProps {
  onSubmit: (data: TrackerKpiFormData) => void;
  onCancel: () => void;
  initialData?: { id: string; name: string; unit?: string | null } | null;
}

export function TrackerKpiForm({ onSubmit, onCancel, initialData }: TrackerKpiFormProps) {
  const [name, setName] = useState(initialData?.name || "");
  const [initials, setInitials] = useState(initialData?.unit || "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ name, initials });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Smart Meter Appointments"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="initials">Unit / Initials</Label>
        <Input
          id="initials"
          value={initials}
          onChange={(e) => setInitials(e.target.value)}
          placeholder="e.g., SMAR"
          required
        />
        <p className="text-sm text-muted-foreground">
          Short abbreviation or unit for display
        </p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">
          {initialData ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}

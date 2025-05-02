
'use client';

import React, { useState, useEffect } from 'react';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Pod } from '@/app/(admin)/admin/pods/page';
import type { AppUser } from '@/services/user';
import { Loader2 } from 'lucide-react';

interface ManagePodAgentsDialogProps {
  pod: Pod;
  allUsers: AppUser[];
  onSave: (podId: string, selectedAgentIds: string[]) => Promise<void> | void;
  onClose: () => void;
}

export function ManagePodAgentsDialog({ pod, allUsers, onSave, onClose }: ManagePodAgentsDialogProps) {
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(pod.agentIds || []);
  const [isSaving, setIsSaving] = useState(false);

  // Filter users to show only potential agents (customize this logic if needed)
  // For example, filter out existing managers/leaders or users already in *another* pod
  const availableAgents = allUsers.filter(user =>
    user.role === 'agent' // Simple role check, refine as necessary
    // && !pod.agentIds?.includes(user.id || '') // Optionally exclude already assigned agents if checkbox logic handles it
  );

  useEffect(() => {
    // Update state if the pod prop changes (e.g., opening dialog for a different pod)
    setSelectedAgentIds(pod.agentIds || []);
  }, [pod]);

  const handleCheckboxChange = (agentId: string, checked: boolean | 'indeterminate') => {
    if (typeof checked !== 'boolean') return; // Should not happen with basic checkbox

    setSelectedAgentIds(prev =>
      checked ? [...prev, agentId] : prev.filter(id => id !== agentId)
    );
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      await onSave(pod.id, selectedAgentIds);
      // onClose(); // Parent component handles closing on successful save
    } catch (error) {
      // Error handled in parent component's onSave callback via toast
      console.error("Error saving agents in dialog:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Manage Agents for {pod.name}</DialogTitle>
        <DialogDescription>
          Select the agents assigned to this pod.
        </DialogDescription>
      </DialogHeader>

      {availableAgents.length === 0 ? (
         <p className="text-muted-foreground text-center py-4">No available agents found. Add agents with the 'agent' role first.</p>
      ) : (
         <ScrollArea className="max-h-[400px] p-1">
            <div className="space-y-3 p-4">
            {availableAgents.map((agent) => (
                <div key={agent.id} className="flex items-center space-x-3">
                <Checkbox
                    id={`agent-${agent.id}`}
                    checked={selectedAgentIds.includes(agent.id!)}
                    onCheckedChange={(checked) => handleCheckboxChange(agent.id!, checked)}
                    disabled={isSaving}
                />
                <Label
                    htmlFor={`agent-${agent.id}`}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    {agent.name} <span className="text-xs text-muted-foreground">({agent.email})</span>
                </Label>
                </div>
            ))}
            </div>
        </ScrollArea>
      )}


      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
        </DialogClose>
        <Button type="button" onClick={handleSaveClick} disabled={isSaving || availableAgents.length === 0}>
           {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
           {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

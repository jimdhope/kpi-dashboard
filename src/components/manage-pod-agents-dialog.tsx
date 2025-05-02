
'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
import { Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input'; // Import Input

interface ManagePodAgentsDialogProps {
  pod: Pod;
  allUsers: AppUser[];
  onSave: (podId: string, selectedAgentIds: string[]) => Promise<void> | void;
  onClose: () => void;
}

export function ManagePodAgentsDialog({ pod, allUsers, onSave, onClose }: ManagePodAgentsDialogProps) {
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(pod.agentIds || []);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // State for search term

  // Filter users to show only potential agents
  const availableAgents = useMemo(() => {
      return allUsers.filter(user =>
        user.role === 'agent' // Simple role check, refine as necessary
      );
  }, [allUsers]);

  // Filter agents based on search term
  const filteredAgents = useMemo(() => {
    if (!searchTerm) {
      return availableAgents;
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return availableAgents.filter(agent =>
      agent.name.toLowerCase().includes(lowerCaseSearchTerm) ||
      agent.email.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [availableAgents, searchTerm]);


  useEffect(() => {
    // Update state if the pod prop changes (e.g., opening dialog for a different pod)
    setSelectedAgentIds(pod.agentIds || []);
    setSearchTerm(''); // Reset search on pod change
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

      {/* Search Input */}
      <div className="relative mb-4">
         <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
         <Input
           type="search"
           placeholder="Search agents by name or email..."
           value={searchTerm}
           onChange={(e) => setSearchTerm(e.target.value)}
           className="pl-8 w-full"
           disabled={isSaving || availableAgents.length === 0}
         />
      </div>


      {availableAgents.length === 0 ? (
         <p className="text-muted-foreground text-center py-4">No available agents found. Add agents with the 'agent' role first.</p>
      ) : (
         <ScrollArea className="max-h-[300px] p-1 border rounded-md"> {/* Adjusted max height */}
            <div className="space-y-3 p-4">
            {filteredAgents.length > 0 ? (
                filteredAgents.map((agent) => (
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
                ))
            ) : (
                 <p className="text-muted-foreground text-center py-4">No agents match your search.</p>
            )}
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

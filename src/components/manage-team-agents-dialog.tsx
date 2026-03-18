
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
import type { Team } from '@/app/(admin)/admin/teams/page'; // Adjust path if needed
import type { AppUser } from '@/services/user';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { Input } from '@/components/ui/input'; // Import Input

interface ManageTeamAgentsDialogProps {
  team: Team;
  unassignedAgents: AppUser[]; // Agents available to be assigned to THIS team
  agentNameMap: Map<string, string>; // Map of all agent IDs to names in the pod
  onSave: (teamId: string, selectedAgentIds: string[]) => void; // Simplified save handler
  onClose: () => void;
}

export function ManageTeamAgentsDialog({ team, unassignedAgents, agentNameMap, onSave, onClose }: ManageTeamAgentsDialogProps) {
  // Combine agents currently in the team + unassigned agents for the selection list
  const agentsInTeam = useMemo(() => {
      return team.agentIds.map(id => ({ id, name: agentNameMap.get(id) || 'Unknown Agent' }))
                   .filter(a => a.id); // Ensure ID exists
  }, [team.agentIds, agentNameMap]);

  const allSelectableAgents = useMemo(() => {
        const combined = [...agentsInTeam];
        unassignedAgents.forEach(ua => {
            // Add unassigned agent only if not already listed (shouldn't happen but safe check)
            if (ua.id && !combined.some(ca => ca.id === ua.id)) {
                combined.push({ id: ua.id, name: ua.name });
            }
        });
        // Sort alphabetically by name for consistency
        return combined.sort((a, b) => a.name.localeCompare(b.name));
  }, [agentsInTeam, unassignedAgents]);


  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>(team.agentIds || []);
  const [isSaving, setIsSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // State for search term

  // Filter selectable agents based on search term
  const filteredAgents = useMemo(() => {
    if (!searchTerm) {
      return allSelectableAgents;
    }
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    return allSelectableAgents.filter(agent =>
      agent.name.toLowerCase().includes(lowerCaseSearchTerm)
    );
  }, [allSelectableAgents, searchTerm]);


  useEffect(() => {
    // Update state if the team prop changes
    setSelectedAgentIds(team.agentIds || []);
    setSearchTerm(''); // Reset search on team change
  }, [team]);

  const handleCheckboxChange = (agentId: string, checked: boolean | 'indeterminate') => {
    if (typeof checked !== 'boolean') return;

    setSelectedAgentIds(prev =>
      checked ? [...prev, agentId] : prev.filter(id => id !== agentId)
    );
  };

  const handleSaveClick = async () => {
    setIsSaving(true);
    try {
      // Directly call the onSave function passed from the parent
      // The parent component will handle updating its own state (teams, unassignedAgents)
      onSave(team.id, selectedAgentIds);
      // onClose(); // Parent handles closing
    } catch (error) {
       // Parent should handle showing toast/error message
      console.error("Error saving team agents in dialog:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Assign Agents to {team.name} {team.emoji}</DialogTitle>
        <DialogDescription>
          Select agents to include in this team. Agents not selected here or in other teams will remain unassigned.
        </DialogDescription>
      </DialogHeader>

      {/* Search Input */}
      <div className="relative mb-4">
         <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
         <Input
           type="search"
           placeholder="Search agents by name..."
           value={searchTerm}
           onChange={(e) => setSearchTerm(e.target.value)}
           className="pl-8 w-full"
           disabled={isSaving || allSelectableAgents.length === 0}
         />
      </div>


      {allSelectableAgents.length === 0 ? (
         <p className="text-muted-foreground text-center py-4">No agents available in this pod.</p>
      ) : (
         <ScrollArea className="max-h-[300px] p-1 border rounded-md">
            <div className="space-y-3 p-4">
            {filteredAgents.length > 0 ? (
                filteredAgents.map((agent) => (
                    <div key={agent.id} className="flex items-center space-x-3">
                        <Checkbox
                            id={`team-agent-${team.id}-${agent.id}`}
                            checked={selectedAgentIds.includes(agent.id!)}
                            onCheckedChange={(checked) => handleCheckboxChange(agent.id!, checked)}
                            disabled={isSaving}
                        />
                        <Label
                            htmlFor={`team-agent-${team.id}-${agent.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                            {agent.name}
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
        <Button type="button" onClick={handleSaveClick} disabled={isSaving || allSelectableAgents.length === 0}>
           {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
           {isSaving ? 'Saving...' : 'Update Team Agents'}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

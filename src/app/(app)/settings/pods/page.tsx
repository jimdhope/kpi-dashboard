'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button, buttonVariants } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Edit, Trash2, PlusCircle, Users, UserPlus, Search } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { generateInitials } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';

interface Campaign {
  id: string;
  name: string;
}

interface PodMember {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

interface Pod {
  id: string;
  name: string;
  campaignId: string | null;
  campaignName: string | null;
  description: string | null;
  memberCount: number;
  members: PodMember[];
  incomingWebhookId: string | null;
  outgoingWebhookId: string | null;
  incomingWebhookName: string | null;
  outgoingWebhookName: string | null;
}

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

interface Webhook {
  id: string;
  name: string;
  direction: 'incoming' | 'outgoing';
}

export default function AdminPodsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingPods, setIsLoadingPods] = useState(true);
  const [isLoadingRelated, setIsLoadingRelated] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [selectedPod, setSelectedPod] = useState<Pod | null>(null);
  const [dialogMode, setDialogMode] = useState<'add' | 'edit'>('add');
  const [searchTerm, setSearchTerm] = useState('');
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [isSavingMembers, setIsSavingMembers] = useState(false);
  const { toast } = useToast();

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCampaignId, setFormCampaignId] = useState('');
  const [formIncomingWebhookId, setFormIncomingWebhookId] = useState('');
  const [formOutgoingWebhookId, setFormOutgoingWebhookId] = useState('');
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsLoadingRelated(true);
      try {
        const [podsRes, campaignsRes, usersRes, webhooksRes] = await Promise.all([
          fetch('/api/pods'),
          fetch('/api/campaigns'),
          fetch('/api/users'),
          fetch('/api/integrations/teams-webhooks'),
        ]);

        if (podsRes.ok) {
          const data = await podsRes.json();
          setPods(data.pods || []);
        }
        if (campaignsRes.ok) {
          const data = await campaignsRes.json();
          setCampaigns(data.campaigns || []);
        }
        if (usersRes.ok) {
          const data = await usersRes.json();
          setUsers(data.users || []);
        }
        if (webhooksRes.ok) {
          const data = await webhooksRes.json();
          setWebhooks(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data.");
      } finally {
        setIsLoadingPods(false);
        setIsLoadingRelated(false);
      }
    }

    fetchData();
  }, []);

  const filteredPods = useMemo(() => {
    if (!searchTerm) return pods;
    const term = searchTerm.toLowerCase();
    return pods.filter(pod =>
      pod.name.toLowerCase().includes(term) ||
      pod.campaignName?.toLowerCase().includes(term)
    );
  }, [pods, searchTerm]);

  const filteredUsers = useMemo(() => {
    if (!memberSearchTerm) return users;
    const term = memberSearchTerm.toLowerCase();
    return users.filter(user =>
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term)
    );
  }, [users, memberSearchTerm]);

  const openAddDialog = () => {
    setSelectedPod(null);
    setDialogMode('add');
    setFormName('');
    setFormDescription('');
    setFormCampaignId('');
    setFormIncomingWebhookId('');
    setFormOutgoingWebhookId('');
    setIsFormOpen(true);
  };

  const openEditDialog = (pod: Pod) => {
    setSelectedPod(pod);
    setDialogMode('edit');
    setFormName(pod.name);
    setFormDescription(pod.description || '');
    setFormCampaignId(pod.campaignId || '');
    setFormIncomingWebhookId(pod.incomingWebhookId || '');
    setFormOutgoingWebhookId(pod.outgoingWebhookId || '');
    setIsFormOpen(true);
  };

  const openDeleteAlert = (pod: Pod) => {
    setSelectedPod(pod);
    setIsAlertOpen(true);
  };

  const openManageMembersDialog = (pod: Pod) => {
    setSelectedPod(pod);
    setSelectedMemberIds(pod.members.map(m => m.id));
    setMemberSearchTerm('');
    setIsMembersOpen(true);
  };

  const handleFormSubmit = async () => {
    if (!formName.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Pod name is required." });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        description: formDescription.trim() || null,
        campaignId: formCampaignId || null,
        incomingWebhookId: formIncomingWebhookId || null,
        outgoingWebhookId: formOutgoingWebhookId || null,
      };

      if (dialogMode === 'add') {
        const res = await fetch('/api/pods', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to create pod');
        toast({ title: "Pod Created", description: `"${formName}" has been created.` });
      } else if (selectedPod) {
        const res = await fetch(`/api/pods/${selectedPod.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to update pod');
        toast({ title: "Pod Updated", description: `"${formName}" has been updated.` });
      }

      setIsFormOpen(false);
      const res = await fetch('/api/pods');
      if (res.ok) {
        const data = await res.json();
        setPods(data.pods || []);
      }
    } catch (err: any) {
      console.error("Error saving pod:", err);
      toast({ variant: "destructive", title: "Save Error", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!selectedPod) return;
    try {
      const res = await fetch(`/api/pods/${selectedPod.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete pod');
      toast({ title: "Pod Deleted", description: `"${selectedPod.name}" has been deleted.` });
      setPods(pods.filter(p => p.id !== selectedPod.id));
    } catch (err: any) {
      console.error("Error deleting pod:", err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    }
    setIsAlertOpen(false);
    setSelectedPod(null);
  };

  const handleSaveMembers = async () => {
    if (!selectedPod) return;
    setIsSavingMembers(true);
    try {
      const res = await fetch(`/api/pods/${selectedPod.id}/memberships`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedMemberIds }),
      });
      if (!res.ok) throw new Error('Failed to update members');
      toast({ title: "Members Updated", description: `Members for "${selectedPod.name}" have been saved.` });
      setIsMembersOpen(false);
      const podsRes = await fetch('/api/pods');
      if (podsRes.ok) {
        const data = await podsRes.json();
        setPods(data.pods || []);
      }
    } catch (err: any) {
      console.error("Error saving members:", err);
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setIsSavingMembers(false);
    }
  };

  const toggleMember = (userId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const isAddDisabled = isLoadingRelated || campaigns.length === 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Manage Pods</CardTitle>
            <CardDescription>View, add, edit, delete pods, and manage members.</CardDescription>
          </div>
          <div className="flex gap-2 items-start flex-wrap">
            <div className="relative max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search pods..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 w-full"
                disabled={isLoadingPods || isLoadingRelated}
              />
            </div>
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
              <DialogTrigger asChild>
                <Button onClick={openAddDialog} disabled={isAddDisabled}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Pod
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>{dialogMode === 'add' ? 'Add New Pod' : 'Edit Pod'}</DialogTitle>
                  <DialogDescription>
                    {dialogMode === 'add' ? 'Enter the details for the new pod.' : `Make changes to "${selectedPod?.name}".`}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Pod Name</Label>
                    <Input
                      id="name"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g., Alpha Pod"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">Description</Label>
                    <Input
                      id="description"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="campaign">Campaign</Label>
                    <select
                      id="campaign"
                      value={formCampaignId}
                      onChange={(e) => setFormCampaignId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">No campaign</option>
                      {campaigns.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="incomingWebhook">Incoming Webhook</Label>
                    <select
                      id="incomingWebhook"
                      value={formIncomingWebhookId}
                      onChange={(e) => setFormIncomingWebhookId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">None</option>
                      {webhooks.filter(w => w.direction === 'incoming').map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="outgoingWebhook">Outgoing Webhook</Label>
                    <select
                      id="outgoingWebhook"
                      value={formOutgoingWebhookId}
                      onChange={(e) => setFormOutgoingWebhookId(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      <option value="">None</option>
                      {webhooks.filter(w => w.direction === 'outgoing').map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsFormOpen(false)}>Cancel</Button>
                  <Button onClick={handleFormSubmit} disabled={isSaving}>
                    {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="overflow-y-auto max-h-[calc(100vh-220px)]">
          {error && !isLoadingPods && (
            <div className="mb-4 text-center text-destructive">{error}</div>
          )}

          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              <TableRow>
                <TableHead className="w-[80px]">Logo</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Members</TableHead>
                <TableHead className="text-right w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingPods || isLoadingRelated ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={`loading-${index}`}>
                    <TableCell><Skeleton className="h-10 w-10 rounded-full" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-1/2" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-1/4" /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                        <Skeleton className="h-8 w-8" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredPods.length === 0 && !error ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {searchTerm ? `No pods found matching "${searchTerm}".` : "No pods found. Create one to get started!"}
                  </TableCell>
                </TableRow>
              ) : (
                filteredPods.map((pod) => (
                  <TableRow key={pod.id}>
                    <TableCell>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{generateInitials(pod.name)}</AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{pod.name}</TableCell>
                    <TableCell className="text-muted-foreground">{pod.campaignName || '-'}</TableCell>
                    <TableCell className="text-muted-foreground">{pod.memberCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => openManageMembersDialog(pod)}
                          title="Manage members"
                          disabled={isLoadingPods || isLoadingRelated || users.length === 0}
                        >
                          <UserPlus className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(pod)}
                          aria-label={`Edit ${pod.name}`}
                          title={`Edit ${pod.name}`}
                          disabled={isLoadingPods || isLoadingRelated}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                          onClick={() => openDeleteAlert(pod)}
                          aria-label={`Delete ${pod.name}`}
                          title={`Delete ${pod.name}`}
                          disabled={isLoadingPods || isLoadingRelated}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the pod
              <span className="font-semibold"> "{selectedPod?.name}"</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedPod(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className={buttonVariants({ variant: "destructive" })}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isMembersOpen} onOpenChange={setIsMembersOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage Members for {selectedPod?.name}</DialogTitle>
            <DialogDescription>
              Select the users to assign to this pod.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search users..."
              value={memberSearchTerm}
              onChange={(e) => setMemberSearchTerm(e.target.value)}
              className="pl-8 w-full"
              disabled={isSavingMembers}
            />
          </div>

          {filteredUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">No users found.</p>
          ) : (
            <ScrollArea className="max-h-[300px] p-1 border rounded-md">
              <div className="space-y-3 p-4">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="flex items-center space-x-3">
                    <Checkbox
                      id={`member-${user.id}`}
                      checked={selectedMemberIds.includes(user.id)}
                      onCheckedChange={() => toggleMember(user.id)}
                      disabled={isSavingMembers}
                    />
                    <Label
                      htmlFor={`member-${user.id}`}
                      className="text-sm font-medium leading-none cursor-pointer"
                    >
                      {user.name} <span className="text-xs text-muted-foreground">({user.email})</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        [{user.roles.join(', ')}]
                      </span>
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsMembersOpen(false)} disabled={isSavingMembers}>
              Cancel
            </Button>
            <Button onClick={handleSaveMembers} disabled={isSavingMembers}>
              {isSavingMembers && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSavingMembers ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

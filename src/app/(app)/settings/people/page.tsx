'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Loader2, Pencil, Search, Trash2, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type Person = { id: string; name: string; email: string; roles: string[]; podIds: string[] };
type Pod = { id: string; name: string; campaignId?: string | null; campaignName?: string | null; description?: string | null; teamLeaderId?: string | null; podManagerId?: string | null; incomingWebhookId?: string | null; outgoingWebhookId?: string | null; members: { id: string }[] };
type Campaign = { id: string; name: string; description?: string | null; isActive: boolean };
type Webhook = { id: string; name: string; direction: 'incoming' | 'outgoing' };
type Absence = { id: string; userId: string; startsOn: string; endsOn?: string | null; reason?: string | null };

const roleLabel = (role: string) => ({
  admin: 'Admin', campaignManager: 'Campaign manager', podManager: 'Pod manager',
  teamLeader: 'Team leader', competitionRunner: 'Competition runner', agent: 'Agent',
}[role] ?? role);

const dateLabel = (value: string) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
const allRoles = ['admin', 'campaignManager', 'podManager', 'teamLeader', 'competitionRunner', 'agent'];

export default function PeoplePage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [pods, setPods] = useState<Pod[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [absences, setAbsences] = useState<Absence[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentRoles, setCurrentRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Record<string, 'NONE' | 'VIEW' | 'MANAGE'>>({});
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [name, setName] = useState('');
  const [roles, setRoles] = useState<string[]>([]);
  const [selectedPodIds, setSelectedPodIds] = useState<string[]>([]);
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [absenceStart, setAbsenceStart] = useState('');
  const [absenceEnd, setAbsenceEnd] = useState('');
  const [absenceEndUnknown, setAbsenceEndUnknown] = useState(false);
  const [absenceReason, setAbsenceReason] = useState('');
  const [savingAbsence, setSavingAbsence] = useState(false);
  const [editingAbsence, setEditingAbsence] = useState<Absence | null>(null);
  const [editAbsenceOpen, setEditAbsenceOpen] = useState(false);
  const [deletingAbsence, setDeletingAbsence] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [savingCampaign, setSavingCampaign] = useState(false);
  const [podOpen, setPodOpen] = useState(false);
  const [editingPod, setEditingPod] = useState<Pod | null>(null);
  const [podName, setPodName] = useState('');
  const [podDescription, setPodDescription] = useState('');
  const [podCampaignId, setPodCampaignId] = useState('none');
  const [podTeamLeaderId, setPodTeamLeaderId] = useState('none');
  const [podManagerId, setPodManagerId] = useState('none');
  const [podIncomingWebhookId, setPodIncomingWebhookId] = useState('none');
  const [podOutgoingWebhookId, setPodOutgoingWebhookId] = useState('none');
  const [savingPod, setSavingPod] = useState(false);
  const [deletePodOpen, setDeletePodOpen] = useState(false);
  const [deletingPod, setDeletingPod] = useState(false);
  const [newPersonOpen, setNewPersonOpen] = useState(false);
  const [newPersonName, setNewPersonName] = useState('');
  const [newPersonEmail, setNewPersonEmail] = useState('');
  const [newPersonPassword, setNewPersonPassword] = useState('');
  const [newPersonRoles, setNewPersonRoles] = useState<string[]>(['agent']);
  const [creatingPerson, setCreatingPerson] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      try {
        const [peopleResponse, podsResponse, absencesResponse, sessionResponse, campaignsResponse, webhooksResponse, permissionsResponse] = await Promise.all([
          fetch('/api/users'), fetch('/api/pods'), fetch('/api/absences'), fetch('/api/auth/session'), fetch('/api/campaigns'), fetch('/api/integrations/teams-webhooks'), fetch('/api/auth/permissions'),
        ]);
        if (!peopleResponse.ok || !podsResponse.ok) throw new Error('Unable to load people.');
        const [peopleData, podsData] = await Promise.all([peopleResponse.json(), podsResponse.json()]);
        setPeople(peopleData.users ?? []);
        setPods(podsData.pods ?? []);
        if (campaignsResponse.ok) { const campaignsData = await campaignsResponse.json(); setCampaigns(campaignsData.campaigns ?? []); }
        if (webhooksResponse.ok) { const webhooksData = await webhooksResponse.json(); setWebhooks(Array.isArray(webhooksData) ? webhooksData : []); }
        if (sessionResponse.ok) {
          const sessionData = await sessionResponse.json();
          setCurrentRoles(sessionData.user?.roles ?? []);
        }
        if (permissionsResponse.ok) {
          const permissionsData = await permissionsResponse.json();
          setPermissions(permissionsData.permissions ?? {});
        }
        if (absencesResponse.ok) {
          const absenceData = await absencesResponse.json();
          setAbsences(absenceData.absences ?? []);
        }
      } catch (loadError) {
        console.error(loadError);
        setError('People could not be loaded.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const podsById = useMemo(() => new Map(pods.map((pod) => [pod.id, pod])), [pods]);
  const currentAbsences = useMemo(() => {
    const now = new Date();
    return new Map(absences.filter((absence) => new Date(absence.startsOn) <= now && (!absence.endsOn || new Date(absence.endsOn) >= now)).map((absence) => [absence.userId, absence]));
  }, [absences]);
  const filteredPeople = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return people;
    return people.filter((person) => {
      const podNames = person.podIds.map((id) => podsById.get(id)?.name ?? '').join(' ');
      return [person.name, person.email, person.roles.join(' '), podNames].join(' ').toLowerCase().includes(query);
    });
  }, [people, podsById, search]);

  const canManageUsers = permissions['nav.settings.users'] === 'MANAGE';
  const canManageAccounts = permissions['nav.settings.userAccounts'] === 'MANAGE';
  const canManageRoles = permissions['nav.settings.userRoles'] === 'MANAGE';
  const canDeletePods = permissions['nav.settings.podDeletion'] === 'MANAGE';
  const canManageCampaigns = permissions['nav.settings.campaigns'] === 'MANAGE';
  const canManagePods = permissions['nav.settings.pods'] === 'MANAGE';
  const openPerson = (person: Person) => {
    setSelectedPerson(person);
    setName(person.name);
    setRoles(person.roles);
    setSelectedPodIds(person.podIds);
    setTemporaryPassword('');
    setAbsenceStart('');
    setAbsenceEnd('');
    setAbsenceEndUnknown(false);
    setAbsenceReason('');
    setDetailOpen(true);
  };
  const toggleRole = (role: string) => setRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  const toggleNewPersonRole = (role: string) => setNewPersonRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  const togglePod = (podId: string) => setSelectedPodIds((current) => current.includes(podId) ? current.filter((item) => item !== podId) : [...current, podId]);
  const savePerson = async () => {
    if (!selectedPerson) return;
    if ((canManageAccounts || canManageRoles) && (!name.trim() || roles.length === 0)) {
      toast({ variant: 'destructive', title: 'Details needed', description: 'A name and at least one role are required.' });
      return;
    }
    if (temporaryPassword && temporaryPassword.length < 8) {
      toast({ variant: 'destructive', title: 'Password too short', description: 'Temporary passwords need at least 8 characters.' });
      return;
    }
    setSaving(true);
    try {
      if (canManageAccounts || canManageRoles) {
        const response = await fetch(`/api/users/${selectedPerson.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), roles }) });
        if (!response.ok) throw new Error('Unable to save account details.');
      }
      if (temporaryPassword) {
        const response = await fetch(`/api/users/${selectedPerson.id}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: temporaryPassword }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error ?? 'Unable to reset password.');
      }
      const changedPods = pods.filter((pod) => pod.members.some((member) => member.id === selectedPerson.id) !== selectedPodIds.includes(pod.id));
      for (const pod of changedPods) {
        const existingMemberIds = pod.members.map((member) => member.id);
        const userIds = selectedPodIds.includes(pod.id)
          ? [...new Set([...existingMemberIds, selectedPerson.id])]
          : existingMemberIds.filter((id) => id !== selectedPerson.id);
        const response = await fetch(`/api/pods/${pod.id}/memberships`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userIds }) });
        if (!response.ok) throw new Error(`Unable to update membership for ${pod.name}.`);
      }
      setPeople((current) => current.map((person) => person.id === selectedPerson.id ? { ...person, name: canManageAccounts ? name.trim() : person.name, roles: canManageRoles ? roles : person.roles, podIds: selectedPodIds } : person));
      setPods((current) => current.map((pod) => !changedPods.some((changed) => changed.id === pod.id) ? pod : { ...pod, members: selectedPodIds.includes(pod.id) ? [...pod.members.filter((member) => member.id !== selectedPerson.id), { id: selectedPerson.id }] : pod.members.filter((member) => member.id !== selectedPerson.id) }));
      toast({ title: 'Person updated', description: temporaryPassword ? 'Details saved and temporary password set.' : 'Account details saved.' });
      setDetailOpen(false);
    } catch (saveError) {
      toast({ variant: 'destructive', title: 'Update failed', description: saveError instanceof Error ? saveError.message : 'Please try again.' });
    } finally { setSaving(false); }
  };
  const addAbsence = async () => {
    if (!selectedPerson || !absenceStart) {
      toast({ variant: 'destructive', title: 'Start date needed', description: 'Choose the first day of the absence.' });
      return;
    }
    if (!absenceEndUnknown && !absenceEnd) {
      toast({ variant: 'destructive', title: 'End date needed', description: 'Choose an end date or mark it as unknown.' });
      return;
    }
    setSavingAbsence(true);
    try {
      const response = await fetch('/api/absences', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedPerson.id, startsOn: `${absenceStart}T00:00:00.000Z`, endsOn: absenceEndUnknown ? null : `${absenceEnd}T23:59:59.999Z`, reason: absenceReason.trim() || null }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Unable to save absence.');
      setAbsences((current) => [...current, data.absence]);
      setAbsenceStart(''); setAbsenceEnd(''); setAbsenceEndUnknown(false); setAbsenceReason('');
      toast({ title: 'Absence recorded', description: `Saved for ${selectedPerson.name}.` });
    } catch (absenceError) {
      toast({ variant: 'destructive', title: 'Absence not saved', description: absenceError instanceof Error ? absenceError.message : 'Please try again.' });
    } finally { setSavingAbsence(false); }
  };
  const openAbsenceEdit = (absence: Absence) => {
    setEditingAbsence(absence); setAbsenceStart(absence.startsOn.slice(0, 10)); setAbsenceEnd(absence.endsOn?.slice(0, 10) ?? ''); setAbsenceEndUnknown(!absence.endsOn); setAbsenceReason(absence.reason ?? ''); setEditAbsenceOpen(true);
  };
  const updateAbsence = async () => {
    if (!editingAbsence || !absenceStart || (!absenceEndUnknown && !absenceEnd)) { toast({ variant: 'destructive', title: 'Dates needed', description: 'Choose an end date or mark it unknown.' }); return; }
    setSavingAbsence(true);
    try {
      const response = await fetch(`/api/absences/${editingAbsence.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ startsOn: `${absenceStart}T00:00:00.000Z`, endsOn: absenceEndUnknown ? null : `${absenceEnd}T23:59:59.999Z`, reason: absenceReason.trim() || null }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Unable to update absence.');
      setAbsences((current) => current.map((absence) => absence.id === editingAbsence.id ? data.absence : absence)); setEditAbsenceOpen(false); toast({ title: 'Absence updated' });
    } catch (updateError) { toast({ variant: 'destructive', title: 'Absence not updated', description: updateError instanceof Error ? updateError.message : 'Please try again.' }); }
    finally { setSavingAbsence(false); }
  };
  const removeAbsence = async () => {
    if (!editingAbsence) return;
    setDeletingAbsence(true);
    try {
      const response = await fetch(`/api/absences/${editingAbsence.id}`, { method: 'DELETE' }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Unable to remove absence.');
      setAbsences((current) => current.filter((absence) => absence.id !== editingAbsence.id)); setEditAbsenceOpen(false); toast({ title: 'Absence removed' });
    } catch (removeError) { toast({ variant: 'destructive', title: 'Absence not removed', description: removeError instanceof Error ? removeError.message : 'Please try again.' }); }
    finally { setDeletingAbsence(false); }
  };
  const openCampaign = (campaign?: Campaign) => {
    setEditingCampaign(campaign ?? null); setCampaignName(campaign?.name ?? ''); setCampaignDescription(campaign?.description ?? ''); setCampaignOpen(true);
  };
  const saveCampaign = async () => {
    if (campaignName.trim().length < 2) { toast({ variant: 'destructive', title: 'Campaign name needed', description: 'Use at least two characters.' }); return; }
    setSavingCampaign(true);
    try {
      const response = await fetch(editingCampaign ? `/api/campaigns/${editingCampaign.id}` : '/api/campaigns', { method: editingCampaign ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: campaignName.trim(), description: campaignDescription.trim() || null, isActive: editingCampaign?.isActive ?? true }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Unable to save campaign.');
      setCampaigns((current) => editingCampaign ? current.map((campaign) => campaign.id === editingCampaign.id ? data : campaign) : [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setCampaignOpen(false); toast({ title: editingCampaign ? 'Campaign updated' : 'Campaign created' });
    } catch (campaignError) { toast({ variant: 'destructive', title: 'Campaign not saved', description: campaignError instanceof Error ? campaignError.message : 'Please try again.' }); }
    finally { setSavingCampaign(false); }
  };
  const openPod = (pod?: Pod) => {
    setEditingPod(pod ?? null); setPodName(pod?.name ?? ''); setPodDescription(pod?.description ?? '');
    setPodCampaignId(pod?.campaignId ?? 'none'); setPodTeamLeaderId(pod?.teamLeaderId ?? 'none'); setPodManagerId(pod?.podManagerId ?? 'none');
    setPodIncomingWebhookId(pod?.incomingWebhookId ?? 'none'); setPodOutgoingWebhookId(pod?.outgoingWebhookId ?? 'none'); setPodOpen(true);
  };
  const selectedOrNull = (value: string) => value === 'none' ? null : value;
  const savePod = async () => {
    if (podName.trim().length < 2) { toast({ variant: 'destructive', title: 'Pod name needed', description: 'Use at least two characters.' }); return; }
    setSavingPod(true);
    try {
      const payload = { name: podName.trim(), description: podDescription.trim() || null, campaignId: selectedOrNull(podCampaignId), teamLeaderId: selectedOrNull(podTeamLeaderId), podManagerId: selectedOrNull(podManagerId), incomingWebhookId: selectedOrNull(podIncomingWebhookId), outgoingWebhookId: selectedOrNull(podOutgoingWebhookId) };
      const response = await fetch(editingPod ? `/api/pods/${editingPod.id}` : '/api/pods', { method: editingPod ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Unable to save pod.');
      setPods((current) => editingPod ? current.map((pod) => pod.id === editingPod.id ? data : pod) : [...current, data].sort((a, b) => a.name.localeCompare(b.name)));
      setPodOpen(false); toast({ title: editingPod ? 'Pod updated' : 'Pod created' });
    } catch (podError) { toast({ variant: 'destructive', title: 'Pod not saved', description: podError instanceof Error ? podError.message : 'Please try again.' }); }
    finally { setSavingPod(false); }
  };
  const deletePod = async () => {
    if (!editingPod) return;
    setDeletingPod(true);
    try {
      const response = await fetch(`/api/pods/${editingPod.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? 'Unable to delete pod.');
      setPods((current) => current.filter((pod) => pod.id !== editingPod.id));
      setDeletePodOpen(false); setPodOpen(false); toast({ title: 'Pod deleted', description: `${editingPod.name} was removed.` });
    } catch (deleteError) {
      toast({ variant: 'destructive', title: 'Pod not deleted', description: deleteError instanceof Error ? deleteError.message : 'Please try again.' });
    } finally { setDeletingPod(false); }
  };
  const openNewPerson = () => { setNewPersonName(''); setNewPersonEmail(''); setNewPersonPassword(''); setNewPersonRoles(['agent']); setNewPersonOpen(true); };
  const createPerson = async () => {
    if (!newPersonName.trim() || !newPersonEmail.includes('@') || newPersonPassword.length < 8 || newPersonRoles.length === 0) {
      toast({ variant: 'destructive', title: 'Details needed', description: 'Enter a name, valid email, 8-character password, and at least one role.' }); return;
    }
    setCreatingPerson(true);
    try {
      const response = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newPersonName.trim(), email: newPersonEmail.trim(), password: newPersonPassword, roles: newPersonRoles }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Unable to create user.');
      setPeople((current) => [...current, data].sort((a, b) => a.name.localeCompare(b.name))); setNewPersonOpen(false); toast({ title: 'User created', description: `${newPersonName.trim()} will be asked to change their password on first login.` });
    } catch (createError) { toast({ variant: 'destructive', title: 'User not created', description: createError instanceof Error ? createError.message : 'Please try again.' }); }
    finally { setCreatingPerson(false); }
  };
  const previewPerson = async () => {
    if (!selectedPerson) return;
    const previewWindow = window.open('', '_blank');
    if (!previewWindow) { toast({ variant: 'destructive', title: 'Pop-up blocked', description: 'Allow pop-ups for KPI Quest, then try again.' }); return; }
    previewWindow.opener = null; previewWindow.document.body.textContent = `Preparing read-only preview for ${selectedPerson.name}…`; setPreviewing(true);
    try {
      const response = await fetch('/api/admin-preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: selectedPerson.id }) });
      const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Unable to start preview.');
      previewWindow.location.replace('/dashboard'); toast({ title: 'Preview opened', description: 'Exit preview before making administrative changes.' });
    } catch (previewError) { previewWindow.close(); toast({ variant: 'destructive', title: 'Preview unavailable', description: previewError instanceof Error ? previewError.message : 'Please try again.' }); }
    finally { setPreviewing(false); }
  };
  const deletePerson = async () => {
    if (!selectedPerson) return;
    try {
      const response = await fetch(`/api/users/${selectedPerson.id}`, { method: 'DELETE' }); const data = await response.json().catch(() => ({})); if (!response.ok) throw new Error(data.error ?? 'Unable to delete user.');
      setPeople((current) => current.filter((person) => person.id !== selectedPerson.id)); setDeleteOpen(false); setDetailOpen(false); toast({ title: 'User deleted', description: `${selectedPerson.name} was removed.` });
    } catch (deleteError) { toast({ variant: 'destructive', title: 'User not deleted', description: deleteError instanceof Error ? deleteError.message : 'Please try again.' }); }
  };

  return <div className="space-y-6">
    <Card>
      <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
          <CardTitle className="flex items-center gap-2"><Users className="h-5 w-5" /> People</CardTitle>
          <CardDescription>One view of everyone, their role, team membership and current absence status.</CardDescription>
          </div>
          {canManageAccounts && canManageRoles && <Button onClick={openNewPerson}>Add person</Button>}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a person, role or pod" className="pl-9" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2 text-sm text-muted-foreground">
          <span>{people.length} people</span><span>•</span><span>{pods.length} pods</span><span>•</span><span>{currentAbsences.size} currently absent</span>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {loading ? Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-40" />) : filteredPeople.map((person) => {
            const memberPods = person.podIds.map((id) => podsById.get(id)).filter((pod): pod is Pod => Boolean(pod));
            const absence = currentAbsences.get(person.id);
            return <button type="button" key={person.id} onClick={() => openPerson(person)} className="rounded-xl border p-4 text-left transition-colors hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-primary">
              <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{person.name}</h2><p className="text-sm text-muted-foreground">{person.email}</p></div>{absence && <Badge variant="secondary">Absent</Badge>}</div>
              <div className="mt-3 flex flex-wrap gap-1.5">{person.roles.map((role) => <Badge key={role} variant="outline">{roleLabel(role)}</Badge>)}</div>
              <div className="mt-3 text-sm"><span className="text-muted-foreground">Pods: </span>{memberPods.length ? memberPods.map((pod) => `${pod.name}${pod.campaignName ? ` (${pod.campaignName})` : ''}`).join(', ') : 'Not assigned'}</div>
              {absence && <div className="mt-3 flex gap-2 rounded-md bg-muted/60 p-2 text-sm"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" /><span>Absent from {dateLabel(absence.startsOn)}{absence.endsOn ? ` to ${dateLabel(absence.endsOn)}` : ' — end date unknown'}{absence.reason ? `: ${absence.reason}` : ''}</span></div>}
            </button>;
          })}
        </div>
        {!loading && !error && filteredPeople.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No people match that search.</p>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Pods</CardTitle><CardDescription>Team setup, leadership, campaign and Teams connection details.</CardDescription></div>{canManagePods && <Button onClick={() => openPod()}>Add pod</Button>}</CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{pods.map((pod) => <button type="button" key={pod.id} onClick={() => canManagePods && openPod(pod)} className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"><div className="flex items-center justify-between gap-2"><span className="font-medium">{pod.name}</span><Badge variant="outline">{pod.members.length} members</Badge></div><p className="mt-2 text-sm text-muted-foreground">{pod.campaignName || 'No campaign'}{pod.description ? ` · ${pod.description}` : ''}</p><p className="mt-3 text-xs text-muted-foreground">Leader: {people.find((person) => person.id === pod.teamLeaderId)?.name || 'Not assigned'} · Manager: {people.find((person) => person.id === pod.podManagerId)?.name || 'Not assigned'}</p></button>)}</CardContent>
    </Card>
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle>Campaigns</CardTitle><CardDescription>Campaigns and their linked pods, managed alongside people.</CardDescription></div>{canManageCampaigns && <Button onClick={() => openCampaign()}>Add campaign</Button>}</CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{campaigns.map((campaign) => <button type="button" key={campaign.id} onClick={() => canManageCampaigns && openCampaign(campaign)} className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/50 disabled:cursor-default"><div className="flex items-center justify-between gap-2"><span className="font-medium">{campaign.name}</span><Badge variant={campaign.isActive ? 'default' : 'secondary'}>{campaign.isActive ? 'Active' : 'Inactive'}</Badge></div><p className="mt-2 text-sm text-muted-foreground">{campaign.description || 'No description'}</p><p className="mt-3 text-xs text-muted-foreground">{pods.filter((pod) => pod.campaignId === campaign.id).length} linked pods</p></button>)}</CardContent>
    </Card>
    <p className="text-sm text-muted-foreground">Need to change accounts, teams or absences? Use <Link className="underline" href="/settings/users">Users</Link>, <Link className="underline" href="/settings/pods">Pods</Link>, or <Link className="underline" href="/settings/users/absences">Absences</Link>.</p>
    <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader><DialogTitle>{selectedPerson?.name}</DialogTitle><DialogDescription>Account, role, membership and absence details.</DialogDescription></DialogHeader>
        {selectedPerson && <div className="grid gap-6 lg:grid-cols-4">
          <div className="space-y-5 lg:col-span-3">
          <div className="grid gap-2"><Label htmlFor="person-name">Name</Label><Input id="person-name" value={name} onChange={(event) => setName(event.target.value)} disabled={!canManageAccounts || saving} /></div>
          <div className="grid gap-2"><Label>Email</Label><Input value={selectedPerson.email} disabled /></div>
          <div className="grid gap-2"><Label>Roles</Label><div className="grid grid-cols-2 gap-3 rounded-lg border p-3">{allRoles.map((role) => <label key={role} className="flex items-center gap-2 text-sm"><Checkbox checked={roles.includes(role)} onCheckedChange={() => toggleRole(role)} disabled={!canManageRoles || saving} />{roleLabel(role)}</label>)}</div></div>
          <div className="grid gap-2"><Label htmlFor="temporary-password">Temporary password</Label><Input id="temporary-password" type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} placeholder="Leave blank to keep the existing password" disabled={saving || !canManageUsers} /><p className="text-xs text-muted-foreground">Setting one signs the person out and requires them to change it at next login.</p></div>
          <div className="grid gap-2"><Label>Absence history</Label><div className="space-y-2">{absences.filter((absence) => absence.userId === selectedPerson.id).length ? absences.filter((absence) => absence.userId === selectedPerson.id).map((absence) => <button type="button" key={absence.id} onClick={() => openAbsenceEdit(absence)} className="flex w-full items-center justify-between gap-2 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted/50"><span>{dateLabel(absence.startsOn)}{absence.endsOn ? ` to ${dateLabel(absence.endsOn)}` : ' — end date unknown'}{absence.reason ? `: ${absence.reason}` : ''}</span><Pencil className="h-4 w-4 shrink-0 text-muted-foreground" /></button>) : <p className="text-sm text-muted-foreground">No recorded absences.</p>}</div></div>
          <div className="grid gap-3 rounded-lg border p-3"><Label>Record an absence</Label><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="absence-start" className="text-xs">From</Label><Input id="absence-start" type="date" value={absenceStart} onChange={(event) => setAbsenceStart(event.target.value)} disabled={savingAbsence} /></div><div className="grid gap-1"><Label htmlFor="absence-end" className="text-xs">To</Label><Input id="absence-end" type="date" value={absenceEnd} onChange={(event) => setAbsenceEnd(event.target.value)} disabled={savingAbsence || absenceEndUnknown} /></div></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={absenceEndUnknown} onCheckedChange={(checked) => setAbsenceEndUnknown(checked === true)} disabled={savingAbsence} />End date unknown</label><Input value={absenceReason} onChange={(event) => setAbsenceReason(event.target.value)} placeholder="Reason (optional)" disabled={savingAbsence} /><Button type="button" variant="secondary" onClick={addAbsence} disabled={savingAbsence}>{savingAbsence && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record absence</Button></div>
          </div>
          <aside className="space-y-3 rounded-xl border bg-muted/30 p-4 lg:col-span-1">
            <div><Label>Campaign & pod settings</Label><p className="mt-1 text-xs text-muted-foreground">Choose the pods this person belongs to. Campaign membership follows from the selected pod.</p></div>
            {campaigns.map((campaign) => { const campaignPods = pods.filter((pod) => pod.campaignId === campaign.id); return campaignPods.length ? <div key={campaign.id} className="space-y-2"><p className="text-sm font-medium">{campaign.name}</p>{campaignPods.map((pod) => <label key={pod.id} className="flex items-start gap-2 text-sm"><Checkbox checked={selectedPodIds.includes(pod.id)} onCheckedChange={() => togglePod(pod.id)} disabled={saving} className="mt-0.5" /><span>{pod.name}</span></label>)}</div> : null; })}
            {pods.filter((pod) => !pod.campaignId).length > 0 && <div className="space-y-2"><p className="text-sm font-medium">No campaign</p>{pods.filter((pod) => !pod.campaignId).map((pod) => <label key={pod.id} className="flex items-start gap-2 text-sm"><Checkbox checked={selectedPodIds.includes(pod.id)} onCheckedChange={() => togglePod(pod.id)} disabled={saving} className="mt-0.5" /><span>{pod.name}</span></label>)}</div>}
            {!pods.length && <p className="text-sm text-muted-foreground">No pods available to you.</p>}
          </aside>
        </div>}
        <DialogFooter className="sm:justify-between"><div className="flex gap-2">{canManageAccounts && <Button type="button" variant="outline" onClick={previewPerson} disabled={previewing}>{previewing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Preview</Button>}{canManageAccounts && <Button type="button" variant="destructive" onClick={() => setDeleteOpen(true)}>Delete</Button>}</div><div className="flex gap-2"><Button variant="outline" onClick={() => setDetailOpen(false)} disabled={saving}>Cancel</Button><Button onClick={savePerson} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? 'Saving…' : 'Save changes'}</Button></div></DialogFooter>
      </DialogContent>
    </Dialog>
    <Dialog open={newPersonOpen} onOpenChange={setNewPersonOpen}><DialogContent className="max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>Add person</DialogTitle><DialogDescription>Create an account and choose the initial role(s).</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-2"><Label htmlFor="new-person-name">Name</Label><Input id="new-person-name" value={newPersonName} onChange={(event) => setNewPersonName(event.target.value)} disabled={creatingPerson} /></div><div className="grid gap-2"><Label htmlFor="new-person-email">Email</Label><Input id="new-person-email" type="email" value={newPersonEmail} onChange={(event) => setNewPersonEmail(event.target.value)} disabled={creatingPerson} /></div><div className="grid gap-2"><Label htmlFor="new-person-password">Temporary password</Label><Input id="new-person-password" type="password" value={newPersonPassword} onChange={(event) => setNewPersonPassword(event.target.value)} disabled={creatingPerson} /><p className="text-xs text-muted-foreground">They will need to change this when first signing in.</p></div><div className="grid gap-2"><Label>Roles</Label><div className="grid grid-cols-2 gap-3 rounded-lg border p-3">{allRoles.map((role) => <label key={role} className="flex items-center gap-2 text-sm"><Checkbox checked={newPersonRoles.includes(role)} onCheckedChange={() => toggleNewPersonRole(role)} disabled={creatingPerson} />{roleLabel(role)}</label>)}</div></div></div><DialogFooter><Button variant="outline" onClick={() => setNewPersonOpen(false)} disabled={creatingPerson}>Cancel</Button><Button onClick={createPerson} disabled={creatingPerson}>{creatingPerson && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{creatingPerson ? 'Creating…' : 'Create person'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={editAbsenceOpen} onOpenChange={setEditAbsenceOpen}><DialogContent><DialogHeader><DialogTitle>Correct absence</DialogTitle><DialogDescription>Change the recorded dates or reason, or remove an incorrect entry.</DialogDescription></DialogHeader><div className="grid gap-3"><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1"><Label htmlFor="edit-absence-start">From</Label><Input id="edit-absence-start" type="date" value={absenceStart} onChange={(event) => setAbsenceStart(event.target.value)} disabled={savingAbsence || deletingAbsence} /></div><div className="grid gap-1"><Label htmlFor="edit-absence-end">To</Label><Input id="edit-absence-end" type="date" value={absenceEnd} onChange={(event) => setAbsenceEnd(event.target.value)} disabled={savingAbsence || deletingAbsence || absenceEndUnknown} /></div></div><label className="flex items-center gap-2 text-sm"><Checkbox checked={absenceEndUnknown} onCheckedChange={(checked) => setAbsenceEndUnknown(checked === true)} disabled={savingAbsence || deletingAbsence} />End date unknown</label><Input value={absenceReason} onChange={(event) => setAbsenceReason(event.target.value)} placeholder="Reason (optional)" disabled={savingAbsence || deletingAbsence} /></div><DialogFooter className="sm:justify-between"><Button variant="destructive" onClick={removeAbsence} disabled={savingAbsence || deletingAbsence}>{deletingAbsence ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}Remove</Button><div className="flex gap-2"><Button variant="outline" onClick={() => setEditAbsenceOpen(false)} disabled={savingAbsence || deletingAbsence}>Cancel</Button><Button onClick={updateAbsence} disabled={savingAbsence || deletingAbsence}>{savingAbsence && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save correction</Button></div></DialogFooter></DialogContent></Dialog>
    <Dialog open={campaignOpen} onOpenChange={setCampaignOpen}><DialogContent><DialogHeader><DialogTitle>{editingCampaign ? 'Edit campaign' : 'Add campaign'}</DialogTitle><DialogDescription>Campaign details used to organise pods and competitions.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-2"><Label htmlFor="campaign-name">Name</Label><Input id="campaign-name" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} disabled={savingCampaign} /></div><div className="grid gap-2"><Label htmlFor="campaign-description">Description</Label><Input id="campaign-description" value={campaignDescription} onChange={(event) => setCampaignDescription(event.target.value)} disabled={savingCampaign} /></div></div><DialogFooter><Button variant="outline" onClick={() => setCampaignOpen(false)} disabled={savingCampaign}>Cancel</Button><Button onClick={saveCampaign} disabled={savingCampaign}>{savingCampaign && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{savingCampaign ? 'Saving…' : 'Save campaign'}</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={podOpen} onOpenChange={setPodOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>{editingPod ? 'Edit pod' : 'Add pod'}</DialogTitle><DialogDescription>Pod details remain compatible with the existing Pods management page.</DialogDescription></DialogHeader><div className="grid gap-4"><div className="grid gap-2"><Label htmlFor="pod-name">Name</Label><Input id="pod-name" value={podName} onChange={(event) => setPodName(event.target.value)} disabled={savingPod || deletingPod} /></div><div className="grid gap-2"><Label htmlFor="pod-description">Description</Label><Input id="pod-description" value={podDescription} onChange={(event) => setPodDescription(event.target.value)} disabled={savingPod || deletingPod} /></div><div className="grid gap-2"><Label>Campaign</Label><Select value={podCampaignId} onValueChange={setPodCampaignId} disabled={savingPod || deletingPod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">No campaign</SelectItem>{campaigns.map((campaign) => <SelectItem key={campaign.id} value={campaign.id}>{campaign.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2 sm:grid-cols-2"><div className="grid gap-2"><Label>Team leader</Label><Select value={podTeamLeaderId} onValueChange={setPodTeamLeaderId} disabled={savingPod || deletingPod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not assigned</SelectItem>{people.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Pod manager</Label><Select value={podManagerId} onValueChange={setPodManagerId} disabled={savingPod || deletingPod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not assigned</SelectItem>{people.map((person) => <SelectItem key={person.id} value={person.id}>{person.name}</SelectItem>)}</SelectContent></Select></div></div><div className="grid gap-2 sm:grid-cols-2"><div className="grid gap-2"><Label>Incoming Teams webhook</Label><Select value={podIncomingWebhookId} onValueChange={setPodIncomingWebhookId} disabled={savingPod || deletingPod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not assigned</SelectItem>{webhooks.filter((webhook) => webhook.direction === 'incoming').map((webhook) => <SelectItem key={webhook.id} value={webhook.id}>{webhook.name}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label>Outgoing Teams webhook</Label><Select value={podOutgoingWebhookId} onValueChange={setPodOutgoingWebhookId} disabled={savingPod || deletingPod}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Not assigned</SelectItem>{webhooks.filter((webhook) => webhook.direction === 'outgoing').map((webhook) => <SelectItem key={webhook.id} value={webhook.id}>{webhook.name}</SelectItem>)}</SelectContent></Select></div></div></div><DialogFooter className="sm:justify-between">{editingPod && canDeletePods ? <Button variant="destructive" onClick={() => setDeletePodOpen(true)} disabled={savingPod || deletingPod}>Delete pod</Button> : <span />}<div className="flex gap-2"><Button variant="outline" onClick={() => setPodOpen(false)} disabled={savingPod || deletingPod}>Cancel</Button><Button onClick={savePod} disabled={savingPod || deletingPod}>{savingPod && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{savingPod ? 'Saving…' : 'Save pod'}</Button></div></DialogFooter></DialogContent></Dialog>
    <AlertDialog open={deletePodOpen} onOpenChange={setDeletePodOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {editingPod?.name}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the pod and its memberships. Competitions and other linked data may prevent deletion; no data will be removed unless the server accepts it.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={deletingPod}>Cancel</AlertDialogCancel><AlertDialogAction onClick={deletePod} disabled={deletingPod} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deletingPod && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Delete pod</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {selectedPerson?.name}?</AlertDialogTitle><AlertDialogDescription>This permanently removes the account. You cannot delete your own active account.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={deletePerson} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete user</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

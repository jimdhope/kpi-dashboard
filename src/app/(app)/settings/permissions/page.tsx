'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Save, RotateCcw } from 'lucide-react';
import { PERMISSION_LEVELS } from '@/lib/contracts';
import { DATA_SCOPE_DEFINITIONS, PERMISSION_SECTIONS } from '@/lib/permission-catalog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface Role {
  id: string;
  key: string;
  name: string;
}

interface Permission {
  id: string;
  roleId: string;
  resource: string;
  level: string;
}

interface PendingUpdate {
  roleId: string;
  resource: string;
  level: string;
}
type DataScopeLevel = 'NONE' | 'ASSIGNED_PODS' | 'ALL_PODS';
interface DataScopeRecord { roleId: string; resource: string; level: DataScopeLevel }
interface PendingScopeUpdate extends DataScopeRecord {}

const levelLabels: Record<string, string> = {
  NONE: "No Access",
  VIEW: "View only",
  MANAGE: "View and change",
};
const scopeLabels: Record<DataScopeLevel, string> = { NONE: 'No data access', ASSIGNED_PODS: 'Assigned pods only', ALL_PODS: 'All pods' };

function getLevelColor(level: string): string {
  switch (level) {
    case "MANAGE": return "bg-green-500/20 text-green-500";
    case "VIEW": return "bg-blue-500/20 text-blue-500";
    default: return "bg-gray-500/10 text-muted-foreground";
  }
}

export default function PermissionsPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Record<string, Record<string, string>>>({});
  const [pendingUpdates, setPendingUpdates] = useState<PendingUpdate[]>([]);
  const [dataScopes, setDataScopes] = useState<Record<string, Record<string, DataScopeLevel>>>({});
  const [pendingScopeUpdates, setPendingScopeUpdates] = useState<PendingScopeUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();

  const fetchPermissions = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/permissions');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setRoles(data.roles || []);

      const permMap: Record<string, Record<string, string>> = {};
      for (const perm of data.permissions || []) {
        if (!permMap[perm.roleId]) permMap[perm.roleId] = {};
        permMap[perm.roleId][perm.resource] = perm.level;
      }
      setPermissions(permMap);
      const scopeMap: Record<string, Record<string, DataScopeLevel>> = {};
      for (const scope of data.dataScopes || []) {
        if (!scopeMap[scope.roleId]) scopeMap[scope.roleId] = {};
        scopeMap[scope.roleId][scope.resource] = scope.level;
      }
      setDataScopes(scopeMap);
    } catch (error) {
      console.error('Failed to load permissions:', error);
      toast({ title: 'Error', description: 'Failed to load permissions', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  function getLevel(roleId: string, resource: string): string {
    return permissions[roleId]?.[resource] || 'NONE';
  }

  function hasPending(roleId: string, resource: string): boolean {
    return pendingUpdates.some((u) => u.roleId === roleId && u.resource === resource);
  }

  function handleChange(roleId: string, resource: string, newLevel: string) {
    setPendingUpdates((prev) => {
      const filtered = prev.filter((u) => !(u.roleId === roleId && u.resource === resource));
      if (newLevel !== getLevel(roleId, resource)) {
        return [...filtered, { roleId, resource, level: newLevel }];
      }
      return filtered;
    });
  }

  function getEffectiveLevel(roleId: string, resource: string): string {
    const pending = pendingUpdates.find((u) => u.roleId === roleId && u.resource === resource);
    return pending?.level || getLevel(roleId, resource);
  }
  function getScopeLevel(roleId: string, resource: string): DataScopeLevel { return dataScopes[roleId]?.[resource] || 'NONE'; }
  function getEffectiveScopeLevel(roleId: string, resource: string): DataScopeLevel { return pendingScopeUpdates.find((update) => update.roleId === roleId && update.resource === resource)?.level || getScopeLevel(roleId, resource); }
  function handleScopeChange(roleId: string, resource: string, level: DataScopeLevel) {
    setPendingScopeUpdates((current) => {
      const filtered = current.filter((update) => !(update.roleId === roleId && update.resource === resource));
      return level === getScopeLevel(roleId, resource) ? filtered : [...filtered, { roleId, resource, level }];
    });
  }

  async function handleSave() {
    if (pendingUpdates.length === 0 && pendingScopeUpdates.length === 0) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: pendingUpdates, dataScopeUpdates: pendingScopeUpdates }),
      });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || 'Failed to save permissions');
      }
      await fetchPermissions();
      setPendingUpdates([]);
      setPendingScopeUpdates([]);
      toast({ title: 'Saved', description: 'Permissions updated successfully' });
    } catch (error) {
      toast({
        title: 'Unable to save',
        description: error instanceof Error ? error.message : 'Failed to save permissions',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm('Reset all permissions to defaults? This cannot be undone.')) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/settings/permissions/reset', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to reset');
      await fetchPermissions();
      setPendingUpdates([]);
      setPendingScopeUpdates([]);
      toast({ title: 'Reset', description: 'Permissions reset to defaults' });
    } catch (error) {
      console.error('Failed to reset permissions:', error);
      toast({ title: 'Error', description: 'Failed to reset permissions', variant: 'destructive' });
    } finally {
      setIsResetting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Permission Matrix</h1>
          <p className="text-muted-foreground">Control what each role can see and do</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={isResetting}>
            <RotateCcw className="h-4 w-4 mr-2" />
            {isResetting ? 'Resetting...' : 'Reset Defaults'}
          </Button>
          <Button onClick={handleSave} disabled={(pendingUpdates.length === 0 && pendingScopeUpdates.length === 0) || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : `Save (${pendingUpdates.length + pendingScopeUpdates.length})`}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Role Permissions
          </CardTitle>
          <CardDescription>
            <span className="inline-flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-500">View and change</span> = May update data
              <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-500">View only</span> = Cannot update
              <span className="px-2 py-0.5 rounded text-xs bg-gray-500/10 text-muted-foreground">No Access</span> = Hidden
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="space-y-3">
            {PERMISSION_SECTIONS.map((section) => (
              <AccordionItem key={section.key} value={section.key} className="rounded-lg border bg-card/40 px-4">
                <AccordionTrigger className="hover:no-underline">
                  <span className="text-left">
                    <span className="block font-semibold">{section.label}</span>
                    <span className="block text-xs font-normal text-muted-foreground">{section.description}</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="overflow-x-auto rounded-md border">
                    <table className="w-full border-collapse">
                      <thead><tr>
                        <th className="min-w-[210px] border-b p-3 text-left text-sm font-medium">Permission</th>
                        {roles.map((role) => <th key={role.id} className="min-w-[130px] border-b p-3 text-center text-sm font-medium"><div className="text-xs text-muted-foreground">{role.key}</div><div>{role.name}</div></th>)}
                      </tr></thead>
                      <tbody>
                        {[{ key: section.key, label: `${section.label} access`, description: "Maximum access for this section" }, ...section.children].map((resource) => (
                          <tr key={resource.key} className="border-b last:border-0 hover:bg-muted/30">
                            <td className="p-3"><div className="text-sm font-medium">{resource.label}</div><div className="text-xs text-muted-foreground">{resource.description}</div></td>
                            {roles.map((role) => {
                              const level = getEffectiveLevel(role.id, resource.key);
                              const isPending = hasPending(role.id, resource.key);
                              return <td key={role.id} className="p-2 text-center">
                                <Select value={level} onValueChange={(value) => handleChange(role.id, resource.key, value)}>
                                  <SelectTrigger className={`mx-auto h-8 w-[110px] text-xs ${getLevelColor(level)} ${isPending ? 'ring-2 ring-yellow-400' : ''}`}><SelectValue /></SelectTrigger>
                                  <SelectContent>{PERMISSION_LEVELS.map((permissionLevel) => <SelectItem key={permissionLevel} value={permissionLevel}>{levelLabels[permissionLevel]}</SelectItem>)}</SelectContent>
                                </Select>
                              </td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Data Scope</CardTitle><CardDescription>Choose which pods each role can access. Scope does not grant an action by itself; the corresponding permission above is also required.</CardDescription></CardHeader>
        <CardContent><div className="overflow-x-auto rounded-md border"><table className="w-full border-collapse"><thead><tr><th className="min-w-[240px] border-b p-3 text-left text-sm font-medium">Scope</th>{roles.map((role) => <th key={role.id} className="min-w-[170px] border-b p-3 text-center text-sm font-medium"><div className="text-xs text-muted-foreground">{role.key}</div><div>{role.name}</div></th>)}</tr></thead><tbody>{DATA_SCOPE_DEFINITIONS.map((scope) => <tr key={scope.key} className="border-b last:border-0"><td className="p-3"><div className="text-sm font-medium">{scope.label}</div><div className="text-xs text-muted-foreground">{scope.description}</div></td>{roles.map((role) => { const level=getEffectiveScopeLevel(role.id,scope.key); const pending=pendingScopeUpdates.some((update)=>update.roleId===role.id&&update.resource===scope.key); return <td key={role.id} className="p-2"><Select value={level} onValueChange={(value)=>handleScopeChange(role.id,scope.key,value as DataScopeLevel)}><SelectTrigger className={`mx-auto h-8 w-[155px] text-xs ${pending?'ring-2 ring-yellow-400':''}`}><SelectValue /></SelectTrigger><SelectContent>{(['NONE','ASSIGNED_PODS','ALL_PODS'] as DataScopeLevel[]).map((option)=><SelectItem key={option} value={option}>{scopeLabels[option]}</SelectItem>)}</SelectContent></Select></td>; })}</tr>)}</tbody></table></div></CardContent>
      </Card>
    </div>
  );
}

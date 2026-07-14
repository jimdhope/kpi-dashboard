'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Shield, Save, RotateCcw } from 'lucide-react';
import { NAV_RESOURCES, PERMISSION_LEVELS } from '@/lib/contracts';

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

const resourceLabels: Record<string, string> = {
  "nav.knowledgeBase": "Knowledge Base",
  "nav.directory": "Directory",
  "nav.competitions": "Competitions",
  "nav.performance": "Performance",
  "nav.reports": "Reports",
  "nav.miniGames": "Mini Games",
  "nav.usefulTools": "Tools",
  "nav.activity": "Activity",
  "nav.settings": "Settings",
  "nav.integrations": "Integrations",
};

const levelLabels: Record<string, string> = {
  NONE: "No Access",
  VIEW: "View",
  MANAGE: "Manage",
};

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const { toast } = useToast();

  const resources = NAV_RESOURCES.map((r) => `nav.${r}`);

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

  async function handleSave() {
    if (pendingUpdates.length === 0) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/settings/permissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updates: pendingUpdates }),
      });
      if (!res.ok) throw new Error('Failed to save');
      await fetchPermissions();
      setPendingUpdates([]);
      toast({ title: 'Saved', description: 'Permissions updated successfully' });
    } catch (error) {
      console.error('Failed to save permissions:', error);
      toast({ title: 'Error', description: 'Failed to save permissions', variant: 'destructive' });
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
          <Button onClick={handleSave} disabled={pendingUpdates.length === 0 || isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : `Save (${pendingUpdates.length})`}
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
              <span className="px-2 py-0.5 rounded text-xs bg-green-500/20 text-green-500">Manage</span> = Full access
              <span className="px-2 py-0.5 rounded text-xs bg-blue-500/20 text-blue-500">View</span> = Read-only, scoped
              <span className="px-2 py-0.5 rounded text-xs bg-gray-500/10 text-muted-foreground">No Access</span> = Hidden
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="text-left p-3 font-medium text-sm border-b sticky left-0 bg-card z-10 min-w-[150px]">Resource</th>
                {roles.map((role) => (
                  <th key={role.id} className="p-3 font-medium text-sm border-b text-center min-w-[130px]">
                    <div className="text-xs text-muted-foreground">{role.key}</div>
                    <div>{role.name}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resources.map((resource) => (
                <tr key={resource} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="p-3 text-sm font-medium sticky left-0 bg-card hover:bg-muted/30 z-[1]">
                    {resourceLabels[resource] || resource}
                  </td>
                  {roles.map((role) => {
                    const level = getEffectiveLevel(role.id, resource);
                    const isPending = hasPending(role.id, resource);
                    return (
                      <td key={role.id} className="p-2 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <Select
                            value={level}
                            onValueChange={(v) => handleChange(role.id, resource, v)}
                          >
                            <SelectTrigger className={`w-[110px] h-8 text-xs ${getLevelColor(level)} ${isPending ? 'ring-2 ring-yellow-400' : ''}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PERMISSION_LEVELS.map((lvl) => (
                                <SelectItem key={lvl} value={lvl}>
                                  {levelLabels[lvl] || lvl}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

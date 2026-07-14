'use client';

import { useState, useEffect, useCallback } from 'react';

type PermissionMap = Record<string, 'MANAGE' | 'VIEW' | 'NONE'>;

const cached: { data: PermissionMap | null; roleKey: string | null } = { data: null, roleKey: null };

export function usePermissions(roleKeys: string[]) {
  const [permissions, setPermissions] = useState<PermissionMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    const key = roleKeys.sort().join(',');
    if (cached.roleKey === key && cached.data) {
      setPermissions(cached.data);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch('/api/auth/permissions');
      if (res.ok) {
        const data = await res.json();
        const map = data.permissions || {};
        cached.data = map;
        cached.roleKey = key;
        setPermissions(map);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [roleKeys]);

  useEffect(() => {
    if (roleKeys.length > 0) {
      setIsLoading(true);
      fetchPermissions();
    } else {
      setIsLoading(false);
    }
  }, [roleKeys, fetchPermissions]);

  function getNavLevel(key: string): 'MANAGE' | 'VIEW' | 'NONE' {
    return permissions[`nav.${key}`] || 'NONE';
  }

  function hasNavAccess(key: string): boolean {
    const level = getNavLevel(key);
    return level === 'VIEW' || level === 'MANAGE';
  }

  return { permissions, isLoading, getNavLevel, hasNavAccess };
}

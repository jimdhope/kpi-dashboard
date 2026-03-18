
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { RuleFormData } from '@/models/types';

interface ReadOnlyAchievementCardProps {
  rule: RuleFormData;
  currentValue: number;
}

export function ReadOnlyAchievementCard({ rule, currentValue }: ReadOnlyAchievementCardProps) {
  return (
    <Card className="shadow-sm overflow-hidden flex flex-col h-full">
       <CardHeader className="p-3 pb-0">
         <CardTitle className="text-sm font-medium truncate flex items-center gap-2">
            <span className="text-lg">{rule.emoji || '❓'}</span>
            <span className="truncate" title={rule.name}>{rule.name}</span>
         </CardTitle>
         <CardDescription className="text-xs">{rule.points} pts each</CardDescription>
       </CardHeader>
      <CardContent className="p-3 flex items-center justify-center flex-grow">
        <p className="text-2xl font-bold text-primary">{currentValue}</p>
      </CardContent>
    </Card>
  );
}

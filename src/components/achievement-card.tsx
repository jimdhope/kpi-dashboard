
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RuleFormData } from '@/models/types';

interface AchievementCardProps {
  rule: RuleFormData;
  currentValue: number;
  isSaving: boolean;
  onIncrement: () => void;
  onDecrement: () => void;
  disabled?: boolean;
}

export function AchievementCard({ rule, currentValue, isSaving, onIncrement, onDecrement, disabled = false }: AchievementCardProps) {
  return (
    <Card className={cn("shadow-sm overflow-hidden flex flex-col h-full", disabled && "opacity-50 bg-muted/50")}>
       <CardHeader className="p-3 pb-0">
         <CardTitle className="text-sm font-medium truncate flex items-center gap-2">
            <span className="text-lg">{rule.emoji || '❓'}</span>
            <span className="truncate" title={rule.name}>{rule.name}</span>
         </CardTitle>
         <CardDescription className="text-xs">{rule.points} pts each</CardDescription>
       </CardHeader>
      <CardContent className="p-3 flex items-center justify-between flex-grow">
        {/* The flex-grow class was removed from this div to make the card compact */}
        <div className="flex items-center justify-center">
          <p className="text-2xl font-bold text-primary">{currentValue}</p>
        </div>
        <div className="flex flex-col border-l ml-3 pl-3">
            <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-md border-b"
                onClick={onIncrement}
                disabled={isSaving || disabled}
                aria-label={`Increase ${rule.name}`}
            >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-md"
                onClick={onDecrement}
                disabled={isSaving || currentValue <= 0 || disabled}
                aria-label={`Decrease ${rule.name}`}
            >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-4 w-4" />}
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}

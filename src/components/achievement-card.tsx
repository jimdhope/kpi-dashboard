
'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { RuleFormData } from '@/components/manage-campaign-rules-dialog';

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
    <Card className={cn("shadow-sm overflow-hidden", disabled && "opacity-50 bg-muted/50")}>
      <CardContent className="p-0 flex items-center justify-between">
        <div className="flex-grow p-2 flex items-center justify-center">
          <p className="text-xl font-bold text-primary">{currentValue}</p>
        </div>
        <div className="flex flex-col border-l">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none border-b"
                onClick={onIncrement}
                disabled={isSaving || disabled}
                aria-label={`Increase ${rule.name}`}
            >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-none"
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

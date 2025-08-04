
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
  disabled?: boolean; // Add disabled prop
}

export function AchievementCard({ rule, currentValue, isSaving, onIncrement, onDecrement, disabled = false }: AchievementCardProps) {
  return (
    <Card className={cn("shadow-sm overflow-hidden w-28", disabled && "opacity-50 bg-muted/50")}>
      <CardContent className="p-0 flex h-full items-stretch justify-center">
        <Button
            variant="ghost"
            size="icon"
            className="h-full w-10 rounded-none flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={onDecrement}
            disabled={isSaving || currentValue <= 0 || disabled}
            aria-label={`Decrease ${rule.name}`}
          >
             {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-5 w-5" />}
          </Button>

        <div className="flex-grow p-2 flex items-center justify-center">
           <p className="text-xl font-bold text-primary text-center">{currentValue}</p>
        </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-full w-10 rounded-none flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary"
            onClick={onIncrement}
            disabled={isSaving || disabled}
            aria-label={`Increase ${rule.name}`}
          >
             {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
      </CardContent>
    </Card>
  );
}

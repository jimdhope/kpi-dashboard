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
}

export function AchievementCard({ rule, currentValue, isSaving, onIncrement, onDecrement }: AchievementCardProps) {
  const displayEmoji = rule.emoji && rule.emoji.trim() !== '' ? rule.emoji : '❓';

  return (
    <Card className="shadow-md overflow-hidden">
      <CardContent className="p-0 flex h-full items-stretch"> {/* Ensure parent stretches */}
        {/* Left Section */}
        <div className="flex-grow p-4 pr-2 flex items-center gap-4"> {/* Use flex, items-center, and gap */}
           <span className="text-2xl">{displayEmoji}</span> {/* Emoji */}
           {/* Container for Name, Points, and Value */}
           <div className="flex-grow flex flex-col"> {/* Nested flex column */}
               <h3 className="text-sm font-semibold leading-tight">{rule.name}</h3>
               <p className="text-xs text-muted-foreground">({rule.points} pts)</p>
               <p className="text-xl font-bold text-primary mt-1">{currentValue}</p> {/* Current value below name/points */}
           </div>
        </div>

        {/* Right Section (Buttons) */}
        <div className="flex flex-col w-[70px] flex-shrink-0 border-l">
          <Button
            variant="ghost"
            size="icon"
            className="h-1/2 w-full rounded-none flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary border-b"
            onClick={onIncrement}
            disabled={isSaving}
            aria-label={`Increase ${rule.name}`}
          >
             {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-1/2 w-full rounded-none flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            onClick={onDecrement}
            disabled={isSaving || currentValue <= 0}
            aria-label={`Decrease ${rule.name}`}
          >
             {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-5 w-5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

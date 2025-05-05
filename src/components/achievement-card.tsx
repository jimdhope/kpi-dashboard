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
    <Card className="shadow-md overflow-hidden"> {/* Added overflow-hidden */}
      <CardContent className="p-0 flex"> {/* Remove default padding, use flex */}
        {/* Left Section */}
        <div className="flex-grow p-4 pr-2"> {/* Add padding */}
          <div className="flex items-start gap-2 mb-1">
            <span className="text-2xl mt-[-2px]">{displayEmoji}</span>
            <h3 className="text-sm font-semibold leading-tight flex-grow">{rule.name}</h3>
          </div>
          <p className="text-xs text-muted-foreground pl-8">{rule.points} pts each</p> {/* Indent points */}
          <p className="text-lg font-bold text-primary mt-2 pl-8">{currentValue}</p> {/* Display current value */}
           <p className="text-xs text-muted-foreground pl-8">Logged Today</p>
        </div>

        {/* Right Section (Buttons) */}
        <div className="flex flex-col w-[70px] border-l"> {/* Fixed width for buttons, add border */}
          <Button
            variant="ghost" // Use ghost for seamless look
            size="icon"
            className="h-1/2 w-full rounded-none flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary border-b" // Full width, no radius, vertical centering
            onClick={onIncrement}
            disabled={isSaving}
            aria-label={`Increase ${rule.name}`}
          >
             {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost" // Use ghost for seamless look
            size="icon"
            className="h-1/2 w-full rounded-none flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive" // Full width, no radius, vertical centering
            onClick={onDecrement}
            disabled={isSaving || currentValue <= 0} // Disable if saving or value is 0
            aria-label={`Decrease ${rule.name}`}
          >
             {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Minus className="h-5 w-5" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

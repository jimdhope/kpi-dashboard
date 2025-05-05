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
      <CardContent className="p-0 flex h-full"> {/* Remove default padding, use flex, ensure full height */}
        {/* Left Section */}
        <div className="flex-grow p-4 pr-2 flex flex-col justify-between"> {/* Added flex-col and justify-between */}
          <div className="flex items-start gap-2 mb-1">
              <span className="text-2xl mt-[-2px]">{displayEmoji}</span>
              <div className="flex-grow">
                 <h3 className="text-sm font-semibold leading-tight">{rule.name}</h3>
                 {/* Display points next to the name */}
                 <p className="text-xs text-muted-foreground">({rule.points} pts)</p>
              </div>
          </div>
          <div> {/* Group bottom elements */}
             <p className="text-xl font-bold text-primary mt-2 pl-8">{currentValue}</p> {/* Display current value */}
             {/* Removed "Logged Today" text */}
          </div>
        </div>

        {/* Right Section (Buttons) - Adjusted width and height */}
        <div className="flex flex-col w-[70px] flex-shrink-0 border-l"> {/* Fixed width, ensure it doesn't shrink */}
          <Button
            variant="ghost" // Use ghost for seamless look
            size="icon" // Keep size icon for centering, but override h/w
            className="h-1/2 w-full rounded-none flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary border-b" // Full width, half height, no radius, vertical centering
            onClick={onIncrement}
            disabled={isSaving}
            aria-label={`Increase ${rule.name}`}
          >
             {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
          </Button>
          <Button
            variant="ghost" // Use ghost for seamless look
            size="icon" // Keep size icon for centering, but override h/w
            className="h-1/2 w-full rounded-none flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive" // Full width, half height, no radius, vertical centering
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

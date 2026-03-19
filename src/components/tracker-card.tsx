
'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrackerKpi } from '@/app/(app)/trackers/setup/page';

interface TrackerCardProps {
  kpi: TrackerKpi;
  value: string;
  isSaving: boolean;
  onValueChange: (newValue: string) => void;
  disabled?: boolean;
}

export function TrackerCard({ kpi, value, isSaving, onValueChange, disabled = false }: TrackerCardProps) {
  
  const handleIncrement = () => {
    const numericValue = parseInt(value, 10);
    const currentVal = isNaN(numericValue) ? 0 : numericValue;
    onValueChange(String(currentVal + 1));
  };

  const handleDecrement = () => {
    const numericValue = parseInt(value, 10);
    const currentVal = isNaN(numericValue) ? 0 : numericValue;
    onValueChange(String(Math.max(0, currentVal - 1)));
  };
  
  const numericValueForCheck = parseInt(value, 10);

  return (
    // Single compact card with flex layout
    <Card className={cn("p-2 shadow-sm", disabled && "opacity-50 bg-muted/50")}>
      <div className="flex items-center justify-between gap-2">
        {/* KPI Name on the left */}
        <span className="flex-1 truncate text-sm font-medium" title={kpi.name}>
            {kpi.name}
        </span>

        {/* Controls on the right */}
        <div className="flex items-center gap-1">
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md"
                onClick={handleDecrement}
                disabled={isSaving || isNaN(numericValueForCheck) || numericValueForCheck <= 0 || disabled}
                aria-label={`Decrease ${kpi.name}`}
            >
                <Minus className="h-4 w-4" />
            </Button>

            <div className="relative w-16">
                 <Input
                    type="number"
                    placeholder="0"
                    value={value}
                    onChange={(e) => onValueChange(e.target.value)}
                    className="h-8 text-center text-base font-bold pr-6" // Added padding for loader
                    disabled={isSaving || disabled}
                    min="0"
                 />
                 {isSaving && <Loader2 className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>

            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-md"
                onClick={handleIncrement}
                disabled={isSaving || disabled}
                aria-label={`Increase ${kpi.name}`}
            >
                <Plus className="h-4 w-4" />
            </Button>
        </div>
      </div>
    </Card>
  );
}

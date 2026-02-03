
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TrackerKpi } from '@/app/(admin)/admin/trackers/setup/page';

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
    <Card className={cn("shadow-sm overflow-hidden flex flex-col h-full", disabled && "opacity-50 bg-muted/50")}>
       <CardHeader className="p-3 pb-0">
         <CardTitle className="text-sm font-medium truncate flex items-center justify-center gap-2">
            <span className="truncate" title={kpi.name}>{kpi.name}</span>
         </CardTitle>
       </CardHeader>
      <CardContent className="p-3 flex items-center justify-between flex-grow">
        <div className="relative">
          <Input
            type="number"
            placeholder="0"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="h-10 text-xl font-bold text-center w-24 pr-8"
            disabled={isSaving || disabled}
            min="0"
          />
          {isSaving && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex flex-col">
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleIncrement}
                disabled={isSaving || disabled}
                aria-label={`Increase ${kpi.name}`}
            >
                <Plus className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleDecrement}
                disabled={isSaving || isNaN(numericValueForCheck) || numericValueForCheck <= 0 || disabled}
                aria-label={`Decrease ${kpi.name}`}
            >
                <Minus className="h-4 w-4" />
            </Button>
        </div>
      </CardContent>
    </Card>
  );
}

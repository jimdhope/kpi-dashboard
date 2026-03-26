'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FilterIcon, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Pod {
  id: string;
  name: string;
}

interface ReportFiltersProps {
  dateRange?: { from: Date; to: Date };
  onDateRangeChange: (dateRange: { from: Date; to: Date } | undefined) => void;
  selectedPodId: string;
  onPodChange: (podId: string) => void;
  pods: Pod[];
  onReset?: () => void;
  className?: string;
}

export function ReportFilters({
  dateRange,
  onDateRangeChange,
  selectedPodId,
  onPodChange,
  pods,
  onReset,
  className,
}: ReportFiltersProps) {
  const hasActiveFilters = dateRange || selectedPodId !== 'all';

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const handleDateFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const from = new Date(e.target.value);
    if (dateRange) {
      onDateRangeChange({ from, to: dateRange.to });
    } else {
      onDateRangeChange({ from, to: new Date() });
    }
  };

  const handleDateToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const to = new Date(e.target.value);
    if (dateRange) {
      onDateRangeChange({ from: dateRange.from, to });
    } else {
      onDateRangeChange({ from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), to });
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-3 p-4 rounded-lg bg-card border border-border/50', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <FilterIcon className="h-4 w-4" />
        <span>Filters</span>
      </div>
      
      <div className="flex items-center gap-3 flex-1 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">From:</span>
          <input
            type="date"
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
            value={dateRange ? dateRange.from.toISOString().split('T')[0] : ''}
            onChange={handleDateFromChange}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">To:</span>
          <input
            type="date"
            className="h-10 px-3 rounded-md border border-input bg-background text-sm"
            value={dateRange ? dateRange.to.toISOString().split('T')[0] : ''}
            onChange={handleDateToChange}
          />
        </div>
        
        <div className="w-full sm:w-[200px]">
          <Select value={selectedPodId} onValueChange={onPodChange}>
            <SelectTrigger>
              <SelectValue placeholder="All Pods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Pods</SelectItem>
              {pods.map((pod) => (
                <SelectItem key={pod.id} value={pod.id}>
                  {pod.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {hasActiveFilters && onReset && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="gap-2 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}

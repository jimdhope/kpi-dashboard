'use client';

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangePicker } from '@/components/date-range-picker';
import { Button } from '@/components/ui/button';
import { CalendarIcon, FilterIcon, RotateCcw } from 'lucide-react';
import type { DateRange } from 'react-day-picker';
import { cn } from '@/lib/utils';

export interface ReportFiltersProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (dateRange: DateRange | undefined) => void;
  selectedPodId: string;
  onPodChange: (podId: string) => void;
  pods: Array<{ id: string; name: string }>;
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

  return (
    <div className={cn('flex flex-wrap items-center gap-3 p-4 rounded-lg bg-card border border-border/50', className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <FilterIcon className="h-4 w-4" />
        <span>Filters</span>
      </div>
      
      <div className="flex items-center gap-3 flex-1 flex-wrap">
        <div className="w-full sm:w-[280px]">
          <DateRangePicker
            date={dateRange}
            setDate={onDateRangeChange}
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

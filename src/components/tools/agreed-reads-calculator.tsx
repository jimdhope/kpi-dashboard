'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format, isValid, differenceInCalendarDays } from 'date-fns';

export function AgreedReadsCalculator() {
  const [fuelType, setFuelType] = useState<'electric' | 'gas' | 'both'>('both');
  const [numElectricRates, setNumElectricRates] = useState<1 | 2 | 3>(1);
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [proposedDate, setProposedDate] = useState<Date | undefined>(undefined);
  const [readings, setReadings] = useState<Record<string, string>>({
    startReading1: '', endReading1: '',
    startReading2: '', endReading2: '',
    startReading3: '', endReading3: '',
    startReadingGas: '', endReadingGas: '',
  });

  const showElectricFields = fuelType === 'electric' || fuelType === 'both';
  const showGasFields = fuelType === 'gas' || fuelType === 'both';

  const activeSections = useMemo(() => {
    const sections: { id: string; label: string; startKey: string; endKey: string }[] = [];
    if (showElectricFields) {
      sections.push({ id: '1', label: 'Electricity Rate 1', startKey: 'startReading1', endKey: 'endReading1' });
      if (numElectricRates >= 2) sections.push({ id: '2', label: 'Electricity Rate 2', startKey: 'startReading2', endKey: 'endReading2' });
      if (numElectricRates === 3) sections.push({ id: '3', label: 'Electricity Rate 3', startKey: 'startReading3', endKey: 'endReading3' });
    }
    if (showGasFields) sections.push({ id: 'gas', label: 'Gas', startKey: 'startReadingGas', endKey: 'endReadingGas' });
    return sections;
  }, [fuelType, numElectricRates, showElectricFields, showGasFields]);

  const updateReading = (key: string, value: string) => {
    setReadings(prev => ({ ...prev, [key]: value }));
  };

  const numberOfDays = useMemo(() => {
    if (startDate && endDate && isValid(startDate) && isValid(endDate) && endDate >= startDate) {
      return differenceInCalendarDays(endDate, startDate) + 1;
    }
    return null;
  }, [startDate, endDate]);

  const results = useMemo(() => {
    if (!startDate || !endDate || !proposedDate) return null;
    if (!isValid(startDate) || !isValid(endDate) || !isValid(proposedDate)) return null;
    if (endDate <= startDate) return null;
    if (!numberOfDays || numberOfDays <= 0) return null;

    const totalDays = numberOfDays;
    const daysToProposed = differenceInCalendarDays(proposedDate, startDate);
    const daysFromProposed = differenceInCalendarDays(endDate, proposedDate) + 1;

    const calcReading = (start: string, end: string) => {
      const s = parseFloat(start) || 0;
      const e = parseFloat(end) || 0;
      return (start && end && e >= s) ? e - s : 0;
    };

    return activeSections.map(section => {
      const usage = calcReading(readings[section.startKey], readings[section.endKey]);
      const dailyRate = totalDays > 0 ? usage / totalDays : 0;
      const agreed = dailyRate * daysToProposed;
      return { ...section, usage, dailyRate, agreed };
    });
  }, [startDate, endDate, proposedDate, readings, activeSections, numberOfDays]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Agreed Reads Calculator</h1>
        <p className="text-muted-foreground">Calculate agreed meter reads for billing periods with proposed dates.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <Card className="frosted-glass">
            <CardHeader><CardTitle>Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Fuel Type</Label>
                <RadioGroup value={fuelType} onValueChange={(v) => setFuelType(v as 'electric' | 'gas' | 'both')} className="flex flex-col sm:flex-row sm:space-x-4">
                  <div className="flex items-center space-x-2"><RadioGroupItem value="electric" id="fuel-elec" /><Label htmlFor="fuel-elec">Electricity Only</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="gas" id="fuel-gas" /><Label htmlFor="fuel-gas">Gas Only</Label></div>
                  <div className="flex items-center space-x-2"><RadioGroupItem value="both" id="fuel-both" /><Label htmlFor="fuel-both">Gas & Electricity</Label></div>
                </RadioGroup>
              </div>
              {showElectricFields && (
                <div className="space-y-2">
                  <Label>Number of Electricity Rates</Label>
                  <RadioGroup value={String(numElectricRates)} onValueChange={(v) => setNumElectricRates(Number(v) as 1 | 2 | 3)} className="flex flex-col sm:flex-row sm:space-x-4">
                    <div className="flex items-center space-x-2"><RadioGroupItem value="1" id="nr-1" /><Label htmlFor="nr-1">1 Rate</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="2" id="nr-2" /><Label htmlFor="nr-2">2 Rates</Label></div>
                    <div className="flex items-center space-x-2"><RadioGroupItem value="3" id="nr-3" /><Label htmlFor="nr-3">3 Rates</Label></div>
                  </RadioGroup>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="frosted-glass">
            <CardHeader><CardTitle>Date Range</CardTitle><CardDescription>Enter the billing period and proposed date.</CardDescription></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !startDate && 'text-muted-foreground')}>
                      {startDate && isValid(startDate) ? format(startDate, 'dd-MM-yyyy') : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !endDate && 'text-muted-foreground')}>
                      {endDate && isValid(endDate) ? format(endDate, 'dd-MM-yyyy') : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={setEndDate} disabled={(date) => startDate ? date < startDate : false} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Proposed Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !proposedDate && 'text-muted-foreground')}>
                      {proposedDate && isValid(proposedDate) ? format(proposedDate, 'dd-MM-yyyy') : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={proposedDate} onSelect={setProposedDate} disabled={(date) => startDate ? date < startDate : false} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </CardContent>
          </Card>

          <Card className="frosted-glass">
            <CardHeader><CardTitle>Meter Readings</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {activeSections.map(section => (
                <div key={section.id} className="p-3 border rounded-md">
                  <Label>{section.label}</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                    <div className="space-y-1"><Label className="text-xs">Start Reading</Label><Input type="number" step="any" placeholder="0" value={readings[section.startKey]} onChange={e => updateReading(section.startKey, e.target.value)} /></div>
                    <div className="space-y-1"><Label className="text-xs">End Reading</Label><Input type="number" step="any" placeholder="0" value={readings[section.endKey]} onChange={e => updateReading(section.endKey, e.target.value)} /></div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="frosted-glass lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="text-lg">Results</CardTitle>
              <CardDescription>
                {numberOfDays ? `${numberOfDays} days total` : 'Select dates'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {results ? (
                <>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><p className="text-xs text-muted-foreground">Days to Proposed</p><p className="font-bold">{results.length > 0 ? differenceInCalendarDays(proposedDate!, startDate!) : 0}</p></div>
                    <div><p className="text-xs text-muted-foreground">Proposed Date</p><p className="font-bold">{proposedDate ? format(proposedDate, 'dd-MM') : '—'}</p></div>
                  </div>
                  <Separator />
                  {results.map(r => (
                    <div key={r.id} className="space-y-1">
                      <p className="text-xs font-medium">{r.label}</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Usage:</span>
                        <span>{r.usage.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Daily:</span>
                        <span>{r.dailyRate.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-semibold text-primary">
                        <span>Agreed:</span>
                        <span>{r.agreed.toFixed(2)}</span>
                      </div>
                      <Separator className="mt-2" />
                    </div>
                  ))}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Enter dates and readings to see results.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

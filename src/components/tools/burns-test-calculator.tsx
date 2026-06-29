'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';

export function BurnsTestCalculator() {
  const [fuelType, setFuelType] = useState<'electric' | 'gas' | 'both'>('both');
  const [numElectricRates, setNumElectricRates] = useState<1 | 2 | 3>(1);
  const [readings, setReadings] = useState<Record<string, string[]>>({
    'electricity-rate-1': Array(7).fill(''),
    'electricity-rate-2': Array(7).fill(''),
    'electricity-rate-3': Array(7).fill(''),
    'gas': Array(7).fill(''),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const showElectricFields = fuelType === 'electric' || fuelType === 'both';
  const showGasFields = fuelType === 'gas' || fuelType === 'both';

  const activeSections = useMemo(() => {
    const sections: { id: string; label: string }[] = [];
    if (showElectricFields) {
      sections.push({ id: 'electricity-rate-1', label: 'Electricity Rate 1' });
      if (numElectricRates >= 2) sections.push({ id: 'electricity-rate-2', label: 'Electricity Rate 2' });
      if (numElectricRates === 3) sections.push({ id: 'electricity-rate-3', label: 'Electricity Rate 3' });
    }
    if (showGasFields) sections.push({ id: 'gas', label: 'Gas' });
    return sections;
  }, [fuelType, numElectricRates, showElectricFields, showGasFields]);

  const handleDayChange = (sectionId: string, dayIndex: number, value: string) => {
    setReadings(prev => ({
      ...prev,
      [sectionId]: prev[sectionId].map((d, i) => i === dayIndex ? value : d),
    }));
    setErrors(prev => {
      const next = { ...prev };
      delete next[sectionId];
      return next;
    });
  };

  const results = useMemo(() => {
    const newResults: Record<string, number | null> = {};
    const newErrors: Record<string, string> = {};

    for (const section of activeSections) {
      const values = readings[section.id].map(d => d === '' ? null : parseFloat(d));
      let hasAnyValue = false;
      for (const v of values) { if (v !== null) { hasAnyValue = true; break; } }
      if (!hasAnyValue) { newResults[section.id] = null; continue; }

      let valid = true;
      for (let i = 1; i < 7; i++) {
        const prev = values[i - 1];
        const curr = values[i];
        if (prev === null && curr !== null) {
          newErrors[section.id] = `Day ${i + 1} has a value but Day ${i} is empty`;
          valid = false; break;
        }
        if (prev !== null && curr !== null && curr < prev) {
          newErrors[section.id] = `Day ${i + 1} (${curr}) must be >= Day ${i} (${prev})`;
          valid = false; break;
        }
      }

      if (valid) {
        const first = values[0];
        const last = values[6];
        if (first !== null && last !== null && last >= first) {
          newResults[section.id] = parseFloat((last - first).toFixed(2));
        } else {
          newResults[section.id] = null;
        }
      } else {
        newResults[section.id] = null;
      }
    }

    setErrors(newErrors);
    return newResults;
  }, [readings, activeSections]);

  return (
    <div className="space-y-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-4 space-y-6">
          {activeSections.map(section => (
            <Card key={section.id} className="frosted-glass">
              <CardHeader>
                <CardTitle>{section.label}</CardTitle>
                <CardDescription>Enter readings for Day 1 through Day 7</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  {readings[section.id].map((day, index) => (
                    <div key={index} className="space-y-1">
                      <Label className="text-xs">Day {index + 1}</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={day}
                        onChange={(e) => handleDayChange(section.id, index, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
                {errors[section.id] && <p className="text-sm text-destructive mt-2">{errors[section.id]}</p>}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-1">
          <Card className="frosted-glass lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle className="text-lg">Results</CardTitle>
              <CardDescription>Day 7 − Day 1</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeSections.map((section, i) => (
                <div key={section.id}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{section.label.split(' ').pop()}:</span>
                    <span className="text-lg font-bold">
                      {results[section.id] !== null ? results[section.id] : '—'}
                    </span>
                  </div>
                  {i < activeSections.length - 1 && <Separator className="mt-2" />}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

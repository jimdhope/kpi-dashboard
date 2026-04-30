'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format, differenceInCalendarDays, addDays, startOfDay, isValid } from 'date-fns';

const IMPERIAL_FT3_TO_M3_FACTOR = 0.0283168;
const VOLUME_CORRECTION_FACTOR = 1.02264;
const CALORIFIC_VALUE = 40.0;
const KWH_CONVERSION_DIVISOR = 3.6;
const AVG_DAYS_IN_MONTH = 30.4375;

export function EnergyUsageCalculator() {
  const [fuelType, setFuelType] = useState<'electric' | 'gas' | 'both'>('both');
  const [numElectricRates, setNumElectricRates] = useState<1 | 2 | 3>(1);
  const [inputMode, setInputMode] = useState<'readings' | 'direct'>('readings');
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(startOfDay(addDays(new Date(), 30)));
  const [numberOfDays, setNumberOfDays] = useState<number | null>(31);
  const [electricStartReading1, setElectricStartReading1] = useState('');
  const [electricEndReading1, setElectricEndReading1] = useState('');
  const [electricRate1, setElectricRate1] = useState('');
  const [electricStartReading2, setElectricStartReading2] = useState('');
  const [electricEndReading2, setElectricEndReading2] = useState('');
  const [electricRate2, setElectricRate2] = useState('');
  const [electricStartReading3, setElectricStartReading3] = useState('');
  const [electricEndReading3, setElectricEndReading3] = useState('');
  const [electricRate3, setElectricRate3] = useState('');
  const [electricStandingCharge, setElectricStandingCharge] = useState('');
  const [electricUnits1, setElectricUnits1] = useState('');
  const [electricUnits2, setElectricUnits2] = useState('');
  const [electricUnits3, setElectricUnits3] = useState('');
  const [gasStartReading, setGasStartReading] = useState('');
  const [gasEndReading, setGasEndReading] = useState('');
  const [gasUnitType, setGasUnitType] = useState<'metric' | 'imperial' | ''>('');
  const [gasUnits, setGasUnits] = useState('');
  const [gasRate, setGasRate] = useState('');
  const [gasStandingCharge, setGasStandingCharge] = useState('');

  useEffect(() => {
    if (isValid(startDate) && isValid(endDate) && endDate >= startDate) {
      setNumberOfDays(differenceInCalendarDays(endDate, startDate));
    } else {
      setNumberOfDays(null);
    }
  }, [startDate, endDate]);

  const showElectricFields = fuelType === 'electric' || fuelType === 'both';
  const showGasFields = fuelType === 'gas' || fuelType === 'both';

  const result = useMemo(() => {
    if (numberOfDays === null || numberOfDays <= 0) return null;

    let electricUsage1 = 0, electricCost1 = 0, electricUsage2 = 0, electricCost2 = 0, electricUsage3 = 0, electricCost3 = 0;
    let totalElectricStandingCharge = 0, totalElectricCost = 0;
    let rawGasUsage = 0, convertedGasUsage = 0, gasCost = 0, totalGasStandingCharge = 0, totalGasCost = 0;

    if (showElectricFields) {
      const elRate1 = (parseFloat(electricRate1) || 0) / 100;
      const elStandingCharge = (parseFloat(electricStandingCharge) || 0) / 100;
      if (inputMode === 'readings') {
        const elStart1 = parseFloat(electricStartReading1) || 0;
        const elEnd1 = parseFloat(electricEndReading1) || 0;
        electricUsage1 = (electricStartReading1 && electricEndReading1 && elEnd1 >= elStart1) ? (elEnd1 - elStart1) : 0;
      } else {
        electricUsage1 = parseFloat(electricUnits1) || 0;
      }
      electricCost1 = electricUsage1 * elRate1;

      if (numElectricRates >= 2) {
        const elRate2 = (parseFloat(electricRate2) || 0) / 100;
        if (inputMode === 'readings') {
          const elStart2 = parseFloat(electricStartReading2) || 0;
          const elEnd2 = parseFloat(electricEndReading2) || 0;
          electricUsage2 = (electricStartReading2 && electricEndReading2 && elEnd2 >= elStart2) ? (elEnd2 - elStart2) : 0;
        } else {
          electricUsage2 = parseFloat(electricUnits2) || 0;
        }
        electricCost2 = electricUsage2 * elRate2;
      }
      if (numElectricRates === 3) {
        const elRate3 = (parseFloat(electricRate3) || 0) / 100;
        if (inputMode === 'readings') {
          const elStart3 = parseFloat(electricStartReading3) || 0;
          const elEnd3 = parseFloat(electricEndReading3) || 0;
          electricUsage3 = (electricStartReading3 && electricEndReading3 && elEnd3 >= elStart3) ? (elEnd3 - elStart3) : 0;
        } else {
          electricUsage3 = parseFloat(electricUnits3) || 0;
        }
        electricCost3 = electricUsage3 * elRate3;
      }
      totalElectricStandingCharge = elStandingCharge * numberOfDays;
      totalElectricCost = electricCost1 + electricCost2 + electricCost3 + totalElectricStandingCharge;
    }

    if (showGasFields) {
      const gasRateVal = (parseFloat(gasRate) || 0) / 100;
      const gasStandingChargeVal = (parseFloat(gasStandingCharge) || 0) / 100;
      if (inputMode === 'readings') {
        const gasStart = parseFloat(gasStartReading) || 0;
        const gasEnd = parseFloat(gasEndReading) || 0;
        rawGasUsage = (gasStartReading && gasEndReading && gasEnd >= gasStart) ? (gasEnd - gasStart) : 0;
        if (gasUnitType && rawGasUsage > 0) {
          convertedGasUsage = gasUnitType === 'metric'
            ? rawGasUsage * VOLUME_CORRECTION_FACTOR * CALORIFIC_VALUE / KWH_CONVERSION_DIVISOR
            : rawGasUsage * IMPERIAL_FT3_TO_M3_FACTOR * VOLUME_CORRECTION_FACTOR * CALORIFIC_VALUE / KWH_CONVERSION_DIVISOR;
        }
      } else {
        convertedGasUsage = parseFloat(gasUnits) || 0;
      }
      gasCost = convertedGasUsage * gasRateVal;
      totalGasStandingCharge = gasStandingChargeVal * numberOfDays;
      totalGasCost = gasCost + totalGasStandingCharge;
    }

    const totalCostForPeriod = totalElectricCost + totalGasCost;
    const dailyCost = totalCostForPeriod / numberOfDays;
    const totalElectricUsage = electricUsage1 + electricUsage2 + electricUsage3;
    const totalGasUsage = convertedGasUsage;

    return {
      numberOfDays, electricUsage1, electricCost1, electricUsage2, electricCost2, electricUsage3, electricCost3,
      totalElectricUsage, totalElectricStandingCharge, totalElectricCost, rawGasUsage, convertedGasUsage, gasCost,
      totalGasStandingCharge, totalGasCost, totalCostForPeriod,
      dailyCost, monthlyCost: dailyCost * AVG_DAYS_IN_MONTH, yearlyCost: dailyCost * 365.25,
    };
  }, [
    numberOfDays, fuelType, numElectricRates, inputMode,
    electricStartReading1, electricEndReading1, electricRate1,
    electricStartReading2, electricEndReading2, electricRate2,
    electricStartReading3, electricEndReading3, electricRate3,
    electricStandingCharge, electricUnits1, electricUnits2, electricUnits3,
    gasStartReading, gasEndReading, gasUnitType, gasUnits, gasRate, gasStandingCharge,
    showElectricFields, showGasFields,
  ]);

  return (
    <div className="space-y-6">
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
            <CardHeader><CardTitle>Date Range</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <div role="button" tabIndex={0} className={cn('w-full pl-3 text-left font-normal cursor-pointer border rounded-md px-3 py-2 text-sm bg-background hover:bg-accent hover:text-accent-foreground', !startDate && 'text-muted-foreground')}>
                      {startDate && isValid(startDate) ? format(startDate, 'dd-MM-yyyy') : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50 inline" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={startDate} onSelect={(d) => d && setStartDate(d)} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <div role="button" tabIndex={0} className={cn('w-full pl-3 text-left font-normal cursor-pointer border rounded-md px-3 py-2 text-sm bg-background hover:bg-accent hover:text-accent-foreground', !endDate && 'text-muted-foreground')}>
                      {endDate && isValid(endDate) ? format(endDate, 'dd-MM-yyyy') : <span>Pick a date</span>}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50 inline" />
                    </div>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={endDate} onSelect={(d) => d && setEndDate(d)} disabled={(date) => startDate && date < startDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Number of Days</Label>
                <Input type="number" value={numberOfDays ?? ''} readOnly placeholder="Calculated" />
              </div>
            </CardContent>
          </Card>

          <Card className="frosted-glass">
            <CardHeader><CardTitle>Usage Input Method</CardTitle></CardHeader>
            <CardContent>
              <RadioGroup value={inputMode} onValueChange={(v) => setInputMode(v as 'readings' | 'direct')} className="flex flex-col sm:flex-row sm:space-x-4">
                <div className="flex items-center space-x-2"><RadioGroupItem value="readings" id="mode-readings" /><Label htmlFor="mode-readings">Calculate from Meter Readings</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="direct" id="mode-direct" /><Label htmlFor="mode-direct">Enter Usage Directly (kWh)</Label></div>
              </RadioGroup>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {showElectricFields && (
              <Card className="frosted-glass">
                <CardHeader><CardTitle>Electricity Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {[1, 2, 3].map((tier) => {
                    if (tier === 2 && numElectricRates < 2) return null;
                    if (tier === 3 && numElectricRates < 3) return null;
                    const readingStart = tier === 1 ? electricStartReading1 : tier === 2 ? electricStartReading2 : electricStartReading3;
                    const readingEnd = tier === 1 ? electricEndReading1 : tier === 2 ? electricEndReading2 : electricEndReading3;
                    const rate = tier === 1 ? electricRate1 : tier === 2 ? electricRate2 : electricRate3;
                    const units = tier === 1 ? electricUnits1 : tier === 2 ? electricUnits2 : electricUnits3;
                    const setReadingStart = tier === 1 ? setElectricStartReading1 : tier === 2 ? setElectricStartReading2 : setElectricStartReading3;
                    const setReadingEnd = tier === 1 ? setElectricEndReading1 : tier === 2 ? setElectricEndReading2 : setElectricEndReading3;
                    const setRate = tier === 1 ? setElectricRate1 : tier === 2 ? setElectricRate2 : setElectricRate3;
                    const setUnits = tier === 1 ? setElectricUnits1 : tier === 2 ? setElectricUnits2 : setElectricUnits3;

                    return (
                      <div key={tier} className="space-y-3 p-3 border rounded-md">
                        <Label>Electricity Rate {tier}</Label>
                        {inputMode === 'readings' ? (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div className="space-y-1"><Label className="text-xs">Start (kWh)</Label><Input type="number" step="any" placeholder="0" value={readingStart} onChange={e => setReadingStart(e.target.value)} /></div>
                            <div className="space-y-1"><Label className="text-xs">End (kWh)</Label><Input type="number" step="any" placeholder="0" value={readingEnd} onChange={e => setReadingEnd(e.target.value)} /></div>
                            <div className="space-y-1"><Label className="text-xs">Rate (p/kWh)</Label><Input type="number" step="0.01" placeholder="0" value={rate} onChange={e => setRate(e.target.value)} /></div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div className="space-y-1"><Label className="text-xs">Units Used (kWh)</Label><Input type="number" step="any" placeholder="0" value={units} onChange={e => setUnits(e.target.value)} /></div>
                            <div className="space-y-1"><Label className="text-xs">Rate (p/kWh)</Label><Input type="number" step="0.01" placeholder="0" value={rate} onChange={e => setRate(e.target.value)} /></div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="space-y-1"><Label>Standing Charge (p/day)</Label><Input type="number" step="0.01" placeholder="Charge" value={electricStandingCharge} onChange={e => setElectricStandingCharge(e.target.value)} /></div>
                </CardContent>
              </Card>
            )}

            {showGasFields && (
              <Card className="frosted-glass">
                <CardHeader><CardTitle>Gas Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {inputMode === 'readings' && (
                    <>
                      <div className="space-y-3 p-3 border rounded-md">
                        <Label>Gas Readings</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div className="space-y-1"><Label className="text-xs">Start (units)</Label><Input type="number" step="any" placeholder="0" value={gasStartReading} onChange={e => setGasStartReading(e.target.value)} /></div>
                          <div className="space-y-1"><Label className="text-xs">End (units)</Label><Input type="number" step="any" placeholder="0" value={gasEndReading} onChange={e => setGasEndReading(e.target.value)} /></div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Gas Unit Type</Label>
                        <Select value={gasUnitType} onValueChange={(v) => setGasUnitType(v as 'metric' | 'imperial' | '')}>
                          <SelectTrigger><SelectValue placeholder="Select unit type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="metric">Metric (m³)</SelectItem>
                            <SelectItem value="imperial">Imperial (ft³)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  {inputMode === 'direct' && (
                    <div className="space-y-1"><Label>Gas Units Used (kWh)</Label><Input type="number" step="any" placeholder="0" value={gasUnits} onChange={e => setGasUnits(e.target.value)} /></div>
                  )}
                  <div className="space-y-1"><Label>Gas Rate (p/kWh)</Label><Input type="number" step="0.01" placeholder="Rate" value={gasRate} onChange={e => setGasRate(e.target.value)} /></div>
                  <div className="space-y-1"><Label>Standing Charge (p/day)</Label><Input type="number" step="0.01" placeholder="Charge" value={gasStandingCharge} onChange={e => setGasStandingCharge(e.target.value)} /></div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="lg:col-span-1">
          <Card className="frosted-glass lg:sticky lg:top-6">
            <CardHeader><CardTitle className="text-lg">Summary</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {result ? (
                <>
                  <div className="flex justify-between"><span className="text-muted-foreground">Days:</span><span>{result.numberOfDays}</span></div>
                  <Separator />
                  {showElectricFields && (
                    <>
                      <div className="text-xs font-medium text-primary">Electricity</div>
                      {numElectricRates >= 1 && (
                        <>
                          <div className="flex justify-between pl-2"><span className="text-muted-foreground">Rate 1:</span><span>{result.electricUsage1.toFixed(2)} kWh @ £{result.electricCost1.toFixed(2)}</span></div>
                        </>
                      )}
                      {numElectricRates >= 2 && (
                        <div className="flex justify-between pl-2"><span className="text-muted-foreground">Rate 2:</span><span>{result.electricUsage2.toFixed(2)} kWh @ £{result.electricCost2.toFixed(2)}</span></div>
                      )}
                      {numElectricRates >= 3 && (
                        <div className="flex justify-between pl-2"><span className="text-muted-foreground">Rate 3:</span><span>{result.electricUsage3.toFixed(2)} kWh @ £{result.electricCost3.toFixed(2)}</span></div>
                      )}
                      <div className="flex justify-between pl-2"><span className="text-muted-foreground">Standing:</span><span>£{result.totalElectricStandingCharge.toFixed(2)}</span></div>
                      {numElectricRates > 1 && (
                        <div className="flex justify-between font-semibold pl-2"><span>Subtotal:</span><span>£{result.totalElectricCost.toFixed(2)}</span></div>
                      )}
                      <Separator />
                    </>
                  )}
                  {showGasFields && (
                    <>
                      <div className="text-xs font-medium text-primary">Gas</div>
                      <div className="flex justify-between pl-2"><span className="text-muted-foreground">Usage:</span><span>{result.convertedGasUsage.toFixed(2)} kWh @ £{result.gasCost.toFixed(2)}</span></div>
                      <div className="flex justify-between pl-2"><span className="text-muted-foreground">Standing:</span><span>£{result.totalGasStandingCharge.toFixed(2)}</span></div>
                      <Separator />
                    </>
                  )}
                  <div className="flex justify-between font-bold text-primary text-base"><span>Total Cost:</span><span>£{result.totalCostForPeriod.toFixed(2)}</span></div>
                  <Separator />
                  <div className="flex justify-between"><span className="text-muted-foreground">Daily:</span><span>£{result.dailyCost.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Monthly:</span><span>£{result.monthlyCost.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Yearly:</span><span>£{result.yearlyCost.toFixed(2)}</span></div>
                </>
              ) : (
                <p className="text-muted-foreground">Enter dates and usage details to see the summary.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

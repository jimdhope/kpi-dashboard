'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { CalendarIcon } from 'lucide-react';
import { format, addDays, getDay, parseISO, startOfDay, isValid } from 'date-fns';

interface SuggestedPlan {
  months: number;
  monthlyInstalment: number;
  totalMonthlyWithUsage: number;
}

export function InstalmentPlanCalculator() {
  const [currentBalance, setCurrentBalance] = useState('');
  const [usageAmount, setUsageAmount] = useState('');
  const [instalmentAmount, setInstalmentAmount] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(startOfDay(addDays(new Date(), 15)));

  const suggestedPlans = useMemo<SuggestedPlan[]>(() => {
    const balance = parseFloat(currentBalance);
    const usage = parseFloat(usageAmount);
    if (isNaN(balance) || balance <= 0) return [];
    return [12, 18, 24].map(months => {
      const monthlyInstalment = balance / months;
      return { months, monthlyInstalment, totalMonthlyWithUsage: monthlyInstalment + (isNaN(usage) ? 0 : usage) };
    });
  }, [currentBalance, usageAmount]);

  const result = useMemo(() => {
    const balance = parseFloat(currentBalance);
    const usage = parseFloat(usageAmount);
    const instalment = parseFloat(instalmentAmount);
    if (isNaN(balance) || balance <= 0 || isNaN(instalment) || instalment <= 0 || !startDate || !isValid(startDate)) return null;

    const totalMonthlyPayment = (isNaN(usage) ? 0 : usage) + instalment;
    const numberOfInstalments = Math.ceil(balance / instalment);
    let endDate = addDays(addMonths(startDate, numberOfInstalments - 1), 0);
    const dayOfWeek = getDay(endDate);
    if (dayOfWeek === 6) endDate = addDays(endDate, 2);
    else if (dayOfWeek === 0) endDate = addDays(endDate, 1);

    let finalPaymentAmount = balance % instalment;
    if (finalPaymentAmount === 0) finalPaymentAmount = instalment;
    if (numberOfInstalments === 1) finalPaymentAmount = balance;

    return {
      displayedUsageAmount: isNaN(usage) ? 0 : usage,
      displayedInstalmentAmount: instalment,
      totalMonthlyPayment,
      numberOfInstalments,
      startDateDisplay: format(startDate, 'dd-MM-yyyy'),
      endDateDisplay: format(endDate, 'dd-MM-yyyy'),
      finalPaymentAmount,
    };
  }, [currentBalance, usageAmount, instalmentAmount, startDate]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <Card className="frosted-glass">
            <CardHeader><CardTitle>Discussion Points</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ul className="list-disc space-y-1 pl-5">
                <li>We offer multiple payment methods (DD, PP, RCM).</li>
                <li>Additional payments can be made at any time to reduce the balance.</li>
                <li>Can they clear the balance or make a partial payment today?</li>
                <li>Offer Energy efficiency advise to help reduce ongoing costs.</li>
                <li>Will this instalment plan effect any other priority bills.</li>
                <li>Free debt advice available from Step Change and Scottish Power Hardship Fund.</li>
                <li>Instalment plans over 12 months may affect credit score.</li>
              </ul>
            </CardContent>
          </Card>

          <Card className="frosted-glass">
            <CardHeader><CardTitle>Balance Details</CardTitle><CardDescription>Enter your current balance to see suggested plans.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label htmlFor="currentBalance">Current Balance (£)</Label><Input id="currentBalance" type="number" placeholder="e.g., 1200" value={currentBalance} onChange={e => setCurrentBalance(e.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="usageAmount">Typical Monthly Usage Amount (£)</Label><Input id="usageAmount" type="number" placeholder="e.g., 50" value={usageAmount} onChange={e => setUsageAmount(e.target.value)} /></div>
              {suggestedPlans.length > 0 && (
                <div>
                  <h4 className="text-md font-medium mb-2 text-primary">Suggested Payment Plans:</h4>
                  {suggestedPlans.map(plan => (
                    <p key={plan.months} className="text-sm text-muted-foreground">{plan.months} Months: £{plan.monthlyInstalment.toFixed(2)}/month (Total: £{plan.totalMonthlyWithUsage.toFixed(2)})</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="frosted-glass">
            <CardHeader><CardTitle>Payment Details</CardTitle><CardDescription>Enter the details for your instalment plan.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
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
                    <Calendar mode="single" selected={startDate} onSelect={setStartDate} disabled={(date) => date < startOfDay(new Date())} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2"><Label htmlFor="instalmentAmount">Instalment Amount (£)</Label><Input id="instalmentAmount" type="number" placeholder="e.g., 100" value={instalmentAmount} onChange={e => setInstalmentAmount(e.target.value)} /></div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <Card className="frosted-glass lg:sticky lg:top-6">
            <CardHeader><CardTitle className="text-lg">Plan Details</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {result ? (
                <>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Usage:</span><span>£{result.displayedUsageAmount.toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Instalment:</span><span>£{result.displayedInstalmentAmount.toFixed(2)}</span></div>
                    <Separator />
                    <div className="flex justify-between font-bold text-primary"><span>Total Monthly:</span><span>£{result.totalMonthlyPayment.toFixed(2)}</span></div>
                    <Separator />
                    <div className="flex justify-between"><span className="text-muted-foreground">Instalments:</span><span>{result.numberOfInstalments}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Start:</span><span>{result.startDateDisplay}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">End:</span><span>{result.endDateDisplay}</span></div>
                    <Separator />
                    <div className="flex justify-between font-semibold"><span>Final Payment:</span><span>£{result.finalPaymentAmount.toFixed(2)}</span></div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Enter balance and instalment amount to see plan details.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

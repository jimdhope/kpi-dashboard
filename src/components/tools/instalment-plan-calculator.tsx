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

function calculateInstalmentPlan(
  balance: number,
  usage: number,
  instalmentAmount: number,
  startDate: Date,
) {
  const totalMonthlyPayment = usage + instalmentAmount;
  const numberOfInstalments = Math.ceil(balance / instalmentAmount);
  let endDate = addDays(addMonths(startDate, numberOfInstalments - 1), 0);
  const dayOfWeek = getDay(endDate);
  if (dayOfWeek === 6) endDate = addDays(endDate, 2);
  else if (dayOfWeek === 0) endDate = addDays(endDate, 1);

  let finalPaymentAmount = balance % instalmentAmount;
  if (finalPaymentAmount === 0) finalPaymentAmount = instalmentAmount;
  if (numberOfInstalments === 1) finalPaymentAmount = balance;

  return {
    displayedUsageAmount: usage,
    displayedInstalmentAmount: instalmentAmount,
    totalMonthlyPayment,
    numberOfInstalments,
    startDateDisplay: format(startDate, 'dd-MM-yyyy'),
    endDateDisplay: format(endDate, 'dd-MM-yyyy'),
    finalPaymentAmount,
  };
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export function InstalmentPlanCalculator() {
  const [checkedItems, setCheckedItems] = useState<Record<number, boolean>>({});
  
  const atpQuestions = [
    "Bill account to date and confirm account balance",
    "Ask customer if they can clear the balance on the account today",
    "If not able to clear the balance ask if they can make a partial payment today",
    "Advise customer: gas and electricity are priority bills. Can try to help by going through current tariff options and setting up an instalment plan tailored to their circumstances. Other payment methods: Direct Debit, cash monthly, or prepayment meter.",
    "Advise customer of current tariff options / perform tariff change and confirm ongoing usage amount",
    "Advise customer that you are going to take them through some repayment options",
    "Advise customer that if an instalment plan is agreed and it goes over 12 months we will notify Credit Reference Agencies and it could affect their credit score.",
    "Advise of repayment amount over 12 months",
    "Advise of repayment amount over 18 months",
    "Advise of repayment amount over 24 months",
    "Ask if any of the three options are affordable",
    "If not discuss affordability start with the current ongoing usage as that is not changeable and ask what is affordable on top of this each month.",
    "Once amount agreed confirm with customer if they would be able to afford on top of monthly usage and would it effect any other priority bills (Rent/mortgage, Council Tax, Food etc)",
    "Confirm the instalment plan start date, End Date, Number of payments and final payment amount",
    "Offer to sign post to Step Change and Scottish Power Hardship Fund",
    "Offer to send Energy Efficiency advice.",
    "Ensure the Priority Service Register is updated with any new information making sure to read out any consent scripts",
  ];

  const toggleCheck = (idx: number) => {
    setCheckedItems(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const checkedCount = Object.values(checkedItems).filter(Boolean).length;
  const [accountType, setAccountType] = useState<'single' | 'twoAccounts'>('single');
  const [accountNumber, setAccountNumber] = useState('');
  const [currentBalance, setCurrentBalance] = useState('');
  const [usageAmount, setUsageAmount] = useState('');
  const [instalmentAmount, setInstalmentAmount] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(startOfDay(addDays(new Date(), 15)));

  const [accountNumber2, setAccountNumber2] = useState('');
  const [currentBalance2, setCurrentBalance2] = useState('');
  const [usageAmount2, setUsageAmount2] = useState('');
  const [instalmentAmount2, setInstalmentAmount2] = useState('');
  const [startDate2, setStartDate2] = useState<Date | undefined>(startOfDay(addDays(new Date(), 15)));

  const suggestedPlans = useMemo<SuggestedPlan[]>(() => {
    const balance = parseFloat(currentBalance);
    const usage = parseFloat(usageAmount);
    if (isNaN(balance) || balance <= 0) return [];
    return [12, 18, 24].map(months => {
      const monthlyInstalment = balance / months;
      return { months, monthlyInstalment, totalMonthlyWithUsage: monthlyInstalment + (isNaN(usage) ? 0 : usage) };
    });
  }, [currentBalance, usageAmount]);

  const suggestedPlans2 = useMemo<SuggestedPlan[]>(() => {
    const balance = parseFloat(currentBalance2);
    const usage = parseFloat(usageAmount2);
    if (isNaN(balance) || balance <= 0) return [];
    return [12, 18, 24].map(months => {
      const monthlyInstalment = balance / months;
      return { months, monthlyInstalment, totalMonthlyWithUsage: monthlyInstalment + (isNaN(usage) ? 0 : usage) };
    });
  }, [currentBalance2, usageAmount2]);

  const result1 = useMemo(() => {
    const balance = parseFloat(currentBalance);
    const usage = parseFloat(usageAmount);
    const instalment = parseFloat(instalmentAmount);
    if (isNaN(balance) || balance <= 0 || isNaN(instalment) || instalment <= 0 || !startDate || !isValid(startDate)) return null;
    return calculateInstalmentPlan(balance, usage, instalment, startDate);
  }, [currentBalance, usageAmount, instalmentAmount, startDate]);

  const result2 = useMemo(() => {
    if (accountType !== 'twoAccounts') return null;
    const balance = parseFloat(currentBalance2);
    const usage = parseFloat(usageAmount2);
    const instalment = parseFloat(instalmentAmount2);
    if (isNaN(balance) || balance <= 0 || isNaN(instalment) || instalment <= 0 || !startDate2 || !isValid(startDate2)) return null;
    return calculateInstalmentPlan(balance, usage, instalment, startDate2);
  }, [accountType, currentBalance2, usageAmount2, instalmentAmount2, startDate2]);

  const combined = useMemo(() => {
    if (accountType !== 'twoAccounts' || !result1 || !result2) return null;
    return {
      totalBalance: parseFloat(currentBalance) + parseFloat(currentBalance2),
      totalUsage: parseFloat(usageAmount || '0') + parseFloat(usageAmount2 || '0'),
      totalRepayment: parseFloat(instalmentAmount || '0') + parseFloat(instalmentAmount2 || '0'),
    };
  }, [accountType, result1, result2, currentBalance, currentBalance2, usageAmount, usageAmount2, instalmentAmount, instalmentAmount2]);

  return (
    <div className="space-y-6">
      {/* ATP Ability to Pay Questions Checklist */}
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Ability to Pay — Call Guide</span>
            <span className="text-sm font-normal text-muted-foreground">{checkedCount} / {atpQuestions.length} completed</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {atpQuestions.map((q, i) => (
              <label key={i} className="flex items-start gap-3 cursor-pointer hover:bg-muted/50 rounded p-2 -mx-2 transition-colors">
                <input
                  type="checkbox"
                  checked={!!checkedItems[i]}
                  onChange={() => toggleCheck(i)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className={`text-sm ${checkedItems[i] ? 'line-through text-muted-foreground' : ''}`}>{q}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-4 space-y-6">
          {/* Account type toggle */}
          <Card className="frosted-glass">
            <CardHeader><CardTitle>Account Type</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-b-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                    accountType === "single" && "bg-background text-foreground border-b-2 border-primary",
                  )}
                  onClick={() => setAccountType('single')}
                >
                  Single Account
                </button>
                <button
                  type="button"
                  className={cn(
                    "flex-1 rounded-b-md px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                    accountType === "twoAccounts" && "bg-background text-foreground border-b-2 border-primary",
                  )}
                  onClick={() => setAccountType('twoAccounts')}
                >
                  Two Accounts
                </button>
              </div>
            </CardContent>
          </Card>

          {accountType === 'twoAccounts' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Account 1 */}
              <Card className="frosted-glass">
                <CardHeader>
                  <CardTitle>Account 1 — Balance & Usage</CardTitle>
                  <CardDescription>Enter the balance and typical monthly usage for this account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Account Number</Label><Input type="text" placeholder="e.g., 12345678" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Current Balance (£)</Label><Input type="number" placeholder="e.g., 1200" value={currentBalance} onChange={e => setCurrentBalance(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Typical Monthly Usage (£)</Label><Input type="number" placeholder="e.g., 50" value={usageAmount} onChange={e => setUsageAmount(e.target.value)} /></div>
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
              {/* Account 2 */}
              <Card className="frosted-glass">
                <CardHeader>
                  <CardTitle>Account 2 — Balance & Usage</CardTitle>
                  <CardDescription>Enter the balance and typical monthly usage for this account.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2"><Label>Account Number</Label><Input type="text" placeholder="e.g., 87654321" value={accountNumber2} onChange={e => setAccountNumber2(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Current Balance (£)</Label><Input type="number" placeholder="e.g., 800" value={currentBalance2} onChange={e => setCurrentBalance2(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Typical Monthly Usage (£)</Label><Input type="number" placeholder="e.g., 40" value={usageAmount2} onChange={e => setUsageAmount2(e.target.value)} /></div>
                  {suggestedPlans2.length > 0 && (
                    <div>
                      <h4 className="text-md font-medium mb-2 text-primary">Suggested Payment Plans:</h4>
                      {suggestedPlans2.map(plan => (
                        <p key={plan.months} className="text-sm text-muted-foreground">{plan.months} Months: £{plan.monthlyInstalment.toFixed(2)}/month (Total: £{plan.totalMonthlyWithUsage.toFixed(2)})</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="frosted-glass">
              <CardHeader><CardTitle>Balance & Usage</CardTitle><CardDescription>Enter your current balance to see suggested plans.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Account Number</Label><Input type="text" placeholder="e.g., 12345678" value={accountNumber} onChange={e => setAccountNumber(e.target.value)} /></div>
                <div className="space-y-2"><Label>Current Balance (£)</Label><Input type="number" placeholder="e.g., 1200" value={currentBalance} onChange={e => setCurrentBalance(e.target.value)} /></div>
                <div className="space-y-2"><Label>Typical Monthly Usage (£)</Label><Input type="number" placeholder="e.g., 50" value={usageAmount} onChange={e => setUsageAmount(e.target.value)} /></div>
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
          )}

          {/* Payment details */}
          {accountType === 'twoAccounts' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="frosted-glass">
                <CardHeader><CardTitle>Account 1 — Payment Details</CardTitle></CardHeader>
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
                  <div className="space-y-2"><Label>Instalment Amount (£)</Label><Input type="number" placeholder="e.g., 100" value={instalmentAmount} onChange={e => setInstalmentAmount(e.target.value)} /></div>
                </CardContent>
              </Card>
              <Card className="frosted-glass">
                <CardHeader><CardTitle>Account 2 — Payment Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Start Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('w-full pl-3 text-left font-normal', !startDate2 && 'text-muted-foreground')}>
                          {startDate2 && isValid(startDate2) ? format(startDate2, 'dd-MM-yyyy') : <span>Pick a date</span>}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={startDate2} onSelect={setStartDate2} disabled={(date) => date < startOfDay(new Date())} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2"><Label>Instalment Amount (£)</Label><Input type="number" placeholder="e.g., 80" value={instalmentAmount2} onChange={e => setInstalmentAmount2(e.target.value)} /></div>
                </CardContent>
              </Card>
            </div>
          ) : (
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
                <div className="space-y-2"><Label>Instalment Amount (£)</Label><Input type="number" placeholder="e.g., 100" value={instalmentAmount} onChange={e => setInstalmentAmount(e.target.value)} /></div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Results sidebar */}
        <div className="lg:col-span-1">
          <Card className="frosted-glass lg:sticky lg:top-6">
            <CardHeader><CardTitle className="text-lg">Plan Details</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {accountType === 'single' && result1 && (
                <div className="space-y-2 text-sm">
                  {accountNumber && <div className="flex justify-between"><span className="text-muted-foreground">Account:</span><span>{accountNumber}</span></div>}
                  <div className="flex justify-between"><span className="text-muted-foreground">Usage:</span><span>£{result1.displayedUsageAmount.toFixed(2)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Instalment:</span><span>£{result1.displayedInstalmentAmount.toFixed(2)}</span></div>
                  <Separator />
                  <div className="flex justify-between font-bold text-primary"><span>Total Monthly:</span><span>£{result1.totalMonthlyPayment.toFixed(2)}</span></div>
                  <Separator />
                  <div className="flex justify-between"><span className="text-muted-foreground">Instalments:</span><span>{result1.numberOfInstalments}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Start:</span><span>{result1.startDateDisplay}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">End:</span><span>{result1.endDateDisplay}</span></div>
                  <Separator />
                  <div className="flex justify-between font-semibold"><span>Final Payment:</span><span>£{result1.finalPaymentAmount.toFixed(2)}</span></div>
                </div>
              )}

              {accountType === 'twoAccounts' && (result1 || result2 || combined) && (
                <div className="space-y-4">
                  {result1 && (
                    <div className="space-y-2 text-sm">
                      <h4 className="font-semibold text-primary">Account 1</h4>
                      {accountNumber && <div className="flex justify-between"><span className="text-muted-foreground">Account:</span><span>{accountNumber}</span></div>}
                      <div className="flex justify-between"><span className="text-muted-foreground">Total Monthly:</span><span className="font-bold">£{result1.totalMonthlyPayment.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Instalments:</span><span>{result1.numberOfInstalments}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Start:</span><span>{result1.startDateDisplay}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">End:</span><span>{result1.endDateDisplay}</span></div>
                      <div className="flex justify-between font-semibold"><span>Final Payment:</span><span>£{result1.finalPaymentAmount.toFixed(2)}</span></div>
                    </div>
                  )}
                  {result2 && (
                    <div className="space-y-2 text-sm">
                      <h4 className="font-semibold text-primary">Account 2</h4>
                      {accountNumber2 && <div className="flex justify-between"><span className="text-muted-foreground">Account:</span><span>{accountNumber2}</span></div>}
                      <div className="flex justify-between"><span className="text-muted-foreground">Total Monthly:</span><span className="font-bold">£{result2.totalMonthlyPayment.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Instalments:</span><span>{result2.numberOfInstalments}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Start:</span><span>{result2.startDateDisplay}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">End:</span><span>{result2.endDateDisplay}</span></div>
                      <div className="flex justify-between font-semibold"><span>Final Payment:</span><span>£{result2.finalPaymentAmount.toFixed(2)}</span></div>
                    </div>
                  )}
                  {combined && (
                    <div className="space-y-2 text-sm">
                      <Separator />
                      <h4 className="font-semibold text-primary">Combined Totals</h4>
                      <div className="flex justify-between"><span className="text-muted-foreground">Total Balances:</span><span>£{combined.totalBalance.toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Total Usage:</span><span>£{combined.totalUsage.toFixed(2)}</span></div>
                      <div className="flex justify-between font-bold text-primary"><span>Total Repayment:</span><span>£{combined.totalRepayment.toFixed(2)}</span></div>
                    </div>
                  )}
                </div>
              )}

              {!result1 && !result2 && !combined && (
                <p className="text-sm text-muted-foreground">Enter balance and instalment amount to see plan details.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

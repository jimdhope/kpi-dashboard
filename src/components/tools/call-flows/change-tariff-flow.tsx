'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, CalendarIcon, Lightbulb } from 'lucide-react';
import { format, addDays, getDay, isWeekend } from 'date-fns';

export interface ChangeTariffState {
  tariffName?: string;
  usagePaymentAmount?: string;
  instalmentPaymentAmount?: string;
  paymentDate?: Date;
  summary?: string;
}

interface ChangeTariffFlowProps {
  onStateChange: (state: ChangeTariffState) => void;
}

const steps = [
  { id: 1, title: 'Initiate in UI5' },
  { id: 2, title: 'Ask Key Questions' },
  { id: 3, title: 'Advise on Quotes' },
  { id: 4, title: 'Present Tariff Options' },
  { id: 5, title: 'Explain Payment Calculation' },
  { id: 6, title: 'Read Important Information' },
  { id: 7, title: 'Explain DD Calculation' },
  { id: 8, title: 'Read Smart Script' },
  { id: 9, title: 'Confirm Bank Details' },
  { id: 10, title: 'Read Final Statement' },
  { id: 11, title: 'Final Confirmation' },
  { id: 12, title: 'Confirm on UI5' },
];

function getMinDate(): Date {
  const today = new Date();
  let minDate = addDays(today, 1);
  let workingDaysAdded = 0;
  while (workingDaysAdded < 10) {
    minDate = addDays(minDate, 1);
    const dayOfWeek = getDay(minDate);
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDaysAdded++;
    }
  }
  return minDate;
}

function isDateDisabled(date: Date): boolean {
  const minDate = getMinDate();
  if (date < minDate) return true;
  if (isWeekend(date)) return true;
  if (date.getDate() > 28) return true;
  return false;
}

export function ChangeTariffFlow({ onStateChange }: ChangeTariffFlowProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [tariffName, setTariffName] = useState('');
  const [usagePaymentAmount, setUsagePaymentAmount] = useState('');
  const [instalmentPaymentAmount, setInstalmentPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  useEffect(() => {
    const summaryParts: string[] = [];

    if (tariffName) {
      summaryParts.push(`Tariff changed to '${tariffName}'`);
    }

    if (usagePaymentAmount || instalmentPaymentAmount) {
      const usage = usagePaymentAmount ? parseFloat(usagePaymentAmount) : 0;
      const instalment = instalmentPaymentAmount ? parseFloat(instalmentPaymentAmount) : 0;
      const total = usage + instalment;
      const paymentStr = `monthly payment of £${total.toFixed(2)} (£${usage.toFixed(2)} usage + £${instalment.toFixed(2)} IP)`;
      summaryParts.push(`with a ${paymentStr}`);
    }

    if (paymentDate) {
      summaryParts.push(`First payment on ${format(paymentDate, 'dd-MM-yyyy')}`);
    }

    onStateChange({
      tariffName: tariffName || undefined,
      usagePaymentAmount: usagePaymentAmount || undefined,
      instalmentPaymentAmount: instalmentPaymentAmount || undefined,
      paymentDate,
      summary: summaryParts.join(' ').trim() || undefined,
    });
  }, [tariffName, usagePaymentAmount, instalmentPaymentAmount, paymentDate, onStateChange]);

  const handleMarkComplete = () => {
    const newCompleted = new Set(completedSteps);
    newCompleted.add(currentStep);
    setCompletedSteps(newCompleted);
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleStepClick = (stepId: number) => {
    if (stepId <= currentStep || completedSteps.has(stepId - 1)) {
      setCurrentStep(stepId);
    }
  };

  const stepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Initiate Change Tariff in UI5</h3>
            <p className="text-sm text-muted-foreground">
              In the UI5 menu, click on <strong>Change Tariff</strong>.
            </p>
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>Tip</AlertTitle>
              <AlertDescription>
                Ensure you are on the correct customer account before proceeding.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Ask Key Questions</h3>
            <p className="text-sm text-muted-foreground">Ask the following questions to understand the customer&apos;s needs:</p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li>What is most important to you: <strong>cheapest tariff</strong>, <strong>green energy</strong>, or <strong>price certainty</strong>?</li>
              <li>Are you a <strong>homeowner</strong>?</li>
              <li>Are you <strong>over 18</strong>?</li>
              <li>Do you have an <strong>EV charger</strong>?</li>
            </ul>
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>Important</AlertTitle>
              <AlertDescription>
                These questions determine which tariff options are suitable for the customer.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Advise on Quotes</h3>
            <p className="text-sm text-muted-foreground">Read the following script to the customer:</p>
            <div className="rounded-lg bg-muted p-4 text-sm italic">
              &quot;The quotes I am about to go through are based on your energy usage over the last 12 months. If your usage changes, your payments may also change.&quot;
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Present Tariff Options</h3>
            <p className="text-sm text-muted-foreground">Advise the customer on the following details for each tariff option:</p>
            <ul className="list-disc list-inside space-y-2 text-sm">
              <li><strong>Tariff Name</strong></li>
              <li><strong>Type:</strong> Fixed, Flexi, or Variable</li>
              <li><strong>End Date</strong> (for fixed tariffs)</li>
              <li><strong>Exit Fees</strong></li>
              <li><strong>Extras</strong> (e.g., green energy, rewards)</li>
              <li><strong>Online or Offline</strong> tariff</li>
            </ul>
            <Alert variant="destructive">
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>WARNING</AlertTitle>
              <AlertDescription>
                YOU CAN NOT ADVISE CUSTOMER WHICH TARIFF TO SELECT. Present the options and let the customer decide.
              </AlertDescription>
            </Alert>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="tariffName">Selected Tariff Name</Label>
              <Input
                id="tariffName"
                placeholder="Enter the tariff name selected by the customer"
                value={tariffName}
                onChange={(e) => setTariffName(e.target.value)}
              />
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Explain Payment Calculation</h3>
            <p className="text-sm text-muted-foreground">Read the following script to explain how the cost is calculated:</p>
            <div className="rounded-lg bg-muted p-4 text-sm italic">
              &quot;Your monthly payment is calculated based on your estimated annual energy usage divided by 12. This includes both your usage charges and any instalment plan payments. The amount may be reviewed periodically based on your actual usage.&quot;
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Read Important Information</h3>
            <p className="text-sm text-muted-foreground">
              Read out the <strong>important information</strong> at the bottom of the screen to the customer.
            </p>
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>Reminder</AlertTitle>
              <AlertDescription>
                Do not skip this step. The important information contains key terms and conditions the customer must be aware of.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 7:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Explain DD Calculation</h3>
            <p className="text-sm text-muted-foreground">Read the following script:</p>
            <div className="rounded-lg bg-muted p-4 text-sm italic">
              &quot;Your Direct Debit amount has been calculated based on your estimated annual usage. This ensures your account stays in credit throughout the year.&quot;
            </div>
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>Payment Date Rules</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Must be at least <strong>10 working days</strong> from today</li>
                  <li>Cannot be on a <strong>weekend</strong></li>
                  <li>Cannot be after the <strong>28th</strong> of any month</li>
                </ul>
              </AlertDescription>
            </Alert>
            <Separator />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="usagePayment">Payment for Usage (£)</Label>
                <Input
                  id="usagePayment"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 100.00"
                  value={usagePaymentAmount}
                  onChange={(e) => setUsagePaymentAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="instalmentPayment">Payment for Instalment Plan (£)</Label>
                <Input
                  id="instalmentPayment"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 20.00"
                  value={instalmentPaymentAmount}
                  onChange={(e) => setInstalmentPaymentAmount(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>First Payment Date</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      !paymentDate && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {paymentDate ? format(paymentDate, 'PPP') : 'Select a date'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={paymentDate}
                    onSelect={(date) => {
                      setPaymentDate(date);
                      setCalendarOpen(false);
                    }}
                    disabled={isDateDisabled}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        );

      case 8:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Read Smart Script</h3>
            <p className="text-sm text-muted-foreground">
              If the customer has <strong>smart meters</strong> installed, read out the smart script.
            </p>
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>Note</AlertTitle>
              <AlertDescription>
                The smart script can be found in the UI5 system. Ensure you read it verbatim to the customer.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 9:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Confirm Bank Details</h3>
            <p className="text-sm text-muted-foreground">
              Confirm the <strong>bank details</strong> on the account with the customer.
            </p>
            <Alert variant="destructive">
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>WARNING</AlertTitle>
              <AlertDescription>
                If the caller is not the account holder, you cannot discuss or confirm bank details. Verify the caller&apos;s identity before proceeding.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 10:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Read Final Statement</h3>
            <p className="text-sm text-muted-foreground">
              Read out the <strong>final statement</strong> to the customer before completing the tariff change.
            </p>
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>Reminder</AlertTitle>
              <AlertDescription>
                This statement confirms the terms of the new tariff and ensures the customer is fully informed.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 11:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Final Confirmation</h3>
            <p className="text-sm text-muted-foreground">Confirm the following details with the customer:</p>
            <div className="rounded-lg bg-muted p-4 space-y-2 text-sm">
              {tariffName ? (
                <p><strong>Tariff:</strong> {tariffName}</p>
              ) : (
                <p className="text-muted-foreground"><strong>Tariff:</strong> Not specified</p>
              )}
              {(usagePaymentAmount || instalmentPaymentAmount) ? (
                <p>
                  <strong>Monthly Payment:</strong> £{((parseFloat(usagePaymentAmount) || 0) + (parseFloat(instalmentPaymentAmount) || 0)).toFixed(2)}
                  {usagePaymentAmount && ` (£${parseFloat(usagePaymentAmount).toFixed(2)} usage`}
                  {instalmentPaymentAmount && ` + £${parseFloat(instalmentPaymentAmount).toFixed(2)} IP)`}
                </p>
              ) : (
                <p className="text-muted-foreground"><strong>Monthly Payment:</strong> Not specified</p>
              )}
              {paymentDate ? (
                <p><strong>First Payment Date:</strong> {format(paymentDate, 'dd-MM-yyyy')}</p>
              ) : (
                <p className="text-muted-foreground"><strong>First Payment Date:</strong> Not specified</p>
              )}
            </div>
            <Alert>
              <Lightbulb className="h-4 w-4" />
              <AlertTitle>Advise</AlertTitle>
              <AlertDescription>
                A welcome pack will be sent to the customer&apos;s address confirming the tariff change.
              </AlertDescription>
            </Alert>
          </div>
        );

      case 12:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Confirm on UI5</h3>
            <p className="text-sm text-muted-foreground">
              Confirm the <strong>tariff change</strong> on UI5 to complete the process.
            </p>
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>Process Complete</AlertTitle>
              <AlertDescription>
                Once confirmed on UI5, the tariff change is active. Ensure all notes are logged on the account.
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="frosted-glass">
      <CardHeader>
        <CardTitle>Process Flow: Change Tariff</CardTitle>
        <CardDescription>Guide for changing a customer&apos;s tariff through the call flow.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="hidden lg:block w-56 shrink-0">
            <nav className="space-y-1">
              {steps.map((step) => {
                const isCompleted = completedSteps.has(step.id);
                const isCurrent = currentStep === step.id;
                return (
                  <button
                    key={step.id}
                    onClick={() => handleStepClick(step.id)}
                    className={cn(
                      'flex items-center gap-3 w-full text-left px-3 py-2 rounded-md text-sm transition-colors',
                      isCurrent && 'bg-primary/10 text-primary font-medium',
                      isCompleted && 'text-muted-foreground',
                      !isCurrent && !isCompleted && 'text-muted-foreground/60 hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                    ) : (
                      <Circle className={cn('h-4 w-4 shrink-0', isCurrent && 'text-primary')} />
                    )}
                    <span className="truncate">{step.id}. {step.title}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="lg:hidden overflow-x-auto">
            <div className="flex gap-2 pb-2 min-w-max">
              {steps.map((step) => {
                const isCompleted = completedSteps.has(step.id);
                const isCurrent = currentStep === step.id;
                return (
                  <button
                    key={step.id}
                    onClick={() => handleStepClick(step.id)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors border',
                      isCurrent && 'bg-primary text-primary-foreground border-primary',
                      isCompleted && 'bg-muted border-border text-muted-foreground',
                      !isCurrent && !isCompleted && 'border-border text-muted-foreground/60'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <Circle className="h-3 w-3" />
                    )}
                    {step.title}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="mb-4">
              <span className="text-xs font-medium text-muted-foreground">
                Step {currentStep} of {steps.length}
              </span>
              <h3 className="text-xl font-semibold mt-1">{steps[currentStep - 1]?.title}</h3>
            </div>
            <Separator className="mb-6" />
            {stepContent()}
            <div className="mt-8 flex justify-end">
              <Button onClick={handleMarkComplete}>
                {currentStep < steps.length ? 'Mark as Complete & Continue' : 'Mark as Complete'}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

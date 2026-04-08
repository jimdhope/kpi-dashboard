'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, ArrowRight, Copy, PlusCircle, MinusCircle, RotateCcw, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { SubmitMeterReadingsFlow, type MeterReadingsState } from './call-flows/submit-meter-readings-flow';
import { ChangeTariffFlow, type ChangeTariffState } from './call-flows/change-tariff-flow';
import { InstalmentPlanFlow, type InstalmentPlanState } from './call-flows/instalment-plan-flow';
import { PrePaymentMeterFlow, type PrePaymentMeterState } from './call-flows/prepayment-meter-flow';

const callFlowSteps = [
  { id: 'opening', title: 'Opening / Greeting' },
  { id: 'reason', title: 'Reason for call' },
  { id: 'dpa', title: 'DPA Checks' },
  { id: 'psr', title: 'Updating the Priority Service Register' },
  { id: 'marketing', title: 'Updating Marketing Permission' },
  { id: 'es-upsell', title: 'ES Upsell' },
  { id: 'smart-meter', title: 'Smart Meter Appointment' },
  { id: 'review', title: 'Account Review' },
  { id: 'enquiry', title: "Address customer's enquiry" },
  { id: 'complaints', title: 'Raise any Complaints' },
  { id: 'summarise', title: 'Summarise Call' },
  { id: 'closing', title: 'Closing the Call' },
];

const dpaQuestions = [
  { id: 'address', label: 'First line of address' },
  { id: 'postcode', label: 'Postcode' },
  { id: 'dob', label: 'Date of Birth' },
  { id: 'phone', label: 'Telephone number' },
];
const alternativeDpaQuestions = [
  { id: 'email', label: 'Email address' },
  { id: 'paymentMethod', label: 'How they pay their Energy Bill' },
  { id: 'lastPaymentAmount', label: 'Last payment amount made' },
];

const dpaUpdateOptions = [
  { id: 'Captured Phone', label: 'Captured Phone' },
  { id: 'Captured Email', label: 'Captured Email' },
  { id: 'Captured DOB', label: 'Captured DOB' },
];

type ActiveFlow = 'submitMeterReadings' | 'changeTariff' | 'instalmentPlan' | 'prePaymentMeter';

export function CallFlow() {
  const { toast } = useToast();
  const [openAccordionItem, setOpenAccordionItem] = useState('item-0');
  const [callerName, setCallerName] = useState('');
  const [accountHolderStatus, setAccountHolderStatus] = useState<'unanswered' | 'yes' | 'no'>('unanswered');
  const [thirdPartyStatus, setThirdPartyStatus] = useState<string | null>(null);
  const [problemNotes, setProblemNotes] = useState('');
  const [actionsTaken, setActionsTaken] = useState<Record<string, string>>({});
  const [dpaChecks, setDpaChecks] = useState<Record<string, boolean>>({});
  const [automatedDpaPassed, setAutomatedDpaPassed] = useState(false);
  const [dpaUpdates, setDpaUpdates] = useState<string[]>([]);
  const [psrFinancial, setPsrFinancial] = useState('');
  const [psrAge, setPsrAge] = useState('');
  const [psrChildren, setPsrChildren] = useState('');
  const [psrHealth, setPsrHealth] = useState('');
  const [marketingPermissionCompleted, setMarketingPermissionCompleted] = useState(false);
  const [esUpsellCompleted, setEsUpsellCompleted] = useState(false);
  const [smartMeterStatus, setSmartMeterStatus] = useState<'pending' | 'not-ready' | 'refused' | 'booked' | 'already-installed'>('pending');
  const [accountReviewCompleted, setAccountReviewCompleted] = useState(false);
  const [complaintStatus, setComplaintStatus] = useState<'none' | 'ratoc' | 'non-ratoc'>('none');
  const [ratocReason, setRatocReason] = useState('');
  const [ratocActions, setRatocActions] = useState('');
  const [ratocRef, setRatocRef] = useState('');
  const [nonRatocReason, setNonRatocReason] = useState('');
  const [nonRatocAgentActions, setNonRatocAgentActions] = useState('');
  const [nonRatocCustomerResolution, setNonRatocCustomerResolution] = useState('');
  const [nonRatocRef, setNonRatocRef] = useState('');
  const [nonRatocDate, setNonRatocDate] = useState<Date | undefined>(undefined);
  const [nonRatocTime, setNonRatocTime] = useState('');
  const [activeFlows, setActiveFlows] = useState<ActiveFlow[]>([]);
  const [scratchpadNotes, setScratchpadNotes] = useState('');

  const [meterReadingsState, setMeterReadingsState] = useState<MeterReadingsState>({});
  const [changeTariffState, setChangeTariffState] = useState<ChangeTariffState>({});
  const [instalmentPlanState, setInstalmentPlanState] = useState<InstalmentPlanState>({ billedToDate: false, onBestTariff: false });
  const [prePaymentMeterState, setPrePaymentMeterState] = useState<PrePaymentMeterState>({});

  const dpaPassedCount = Object.values(dpaChecks).filter(Boolean).length;
  const isDpaPassed = dpaPassedCount >= 4 || automatedDpaPassed;

  const getTenWorkingDaysFromNow = () => {
    let date = new Date();
    let daysAdded = 0;
    while (daysAdded < 10) {
      date.setDate(date.getDate() + 1);
      const dayOfWeek = date.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) daysAdded++;
    }
    return date;
  };

  const tenWorkingDaysDate = format(getTenWorkingDaysFromNow(), 'dd-MM-yyyy');

  const advanceToNextStep = (currentStepIndex: number) => {
    let nextStepIndex = currentStepIndex + 1;
    if (automatedDpaPassed && callFlowSteps[nextStepIndex]?.id === 'dpa') nextStepIndex++;
    if (nextStepIndex < callFlowSteps.length) setOpenAccordionItem(`item-${nextStepIndex}`);
  };

  const handleResetFlow = () => {
    setOpenAccordionItem('item-0');
    setCallerName('');
    setAccountHolderStatus('unanswered');
    setThirdPartyStatus(null);
    setProblemNotes('');
    setActionsTaken({});
    setDpaChecks({});
    setAutomatedDpaPassed(false);
    setDpaUpdates([]);
    setPsrFinancial('');
    setPsrAge('');
    setPsrChildren('');
    setPsrHealth('');
    setMarketingPermissionCompleted(false);
    setEsUpsellCompleted(false);
    setSmartMeterStatus('pending');
    setAccountReviewCompleted(false);
    setComplaintStatus('none');
    setRatocReason('');
    setRatocActions('');
    setRatocRef('');
    setNonRatocReason('');
    setNonRatocAgentActions('');
    setNonRatocCustomerResolution('');
    setNonRatocRef('');
    setNonRatocDate(undefined);
    setNonRatocTime('');
    setActiveFlows([]);
    setScratchpadNotes('');
    setMeterReadingsState({});
    setChangeTariffState({});
    setInstalmentPlanState({ billedToDate: false, onBestTariff: false });
    setPrePaymentMeterState({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFlow = (flow: ActiveFlow) => {
    setActiveFlows(prev => prev.includes(flow) ? prev.filter(f => f !== flow) : [...prev, flow]);
  };

  const handleInstalmentPlanFlowToggle = () => {
    setActiveFlows(prev => {
      const instalmentPlanActive = prev.includes('instalmentPlan');
      const flowsToToggle: ActiveFlow[] = ['instalmentPlan', 'submitMeterReadings', 'changeTariff'];
      if (instalmentPlanActive) return prev.filter(f => !flowsToToggle.includes(f));
      return Array.from(new Set([...prev, ...flowsToToggle]));
    });
  };

  const toggleDpaUpdate = (update: string) => {
    setDpaUpdates(prev => prev.includes(update) ? prev.filter(u => u !== update) : [...prev, update]);
  };

  const handleCopyToClipboard = (text: string, fieldName: string) => {
    if (!text) {
      toast({ variant: 'destructive', title: 'Nothing to Copy', description: `The "${fieldName}" field is empty.` });
      return;
    }
    navigator.clipboard.writeText(text).then(() => {
      toast({ title: 'Copied to Clipboard', description: `The content of "${fieldName}" has been copied.` });
    }).catch(() => {
      toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy text to clipboard.' });
    });
  };

  const problemList = problemNotes.split('\n').filter(line => line.trim() !== '');

  const renderAccordionContent = (step: typeof callFlowSteps[0], index: number) => {
    const showNextButton = index > 0 && index < callFlowSteps.length - 1;
    let nextButton = showNextButton ? (
      <div className="flex justify-end mt-4">
        <Button onClick={() => advanceToNextStep(index)}>Next <ArrowRight className="mr-2 h-4 w-4" /></Button>
      </div>
    ) : null;

    if (step.id === 'opening') {
      nextButton = null;
      return (
        <div className="space-y-4">
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="inbound-script">
              <AccordionTrigger>Inbound Call Script</AccordionTrigger>
              <AccordionContent>
                <p className="italic text-muted-foreground">"Good Morning/Afternoon/Evening, thank you for calling Scottish Power. My name is [Name] at Scottish Power [Location]. Can I take your name please?"</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="outbound-script">
              <AccordionTrigger>Outbound Call Script</AccordionTrigger>
              <AccordionContent className="space-y-2">
                <p className="italic text-muted-foreground">"Hello it's [Name] calling from Scottish Power [Location], the reason for my call is…"</p>
                <p className="italic text-muted-foreground">"Before we continue I just need to make you aware calls may be recorded for training and quality purposes."</p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="space-y-2">
            <Label htmlFor="callerName">Caller&apos;s Name</Label>
            <Input id="callerName" placeholder="Enter caller's name" value={callerName} onChange={e => setCallerName(e.target.value)} />
          </div>
          <Card className="p-4 bg-muted/50">
            <div className="flex items-center space-x-2">
              <Checkbox id="automated-dpa" checked={automatedDpaPassed} onCheckedChange={(checked) => {
                const isChecked = checked as boolean;
                setAutomatedDpaPassed(isChecked);
                if (isChecked) setDpaChecks({});
              }} />
              <Label htmlFor="automated-dpa">Automated DPA Passed</Label>
            </div>
          </Card>
          <div className="space-y-2">
            <Label>Is it yourself that is responsible for paying the energy bills on the account?</Label>
            <RadioGroup value={accountHolderStatus} onValueChange={(value) => {
              const wasUnanswered = accountHolderStatus === 'unanswered';
              setAccountHolderStatus(value as 'yes' | 'no');
              if (value === 'yes' && wasUnanswered) advanceToNextStep(index);
            }} className="flex items-center space-x-4">
              <div className="flex items-center space-x-2"><RadioGroupItem value="yes" id="acc-holder-yes" /><Label htmlFor="acc-holder-yes">Yes</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="no" id="acc-holder-no" /><Label htmlFor="acc-holder-no">No</Label></div>
            </RadioGroup>
          </div>
          {accountHolderStatus === 'no' && (
            <Card className="p-4 bg-muted/50 space-y-3">
              <p className="text-sm text-muted-foreground">If not the account holder, clarify their relation to the account before proceeding.</p>
              <RadioGroup value={thirdPartyStatus || ''} onValueChange={(value) => {
                const wasNull = thirdPartyStatus === null;
                setThirdPartyStatus(value);
                if (wasNull) advanceToNextStep(index);
              }}>
                <div className="flex items-center space-x-2"><RadioGroupItem value="named" id="r-named" /><Label htmlFor="r-named">Caller is named on the account</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="permission_granted" id="r-permission" /><Label htmlFor="r-permission">Caller has permission for this call</Label></div>
                <div className="flex items-center space-x-2"><RadioGroupItem value="unauthorized_informant" id="r-unauthorized" /><Label htmlFor="r-unauthorized">Unauthorized caller providing information only (no account changes)</Label></div>
              </RadioGroup>
            </Card>
          )}
        </div>
      );
    }

    if (step.id === 'reason') {
      const isMeterReadingsActive = activeFlows.includes('submitMeterReadings');
      const isChangeTariffActive = activeFlows.includes('changeTariff');
      const isInstalmentPlanActive = activeFlows.includes('instalmentPlan');
      const isPrePaymentMeterActive = activeFlows.includes('prePaymentMeter');

      return (
        <div className="space-y-4">
          <p>Select a process flow for common tasks, or note the customer&apos;s problem below.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant={isMeterReadingsActive ? 'default' : 'outline'} size="sm" onClick={() => toggleFlow('submitMeterReadings')}>
              {isMeterReadingsActive ? <MinusCircle className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Submit Meter Readings
            </Button>
            <Button variant={isChangeTariffActive ? 'default' : 'outline'} size="sm" onClick={() => toggleFlow('changeTariff')}>
              {isChangeTariffActive ? <MinusCircle className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Change Tariff
            </Button>
            <Button variant={isInstalmentPlanActive ? 'default' : 'outline'} size="sm" onClick={handleInstalmentPlanFlowToggle}>
              {isInstalmentPlanActive ? <MinusCircle className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Set Up Instalment Plan
            </Button>
            <Button variant={isPrePaymentMeterActive ? 'default' : 'outline'} size="sm" onClick={() => toggleFlow('prePaymentMeter')}>
              {isPrePaymentMeterActive ? <MinusCircle className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
              Arrange Pre-Payment Meter
            </Button>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="problemNotes">Notes on customer&apos;s problem(s)</Label>
            <Textarea id="problemNotes" placeholder="Enter each problem on a new line..." value={problemNotes} onChange={e => setProblemNotes(e.target.value)} rows={4} />
          </div>
        </div>
      );
    }

    if (step.id === 'dpa') {
      nextButton = null;
      return (
        <div className="space-y-4">
          <p>Complete the necessary Data Protection Act (DPA) checks to verify the customer&apos;s identity before accessing their account.</p>
          <Card className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-semibold">DPA Checklist ({dpaPassedCount}/4 needed)</h4>
              <Badge variant={isDpaPassed ? 'default' : 'destructive'} className={isDpaPassed ? 'bg-green-600' : ''}>
                {isDpaPassed ? 'DPA Passed' : 'DPA Not Passed'}
              </Badge>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Primary Questions</p>
              {dpaQuestions.map(q => (
                <div key={q.id} className="flex items-center space-x-2">
                  <Checkbox id={`dpa-${q.id}`} checked={dpaChecks[q.id] || false} onCheckedChange={(checked) => setDpaChecks(prev => ({ ...prev, [q.id]: checked as boolean }))} />
                  <Label htmlFor={`dpa-${q.id}`}>{q.label}</Label>
                </div>
              ))}
            </div>
            <Separator className="my-4" />
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground">Alternative Questions</p>
              {alternativeDpaQuestions.map(q => (
                <div key={q.id} className="flex items-center space-x-2">
                  <Checkbox id={`dpa-${q.id}`} checked={dpaChecks[q.id] || false} onCheckedChange={(checked) => setDpaChecks(prev => ({ ...prev, [q.id]: checked as boolean }))} />
                  <Label htmlFor={`dpa-${q.id}`}>{q.label}</Label>
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-4">
            <h4 className="font-semibold mb-3">DPA Updates</h4>
            <div className="flex flex-wrap gap-2">
              {dpaUpdateOptions.map(opt => (
                <Button key={opt.id} variant={dpaUpdates.includes(opt.id) ? 'default' : 'outline'} size="sm" onClick={() => toggleDpaUpdate(opt.id)}>
                  {dpaUpdates.includes(opt.id) ? <MinusCircle className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                  {opt.label}
                </Button>
              ))}
            </div>
          </Card>
        </div>
      );
    }

    if (step.id === 'psr') {
      return (
        <div className="space-y-4">
          <div className="space-y-3 italic text-muted-foreground">
            <p>&quot;I can see your account is on the Priority Services Register and as an OfGem requirement we need to make sure this is up to date on every call.&quot;</p>
            <p>&quot;The Priority Service Register offers some additional Support Services such as a Password Service, A Nominated Person Scheme, Alternate Bill formats, A Meter Reading Service, Community Liaison Visits or using our interpretation service if there&apos;s difficult with english, just to name a few.&quot;</p>
            <p>&quot;The Priority Service Register is for customer who have any special circumstances such as being disabled, chronically ill, being of pensionable age, have children under the age of 16 or any financial difficulties.&quot;</p>
            <p>&quot;I can see we have the following flags on the account:&quot;</p>
            <p className="font-semibold text-foreground not-italic">[Agent reads out current flags]</p>
            <p>&quot;Have there been any changes we need to be made aware of?&quot;</p>
          </div>
          <Card className="p-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center"><Label htmlFor="psrFinancial">Financial Vulnerability</Label><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyToClipboard(psrFinancial, 'PSR Financial')}><Copy className="h-4 w-4" /></Button></div>
                <Textarea id="psrFinancial" placeholder="Notes on payment difficulties..." value={psrFinancial} onChange={e => setPsrFinancial(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center"><Label htmlFor="psrAge">Age-related (e.g., Pensionable Age)</Label><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyToClipboard(psrAge, 'PSR Age')}><Copy className="h-4 w-4" /></Button></div>
                <Textarea id="psrAge" placeholder="Notes..." value={psrAge} onChange={e => setPsrAge(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center"><Label htmlFor="psrChildren">Dependant Children (Under 16)</Label><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyToClipboard(psrChildren, 'PSR Children')}><Copy className="h-4 w-4" /></Button></div>
                <Textarea id="psrChildren" placeholder="Notes..." value={psrChildren} onChange={e => setPsrChildren(e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center"><Label htmlFor="psrHealth">Health / Disabilities</Label><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyToClipboard(psrHealth, 'PSR Health')}><Copy className="h-4 w-4" /></Button></div>
                <Textarea id="psrHealth" placeholder="Notes..." value={psrHealth} onChange={e => setPsrHealth(e.target.value)} rows={3} />
              </div>
            </div>
          </Card>
        </div>
      );
    }

    if (step.id === 'marketing') {
      nextButton = null;
      return (
        <div className="space-y-4">
          <div className="space-y-3 italic text-muted-foreground">
            <p>&quot;I can see that the last time we updated your marketing permissions was [date] where you said you were happy to receive marketing by Phone / Post / Text / Email. Would you like to make any changes?&quot;</p>
          </div>
          <Card className="p-4 mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="marketingPermissionCompleted" checked={marketingPermissionCompleted} onCheckedChange={(checked) => setMarketingPermissionCompleted(checked as boolean)} />
              <Label htmlFor="marketingPermissionCompleted">Marketing permissions confirmed and updated.</Label>
            </div>
          </Card>
        </div>
      );
    }

    if (step.id === 'es-upsell') {
      nextButton = null;
      return (
        <div className="space-y-4">
          <div className="space-y-3 italic text-muted-foreground">
            <p>&quot;Did you know we also offer additional services as well as gas and Electricity such as Appliance Cover and Boiler Care. if you are interested in either of these or any other services we offer I can transfer you to one of our specialist after the call. Is this something that would be of interest to you?&quot;</p>
          </div>
          <Card className="p-4 mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="esUpsellCompleted" checked={esUpsellCompleted} onCheckedChange={(checked) => setEsUpsellCompleted(checked as boolean)} />
              <Label htmlFor="esUpsellCompleted">ES Upsell offered.</Label>
            </div>
          </Card>
        </div>
      );
    }

    if (step.id === 'smart-meter') {
      return (
        <div className="space-y-4">
          <p className="text-muted-foreground">Address the smart meter status with the customer.</p>
          <RadioGroup value={smartMeterStatus} onValueChange={(value) => setSmartMeterStatus(value as 'pending' | 'not-ready' | 'refused' | 'booked' | 'already-installed')}>
            <div className="flex items-center space-x-2"><RadioGroupItem value="not-ready" id="sm-not-ready" /><Label htmlFor="sm-not-ready">Not Smart Ready</Label></div>
            <div className="flex items-center space-x-2"><RadioGroupItem value="refused" id="sm-refused" /><Label htmlFor="sm-refused">Appointment Refused</Label></div>
            <div className="flex items-center space-x-2"><RadioGroupItem value="booked" id="sm-booked" /><Label htmlFor="sm-booked">Book Appointment</Label></div>
            <div className="flex items-center space-x-2"><RadioGroupItem value="already-installed" id="sm-installed" /><Label htmlFor="sm-installed">Smart Meter Already Installed</Label></div>
          </RadioGroup>
          {smartMeterStatus === 'booked' && (
            <Card className="p-4 mt-4">
              <h4 className="font-semibold mb-3">Appointment Details</h4>
              <div className="space-y-2">
                <Label>Preferred Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn('w-full pl-3 text-left font-normal')}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      Pick a date
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0"><Calendar mode="single" onSelect={() => {}} initialFocus /></PopoverContent>
                </Popover>
              </div>
            </Card>
          )}
        </div>
      );
    }

    if (step.id === 'review') {
      nextButton = null;
      return (
        <div className="space-y-4">
          <p className="text-muted-foreground">Review the following items on the customer&apos;s account:</p>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li>Has the customer called recently? (Check for a banner at the top of the screen)</li>
            <li>Are there any alerts on the account? (Check the top right of the screen)</li>
            <li>What is their current tariff? (Check the bottom left of the screen)</li>
            <li>Do they have Smart Meters? Are they Smart Ready?</li>
            <li>When was the last payment and how much was it for?</li>
            <li>When was the last bill? What period did it cover, how much did it come to?</li>
            <li>What is the current balance on the account?</li>
          </ul>
          <Card className="p-4 mt-4">
            <div className="flex items-center space-x-2">
              <Checkbox id="accountReviewCompleted" checked={accountReviewCompleted} onCheckedChange={(checked) => setAccountReviewCompleted(checked as boolean)} />
              <Label htmlFor="accountReviewCompleted">Account review completed.</Label>
            </div>
          </Card>
        </div>
      );
    }

    if (step.id === 'enquiry') {
      const hasCustomProblems = problemList.length > 0;
      const hasActiveFlows = activeFlows.length > 0;

      if (!hasCustomProblems && !hasActiveFlows) {
        return <p className="text-muted-foreground italic">No process flows or problems have been noted. Please select a reason for the call in the previous step.</p>;
      }

      return (
        <div className="space-y-6">
          {activeFlows.includes('submitMeterReadings') && (
            <Accordion type="single" collapsible defaultValue="item-meter-readings">
              <AccordionItem value="item-meter-readings">
                <AccordionTrigger>Submit Meter Readings</AccordionTrigger>
                <AccordionContent>
                  <SubmitMeterReadingsFlow onStateChange={setMeterReadingsState} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {activeFlows.includes('changeTariff') && (
            <Accordion type="single" collapsible defaultValue="item-change-tariff">
              <AccordionItem value="item-change-tariff">
                <AccordionTrigger>Change Tariff</AccordionTrigger>
                <AccordionContent>
                  <ChangeTariffFlow onStateChange={setChangeTariffState} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {activeFlows.includes('instalmentPlan') && (
            <Accordion type="single" collapsible defaultValue="item-instalment-plan">
              <AccordionItem value="item-instalment-plan">
                <AccordionTrigger>Set Up Instalment Plan</AccordionTrigger>
                <AccordionContent>
                  <InstalmentPlanFlow onStateChange={setInstalmentPlanState} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {activeFlows.includes('prePaymentMeter') && (
            <Accordion type="single" collapsible defaultValue="item-prepayment-meter">
              <AccordionItem value="item-prepayment-meter">
                <AccordionTrigger>Arrange Pre-Payment Meter</AccordionTrigger>
                <AccordionContent>
                  <PrePaymentMeterFlow onStateChange={setPrePaymentMeterState} />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
          {hasCustomProblems && (
            <Card className="frosted-glass">
              <CardHeader><CardTitle>Additional Items</CardTitle><CardDescription>Address each of the customer&apos;s problems and note the actions taken.</CardDescription></CardHeader>
              <CardContent className="space-y-4">
                {problemList.map((problem, index) => (
                  <div key={index}>
                    <Label htmlFor={`action-${index}`}>{problem}</Label>
                    <Textarea id={`action-${index}`} className="mt-2" placeholder="Note actions taken..." value={actionsTaken[problem] || ''} onChange={e => setActionsTaken(prev => ({ ...prev, [problem]: e.target.value }))} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      );
    }

    if (step.id === 'complaints') {
      return (
        <div className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>If the customer has shown any dissatisfaction, a complaint must be raised.</p>
            <ul className="list-disc pl-5">
              <li><strong>Resolved At Time Of Call (RATOC):</strong> Use if you have fully resolved the customer&apos;s dissatisfaction during the call.</li>
              <li><strong>Non-RATOC:</strong> Use if the issue requires escalation. You must get authorisation from POD support to raise a Non-RATOC.</li>
            </ul>
          </div>
          <Card className="p-4">
            <RadioGroup value={complaintStatus} onValueChange={(value) => setComplaintStatus(value as 'none' | 'ratoc' | 'non-ratoc')}>
              <div className="flex items-center space-x-2"><RadioGroupItem value="none" id="c-none" /><Label htmlFor="c-none">No Dissatisfaction</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="ratoc" id="c-ratoc" /><Label htmlFor="c-ratoc">RATOC</Label></div>
              <div className="flex items-center space-x-2"><RadioGroupItem value="non-ratoc" id="c-non-ratoc" /><Label htmlFor="c-non-ratoc">Non-RATOC</Label></div>
            </RadioGroup>
            {complaintStatus === 'ratoc' && (
              <div className="mt-4 space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><Label htmlFor="ratocReason">Reason for Complaint</Label><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyToClipboard(ratocReason, 'Reason')}><Copy className="h-4 w-4" /></Button></div>
                  <Textarea id="ratocReason" value={ratocReason} onChange={e => setRatocReason(e.target.value)} placeholder="Note the reason for the complaint..." />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><Label htmlFor="ratocActions">Actions Taken to Resolve</Label><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyToClipboard(ratocActions, 'Actions')}><Copy className="h-4 w-4" /></Button></div>
                  <Textarea id="ratocActions" value={ratocActions} onChange={e => setRatocActions(e.target.value)} placeholder="Note the actions taken..." />
                </div>
                <div className="space-y-2"><Label htmlFor="ratocRef">RATOC Reference Number</Label><Input id="ratocRef" value={ratocRef} onChange={e => setRatocRef(e.target.value)} placeholder="Enter reference number..." /></div>
              </div>
            )}
            {complaintStatus === 'non-ratoc' && (
              <div className="mt-4 space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><Label htmlFor="nonRatocReason">Reason for Complaint</Label><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyToClipboard(nonRatocReason, 'Reason')}><Copy className="h-4 w-4" /></Button></div>
                  <Textarea id="nonRatocReason" value={nonRatocReason} onChange={e => setNonRatocReason(e.target.value)} placeholder="Note the reason for the complaint..." />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><Label htmlFor="nonRatocAgentActions">Actions Taken by Agent</Label><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyToClipboard(nonRatocAgentActions, 'Actions')}><Copy className="h-4 w-4" /></Button></div>
                  <Textarea id="nonRatocAgentActions" value={nonRatocAgentActions} onChange={e => setNonRatocAgentActions(e.target.value)} placeholder="Note actions taken so far..." />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><Label htmlFor="nonRatocCustomerResolution">Customer&apos;s Desired Resolution</Label><Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleCopyToClipboard(nonRatocCustomerResolution, 'Resolution')}><Copy className="h-4 w-4" /></Button></div>
                  <Textarea id="nonRatocCustomerResolution" value={nonRatocCustomerResolution} onChange={e => setNonRatocCustomerResolution(e.target.value)} placeholder="Note what the customer wants..." />
                </div>
                <div className="space-y-2"><Label htmlFor="nonRatocRef">Non-RATOC Reference Number</Label><Input id="nonRatocRef" value={nonRatocRef} onChange={e => setNonRatocRef(e.target.value)} placeholder="Enter reference number..." /></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Agreed Callback Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn('w-full justify-start text-left font-normal', !nonRatocDate && 'text-muted-foreground')}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {nonRatocDate ? format(nonRatocDate, 'dd-MM-yyyy') : <span>Pick a date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={nonRatocDate} onSelect={setNonRatocDate} initialFocus /></PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2"><Label htmlFor="nonRatocTime">Agreed Callback Time</Label><Input id="nonRatocTime" value={nonRatocTime} onChange={e => setNonRatocTime(e.target.value)} placeholder="e.g., 2:30 PM" /></div>
                </div>
              </div>
            )}
          </Card>
        </div>
      );
    }

    if (step.id === 'summarise') {
      return (
        <div className="space-y-4">
          <p className="text-muted-foreground">Before ending the call, provide a clear summary for the customer:</p>
          <ul className="list-disc pl-5 space-y-2 text-sm">
            <li>Recap all actions taken on the call, referencing the &quot;Actions Taken&quot; in the summary panel.</li>
            <li>Confirm any next steps required from the business or the customer.</li>
            <li>Provide clear and accurate timeframes for any follow-up actions.</li>
          </ul>
          <p className="italic pl-4 text-sm text-muted-foreground">&quot;Just to confirm, we have [action taken]. This will be completed within 10 working days. If you haven&apos;t heard from us by the end of day on <strong>{tenWorkingDaysDate}</strong>, please give us a call back.&quot;</p>
          <Separator />
          <p className="italic text-muted-foreground">&quot;Is there anything I&apos;ve mentioned that you would like me to go over again or anything else I can do to help you today?&quot;</p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p>End the call politely and professionally.</p>
        <Button variant="outline" className="w-full sm:w-auto" onClick={handleResetFlow}>
          <RotateCcw className="mr-2 h-4 w-4" /> Reset Flow for Next Call
        </Button>
      </div>
    );
  };

  const summaryText = useMemo(() => {
    const lines: string[] = [];
    lines.push(`Caller: ${callerName || '...'} (${accountHolderStatus === 'yes' ? 'Account Holder' : thirdPartyStatus || 'Unknown'})`);
    lines.push(`DPA: ${automatedDpaPassed ? 'Passed (Automated)' : isDpaPassed ? 'Passed (Manual)' : 'Not Completed'}`);
    if (dpaUpdates.length > 0) lines.push(`DPA Updates: ${dpaUpdates.join(', ')}`);
    lines.push(`PSR - Financial: ${psrFinancial || 'Nothing to update'}`);
    lines.push(`PSR - Age: ${psrAge || 'Nothing to update'}`);
    lines.push(`PSR - Children: ${psrChildren || 'Nothing to update'}`);
    lines.push(`PSR - Health: ${psrHealth || 'Nothing to update'}`);
    lines.push(`Marketing: ${marketingPermissionCompleted ? 'Completed' : 'Pending'}`);
    lines.push(`ES Upsell: ${esUpsellCompleted ? 'Offered' : 'Pending'}`);
    lines.push(`Smart Meter: ${smartMeterStatus}`);
    lines.push(`Account Review: ${accountReviewCompleted ? 'Completed' : 'Pending'}`);
    if (complaintStatus !== 'none') {
      if (complaintStatus === 'ratoc') {
        lines.push(`Complaint (RATOC): ${ratocReason || '...'} - Actions: ${ratocActions || '...'} - Ref: ${ratocRef || '...'}`);
      } else {
        const dateStr = nonRatocDate ? format(nonRatocDate, 'dd-MM-yyyy') : '...';
        lines.push(`Complaint (Non-RATOC): ${nonRatocReason || '...'} - Agent Actions: ${nonRatocAgentActions || '...'} - Resolution: ${nonRatocCustomerResolution || '...'} - Ref: ${nonRatocRef || '...'} - Callback: ${dateStr} ${nonRatocTime || '...'}`);
      }
    }
    lines.push('');
    lines.push('Actions Taken:');
    if (meterReadingsState.summary) lines.push(`  Meter Readings - ${meterReadingsState.summary}`);
    if (changeTariffState.summary) lines.push(`  Tariff Change - ${changeTariffState.summary}`);
    if (instalmentPlanState.summary) lines.push(`  Instalment Plan - ${instalmentPlanState.summary}`);
    if (prePaymentMeterState.summary) lines.push(`  Pre-Payment Meter - ${prePaymentMeterState.summary}`);
    problemList.forEach(p => {
      lines.push(`  ${p}: ${actionsTaken[p] || 'No action noted'}`);
    });
    if (scratchpadNotes.trim()) {
      lines.push('');
      lines.push('Scratchpad Notes:');
      lines.push(scratchpadNotes);
    }
    return lines.join('\n');
  }, [
    callerName, accountHolderStatus, thirdPartyStatus,
    automatedDpaPassed, isDpaPassed, dpaUpdates,
    psrFinancial, psrAge, psrChildren, psrHealth,
    marketingPermissionCompleted, esUpsellCompleted,
    smartMeterStatus, accountReviewCompleted,
    complaintStatus, ratocReason, ratocActions, ratocRef,
    nonRatocReason, nonRatocAgentActions, nonRatocCustomerResolution,
    nonRatocRef, nonRatocDate, nonRatocTime,
    problemList, actionsTaken, scratchpadNotes,
    meterReadingsState.summary, changeTariffState.summary,
    instalmentPlanState.summary, prePaymentMeterState.summary,
  ]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2">
        <Card className="frosted-glass">
          <CardHeader>
            <CardTitle>Call Flow Guide</CardTitle>
            <CardDescription>A step-by-step guide to achieve Call Score success and ensure a consistent customer experience.</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full" value={openAccordionItem} onValueChange={setOpenAccordionItem}>
              {callFlowSteps.map((step, index) => {
                if (step.id === 'dpa' && automatedDpaPassed) return null;
                return (
                  <AccordionItem value={`item-${index}`} key={index}>
                    <AccordionTrigger>{index + 1}. {step.title}</AccordionTrigger>
                    <AccordionContent>{renderAccordionContent(step, index)}</AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      </div>

      <div className="md:col-span-1 space-y-4">
        <Card className="frosted-glass">
          <CardHeader><CardTitle>Scratchpad</CardTitle></CardHeader>
          <CardContent>
            <Textarea placeholder="Take temporary notes here..." rows={8} value={scratchpadNotes} onChange={e => setScratchpadNotes(e.target.value)} />
          </CardContent>
        </Card>
        <Card className="frosted-glass">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Call Summary</CardTitle>
              <Button variant="outline" size="sm" onClick={() => handleCopyToClipboard(summaryText, 'Full Call Summary')}>
                <ClipboardList className="mr-2 h-4 w-4" />
                Copy Full Summary
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-sm whitespace-pre-wrap">
            {summaryText}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

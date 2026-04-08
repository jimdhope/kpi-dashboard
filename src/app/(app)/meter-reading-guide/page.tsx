'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

const meterCategories = [
  { id: 'smets1-secure', label: 'SMETS1 Secure' },
  { id: 'smets1', label: 'SMETS1 Other' },
  { id: 'smets2', label: 'SMETS2' },
  { id: 'traditional', label: 'Traditional' },
];

export default function MeterReadingGuide() {
  const [activeCategory, setActiveCategory] = useState('smets1-secure');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Meter Reading Guide</h1>
        <p className="text-muted-foreground">How to read every type of energy meter - electricity and gas.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {meterCategories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeCategory === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {activeCategory === 'smets1-secure' && <Smets1SecureSection />}
      {activeCategory === 'smets1' && <Smets1OtherSection />}
      {activeCategory === 'smets2' && <Smets2Section />}
      {activeCategory === 'traditional' && <TraditionalSection />}
    </div>
  );
}

function Smets1SecureSection() {
  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle>SMETS1 Secure Smart Meter</CardTitle>
          <CardDescription>Older model installed before March 2018 with Secure logo on the front.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Electricity - Standard Tariff (Liberty 100)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
            <Image src="/meter-images/smets1-secure-electricity.png" alt="Secure SMETS1 electricity meter" fill className="object-contain" />
          </div>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Press <strong>6</strong> on the keypad.</li>
            <li>You will see the letters <strong>IMP R01</strong> appear on the screen.</li>
            <li>Wait a moment, then eight digits will appear, followed by <strong>kWh</strong> towards the bottom right.</li>
            <li>Take the <strong>first 7 digits</strong> - this is your reading (nothing after the decimal point).</li>
          </ol>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Electricity - Economy 7 (Peak and Off-Peak)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal pl-5 space-y-2">
            <li>Note down your peak rate as above (IMP R01), then continue to press <strong>6</strong> until you see <strong>IMP R02</strong> - this is your off-peak screen.</li>
            <li>A second later, eight digits will appear with <strong>kWh</strong> towards the bottom right.</li>
            <li>Take the <strong>first 7 digits</strong> for each reading (nothing after the decimal place).</li>
          </ol>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Gas Smart Meter</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
            <Image src="/meter-images/smets1-secure-gas.png" alt="Secure SMETS1 gas meter" fill className="object-contain" />
          </div>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Press <strong>9</strong> on the keypad.</li>
            <li>The word <strong>VOLUME</strong> will show on the screen.</li>
            <li>Your gas reading, in cubic metres (m3) will appear.</li>
            <li>Take the <strong>first five digits</strong> as your reading.</li>
          </ol>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Export Reading</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-decimal pl-5 space-y-2">
            <li>Press <strong>9</strong> on the keypad.</li>
            <li>The words <strong>EXP kWh</strong> will appear on the screen.</li>
            <li>Your reading will appear in kWh.</li>
            <li>Take the <strong>first 7 digits</strong> - this is your reading.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}

function Smets1OtherSection() {
  const variants = [
    {
      title: 'A and B Buttons',
      image: '/meter-images/smets1-a-button.png',
      steps: ['Press the A button.', 'Keep pressing until you get to TOTAL ACT IMPORT.', 'The number shown below this is your meter reading.'],
    },
    {
      title: 'Green A and White B Buttons',
      image: '/meter-images/smets1-green-white-buttons.png',
      steps: ['Press and hold the green A button for at least 2 seconds.', 'Press A again and again to cycle through the displays.', 'The first row of numbers is your meter reading.'],
    },
    {
      title: 'Three Unmarked Buttons',
      image: '/meter-images/smets1-three-unmarked-buttons.png',
      steps: ['Press the middle button.', 'The number shown below IMP is your meter reading.'],
    },
    {
      title: 'Orange and Blue Buttons',
      image: '/meter-images/smets1-orange-blue-buttons.png',
      steps: ['Press the orange button.', 'You will see a row of numbers followed by KWH - this is your reading.'],
    },
    {
      title: 'Reconnect and Display Select',
      image: '/meter-images/smets1-reconnect-display-select.png',
      steps: ['Press the Display or Display Select button.', 'Keep pressing until it scrolls through a number followed by kWh.'],
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle>SMETS1 Smart Meter (no Secure logo)</CardTitle>
          <CardDescription>First-generation smart meter installed before 2018 without Secure logo. Automatic readings are not available at the moment.</CardDescription>
        </CardHeader>
      </Card>

      {variants.map((variant, i) => (
        <Card key={i} className="frosted-glass">
          <CardHeader><CardTitle>{variant.title}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
              <Image src={variant.image} alt={variant.title} fill className="object-contain" />
            </div>
            <ol className="list-decimal pl-5 space-y-2">
              {variant.steps.map((step, j) => <li key={j}>{step}</li>)}
            </ol>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Smets2Section() {
  const meters = [
    {
      title: 'Secure SMETS2 Electricity (Liberty 101)',
      image: '/meter-images/smets2-secure-liberty-101.png',
      steps: [
        'Press 6 on the keypad.',
        'You will see your Active Import screen IMP R01 appear.',
        'Wait - eight digits will appear, followed by kWh towards the bottom right.',
        'Take the first 7 digits (nothing after the decimal place, e.g. 0014821.6 would be 14821).',
      ],
    },
    {
      title: 'Secure SMETS2 (Liberty 116 - 7 terminal)',
      image: '/meter-images/smets2-secure-liberty-116.png',
      steps: [
        'Press 6 on the keypad.',
        'The display cycles through different screens depending on registers per MPAN.',
        'Each reading will be followed by kWh on the right.',
        'Look for: IMPORT REGISTER-E1-01 (Primary MPAN), E1-02 (if second register), E2-01 (Secondary MPAN), E2-02 (if second register).',
      ],
    },
    {
      title: 'Aclara SMETS2 Electricity',
      image: '/meter-images/smets2-aclara-electric.png',
      steps: [
        'Press A to wake up the screen.',
        'Continue pressing A until you see Total Active Import.',
        'Your electricity reading will be displayed.',
      ],
    },
    {
      title: 'Aclara SMETS2 Gas',
      image: '/meter-images/smets2-aclara-gas.png',
      steps: [
        'Press the middle button once to wake up the screen.',
        'This should automatically reveal your gas reading.',
      ],
    },
    {
      title: 'Landis and Gyr SMETS2 Electricity',
      image: '/meter-images/smets2-landis-electric.png',
      steps: [
        'Press B to light the screen up.',
        'Press A to select No, then you should see your electricity reading.',
      ],
    },
    {
      title: 'Landis and Gyr SMETS2 Gas',
      image: '/meter-images/smets2-landis-gas.png',
      steps: [
        'Press either A or B to wake up the screen.',
        'This should automatically show your gas reading.',
      ],
    },
    {
      title: 'ELSTER/Honeywell AS302P SMETS2',
      image: '/meter-images/smets2-elster.png',
      steps: [
        'Press the top button A to wake up the display and show the General menu.',
        'Push button B to scroll: General, Boost, Registers.',
        'Select Registers by pressing A.',
        'Push B to scroll: Cumulative, Rates in Use, Rates 1-48.',
        'Select Rates 1-48 by pressing A.',
        'Use B to scroll to Imp. R1 and select by pressing A. This is your reading.',
      ],
    },
    {
      title: 'EDMI SMETS2 Electric',
      image: '/meter-images/smets2-edmi-electric.png',
      steps: [
        'Your meter should auto-display your reading on the main screen.',
        'For two-rate: Hold OK to enter Main Menu > Billing > Advanced > TOU matrix. Use arrows to cycle rates.',
      ],
    },
    {
      title: 'EDMI SMETS2 Gas',
      image: '/meter-images/smets2-edmi-gas.png',
      steps: [
        'Your gas meter should auto-display readings.',
        'If asleep: Press the button on the right to wake up. You should see Consumption in M3 with your reading.',
      ],
    },
    {
      title: 'Kaifa MA120 SMETS2 Electric',
      image: '/meter-images/smets2-kaifa.png',
      steps: [
        'This meter uses auto scroll mode - no buttons needed.',
        'It will cycle to your meter reading automatically.',
        'For two-rate: Press Up (K1) to enter menu. Hold Up at General Display. Press Down (K2) to Tariff Matrix. Hold Up. At TOU Register, hold Up. T01 = R1 total, T02 = R2 total.',
      ],
    },
    {
      title: 'Flonidan G4SZV SMETS2 Gas',
      image: '/meter-images/smets2-flonidan-gas.png',
      steps: [
        'Your reading should be displayed automatically on the default screen.',
        'Look for a number preceded by a large V and followed by m3.',
        'Use the left and centre push buttons to cycle back if needed.',
      ],
    },
    {
      title: 'G4 Metrix GWi Smart Electronic Gas',
      image: '/meter-images/smets2-metrix-gas.png',
      steps: [
        'Press the right-hand side button twice in quick succession.',
        'Window 02 displays the meter reading.',
      ],
    },
    {
      title: 'Honeywell/Elster SMETS2 Gas',
      image: '/meter-images/smets2-honeywell-gas.png',
      steps: [
        'The reading will be on the screen.',
        'If asleep, press any button to wake and see the reading.',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle>SMETS2 Smart Meters - Latest Models</CardTitle>
          <CardDescription>Second generation smart meters. Your very first reading needs to be sent manually.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Make sure not to mix your import and export readings when submitting them.</p>
        </CardContent>
      </Card>

      <Accordion type="single" collapsible className="w-full space-y-4">
        {meters.map((meter, i) => (
          <Card key={i} className="frosted-glass">
            <AccordionItem value={`smets2-${i}`} className="border-0">
              <AccordionTrigger className="px-6 py-4">
                <span className="font-semibold">{meter.title}</span>
              </AccordionTrigger>
              <AccordionContent className="px-6 pb-6">
                <div className="space-y-4">
                  <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
                    <Image src={meter.image} alt={meter.title} fill className="object-contain" />
                  </div>
                  <ol className="list-decimal pl-5 space-y-2">
                    {meter.steps.map((step, j) => <li key={j}>{step}</li>)}
                  </ol>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Card>
        ))}
      </Accordion>
    </div>
  );
}

function TraditionalSection() {
  return (
    <div className="space-y-6">
      <Card className="frosted-glass">
        <CardHeader>
          <CardTitle>Traditional Meters</CardTitle>
          <CardDescription>Analogue displays, digital displays, and dial meters.</CardDescription>
        </CardHeader>
      </Card>

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Electricity - Digital Single Meter</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
            <Image src="/meter-images/electric-single-display.jpg" alt="Digital single electricity meter" fill className="object-contain" />
          </div>
          <p><strong>How to read:</strong> Write down the five numbers as they appear. Ignore the red one.</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Electricity - Digital Dual Meter (Two Displays)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
            <Image src="/meter-images/electric-dual-display.png" alt="Digital dual electricity meter" fill className="object-contain" />
          </div>
          <p>For two energy rates at different times of day. The cheaper one is on top.</p>
          <p><strong>How to read:</strong> Write down the five numbers, ignoring the red ones.</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Electricity - Digital Dual Meter (Single Display)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
            <Image src="/meter-images/electric-dual-single-display.png" alt="Digital dual single display" fill className="object-contain" />
          </div>
          <p><strong>How to read:</strong> Write down the numbers as they appear. Press the button to see the next reading, then write that down too.</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Electricity - Dial Meter</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
            <Image src="/meter-images/electric-dial-display.png" alt="Electricity dial meter" fill className="object-contain" />
          </div>
          <p>Five dials with numbers 0-9. Ignore the sixth dial (red or 1/10).</p>
          <p><strong>How to read:</strong></p>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Write down the numbers the pointer has just passed, from left to right.</li>
            <li>If the pointer lies exactly on a number, underline it.</li>
            <li>For underlined numbers: if the following number is between 9 and 0, reduce the underlined number by one.</li>
          </ol>
        </CardContent>
      </Card>

      <Separator />

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Gas - Digital Imperial Meter</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
            <Image src="/meter-images/gas-imperial-display.png" alt="Digital imperial gas meter" fill className="object-contain" />
          </div>
          <p><strong>How to read:</strong> Write down the first four numbers. Ignore the red ones.</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Gas - Digital Metric Meter</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
            <Image src="/meter-images/gas-metric-display.png" alt="Digital metric gas meter" fill className="object-contain" />
          </div>
          <p><strong>How to read:</strong> Write down the first five numbers. Ignore the numbers after the decimal point (sometimes in red).</p>
        </CardContent>
      </Card>

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Gas - Dial Meter</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
            <Image src="/meter-images/gas-dial-display.png" alt="Gas dial meter" fill className="object-contain" />
          </div>
          <p>Read the same way as electricity dial meters - write down the numbers the pointer has just passed.</p>
        </CardContent>
      </Card>

      <Separator />

      <Card className="frosted-glass">
        <CardHeader><CardTitle>Generation Meter</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="relative w-full max-w-md mx-auto aspect-video rounded-lg overflow-hidden bg-muted">
            <Image src="/meter-images/generation-meter.jpg" alt="Generation meter" fill className="object-contain" />
          </div>
          <p><strong>Be careful not to mistake your generation meter for your standard smart meter.</strong> Do not submit these readings in place of your actual billable meter readings.</p>
          <p>Generation meters are most common with Feed-in-Tariff systems and record the energy you generate.</p>
        </CardContent>
      </Card>
    </div>
  );
}

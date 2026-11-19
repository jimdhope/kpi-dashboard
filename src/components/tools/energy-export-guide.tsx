'use client';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Info } from 'lucide-react';

const STEPS: Array<{ title: string; body: string; image?: { src: string; alt: string } }> = [
  {
    title: 'Open ISU and launch SmartUI',
    body: 'Sign in to ISU, then open the SmartUI application.',
  },
  {
    title: 'Enter the BPID and select the fuel',
    body: 'Type the site BPID, then choose the fuel you are exporting — electricity or gas. Each file holds one fuel only.',
  },
  {
    title: 'Open the Meter Reads & Consumption tab',
    body: 'Switch to the Meter Reads & Consumption tab to see the register readings grid.',
  },
  {
    title: 'Select the date range and run it',
    body: 'Pick Last 30 days, or set a custom From / To range, then click Execute to load the readings. Export one month at a time.',
  },
  {
    title: 'Click the Export button',
    body: 'In the toolbar above the readings, click the spreadsheet export icon (circled below).',
    image: {
      src: '/energy-guide/step-1-export.png',
      alt: 'SmartUI Meter Reads & Consumption screen with the Export spreadsheet icon circled in the toolbar',
    },
  },
  {
    title: 'Choose Spreadsheet, then Local File',
    body: 'From the menu that opens, select Spreadsheet and then Local File to save the export to your computer.',
    image: {
      src: '/energy-guide/step-2-spreadsheet.jpg',
      alt: 'The Spreadsheet export menu open, showing Local File, Send and HTML download options',
    },
  },
  {
    title: 'Name the file and save it',
    body: 'Enter a file name that ends with .xlsx (the Save as type should be Excel) and click OK.',
    image: {
      src: '/energy-guide/step-3-save.png',
      alt: 'The "Enter file name to save" dialog with EXPORT.XLSX entered and Excel (*.XLSX) selected',
    },
  },
  {
    title: 'Drag the file into the upload window',
    body: 'Drag the saved .xlsx into the electricity or gas upload window. Add one file per month for each fuel — they merge automatically.',
  },
];

export function EnergyExportGuide() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="How to export your meter readings"
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>How to export your meter readings</DialogTitle>
          <DialogDescription>
            Follow these steps in ISU SmartUI to produce the .xlsx file this tool needs. One file per fuel, one month per file.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 space-y-1.5">
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                {step.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={step.image.src}
                    alt={step.image.alt}
                    className="mt-1 w-full rounded-lg border border-border"
                    loading="lazy"
                  />
                )}
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

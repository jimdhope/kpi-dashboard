'use client';

import { CallFlow } from '@/components/tools/call-flow';

export default function CallFlowPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Call Flow Guide</h1>
        <p className="text-muted-foreground">A step-by-step guide to achieve Call Score success and ensure a consistent customer experience.</p>
      </div>
      <CallFlow />
    </div>
  );
}

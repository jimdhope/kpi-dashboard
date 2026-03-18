
'use client';

import React from 'react';
import { MessageOfTheDayDisplay } from '@/components/message-of-the-day-display';
import type { SpecificWidget } from '@/app/(admin)/admin/message-of-the-day/page';

interface MessageOfTheDayWidgetProps {
  widget: Extract<SpecificWidget, { type: 'motd' }>;
}

export function MessageOfTheDayWidget({ widget }: MessageOfTheDayWidgetProps) {
  return (
    <MessageOfTheDayDisplay
      title={widget.title}
      emoji={widget.emoji}
      content={widget.content}
    />
  );
}

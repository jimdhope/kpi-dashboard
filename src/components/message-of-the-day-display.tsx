'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card'; // Use Card for consistent styling
import { AlertTriangle, Info, PartyPopper } from 'lucide-react'; // Example icons

interface MessageOfTheDayDisplayProps {
  emoji: string | null;
  content: string | null;
  isLoading?: boolean;
}

export function MessageOfTheDayDisplay({ emoji, content, isLoading }: MessageOfTheDayDisplayProps) {
  if (isLoading) {
    return (
      <Card className="w-full p-4 frosted-glass">
        <div className="flex items-center gap-4">
          <div className="text-4xl">
            <Info className="h-10 w-10 animate-pulse text-muted-foreground" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-muted rounded w-3/4 animate-pulse"></div>
            <div className="h-4 bg-muted rounded w-1/2 animate-pulse"></div>
          </div>
        </div>
      </Card>
    );
  }

  if (!content) {
    return null; // Don't render anything if there's no message content
  }

  const displayEmoji = emoji || <PartyPopper className="h-10 w-10 text-primary" />; // Default emoji

  return (
    <Card className="w-full p-4 frosted-glass mb-6 shadow-lg">
      <div className="flex items-start gap-4">
        <div className="text-4xl flex-shrink-0 mt-1">
          {typeof displayEmoji === 'string' ? (
            <span>{displayEmoji}</span>
          ) : (
            displayEmoji
          )}
        </div>
        <div className="flex-1 message-content break-words" dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </Card>
  );
}

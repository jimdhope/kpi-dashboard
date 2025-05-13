
'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Info, PartyPopper } from 'lucide-react'; // Example icons
import { Skeleton } from './ui/skeleton'; // Import Skeleton

interface MessageOfTheDayDisplayProps {
  emoji: string | null;
  content: string | null;
  isLoading?: boolean;
}

export function MessageOfTheDayDisplay({ emoji, content, isLoading }: MessageOfTheDayDisplayProps) {
  if (isLoading) {
    return (
      <Card className="w-full p-4 frosted-glass mb-6 shadow-lg">
        <div className="flex items-start gap-4">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 bg-muted rounded w-3/4" />
            <Skeleton className="h-4 bg-muted rounded w-1/2" />
          </div>
        </div>
      </Card>
    );
  }

  // Only render if content is present (isEnabled logic handled by parent not passing content)
  if (!content || content === '<p><br></p>') { // Also check for empty Lexical paragraph
    return null;
  }

  const displayEmoji = emoji || <PartyPopper className="h-10 w-10 text-primary" />;

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
        {/* Use dangerouslySetInnerHTML to render HTML content */}
        {/* Added prose classes for better default styling of HTML from Lexical */}
        <div
          className="flex-1 message-content break-words prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </Card>
  );
}

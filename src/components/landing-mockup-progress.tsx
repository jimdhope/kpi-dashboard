'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AchievementCard } from './achievement-card'; // Reuse AchievementCard for visual consistency

// Mock Rule Data - Updated
const mockRule1 = { id: 'mock1', name: 'Sales Calls', emoji: '📞', points: 2 }; // Changed name and emoji
const mockRule2 = { id: 'mock2', name: 'Deals Closed', emoji: '🤝', points: 20 }; // Changed name and emoji

export function MockupProgressTracking() {
  return (
    <Card className="w-full shadow-md frosted-glass overflow-hidden">
       <CardHeader className="pb-2 pt-4 px-4">
           <CardTitle className="text-sm font-medium">Today's Log</CardTitle>
       </CardHeader>
      {/* Increase vertical spacing between cards and add more padding at the bottom */}
      <CardContent className="px-4 pt-0 pb-6 space-y-4"> {/* Changed p-4 pt-0 to px-4 pt-0 pb-6, and space-y-3 to space-y-4 */}
        {/* Use AchievementCard with disabled state for mockup */}
        <AchievementCard
          rule={mockRule1}
          currentValue={8} // Example value
          isSaving={false}
          onIncrement={() => {}}
          onDecrement={() => {}}
        />
        <AchievementCard
          rule={mockRule2}
          currentValue={3} // Example value
          isSaving={false}
          onIncrement={() => {}}
          onDecrement={() => {}}
        />
      </CardContent>
    </Card>
  );
}

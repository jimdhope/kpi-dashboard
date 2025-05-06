'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AchievementCard } from './achievement-card'; // Reuse AchievementCard for visual consistency

// Mock Rule Data
const mockRule1 = { id: 'mock1', name: 'Close Deal', emoji: '💲', points: 10 };
const mockRule2 = { id: 'mock2', name: 'Log Activity', emoji: '📝', points: 1 };
const mockRule3 = { id: 'mock3', name: 'Follow Up', emoji: '📞', points: 2 }; // Added third rule

export function MockupProgressTracking() {
  return (
    <Card className="w-full shadow-md frosted-glass overflow-hidden">
       <CardHeader className="pb-2 pt-4 px-4">
           <CardTitle className="text-sm font-medium">Today's Log</CardTitle>
       </CardHeader>
      <CardContent className="p-4 pt-0 space-y-2">
        {/* Use AchievementCard with disabled state for mockup */}
        <AchievementCard
          rule={mockRule1}
          currentValue={3}
          isSaving={false}
          onIncrement={() => {}}
          onDecrement={() => {}}
        />
        <AchievementCard
          rule={mockRule2}
          currentValue={12}
          isSaving={false}
          onIncrement={() => {}}
          onDecrement={() => {}}
        />
         {/* Added third card */}
         <AchievementCard
           rule={mockRule3}
           currentValue={5}
           isSaving={false}
           onIncrement={() => {}}
           onDecrement={() => {}}
         />
      </CardContent>
    </Card>
  );
}

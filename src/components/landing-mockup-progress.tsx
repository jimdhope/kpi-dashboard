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
      {/* Add space-y-2 to create vertical gap between children */}
      <CardContent className="p-4 pt-0 space-y-2">
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

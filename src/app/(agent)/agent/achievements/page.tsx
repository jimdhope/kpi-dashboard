'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusCircle } from 'lucide-react';

// TODO: Replace with actual achievement types and fetching logic
interface Achievement {
  id: string;
  kpiName: string;
  value: number;
  date: string; // Or Date object
  notes?: string;
}

export default function AgentAchievementsPage() {
  // TODO: Fetch agent's achievements
  const achievements: Achievement[] = [
    { id: 'a1', kpiName: 'Sales', value: 50000, date: '2024-07-28' },
    { id: 'a2', kpiName: 'Customer Acquisition', value: 10, date: '2024-07-27', notes: 'Demo day leads' },
    { id: 'a3', kpiName: 'Sales', value: 35000, date: '2024-07-26' },
  ];

  // TODO: Implement form handling to add new achievements
  const handleAddAchievement = (event: React.FormEvent) => {
    event.preventDefault();
    console.log('Add achievement logic goes here');
    // Fetch form data, validate, call service/API
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Log New Achievement</CardTitle>
          <CardDescription>Record your progress towards your KPIs.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddAchievement} className="space-y-4">
            {/* TODO: Replace with Select dropdown populated with agent's KPIs */}
             <div className="grid gap-2">
                <Label htmlFor="kpiName">KPI</Label>
                <Input id="kpiName" placeholder="Select KPI (e.g., Sales)" required />
              </div>
            <div className="grid gap-2">
              <Label htmlFor="value">Value Achieved</Label>
              <Input id="value" type="number" placeholder="Enter value" required />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="date">Date</Label>
              <Input id="date" type="date" required defaultValue={new Date().toISOString().substring(0, 10)} />
            </div>
             <div className="grid gap-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Input id="notes" placeholder="Add any relevant notes" />
            </div>
            <Button type="submit" className="w-full sm:w-auto">
              <PlusCircle className="mr-2 h-4 w-4" /> Add Achievement
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Recent Achievements</CardTitle>
           <CardDescription>A log of your recently recorded achievements.</CardDescription>
        </CardHeader>
        <CardContent>
          {achievements.length === 0 ? (
            <p className="text-muted-foreground">No achievements logged yet.</p>
          ) : (
            <ul className="space-y-3">
              {achievements.map((ach) => (
                <li key={ach.id} className="flex justify-between items-center p-3 border rounded-md bg-card">
                  <div>
                    <span className="font-medium">{ach.kpiName}:</span> {ach.value.toLocaleString()}
                     {ach.notes && <p className="text-xs text-muted-foreground mt-1">{ach.notes}</p>}
                  </div>
                  <span className="text-sm text-muted-foreground">{ach.date}</span>
                </li>
              ))}
            </ul>
          )}
           {/* TODO: Add pagination if list becomes long */}
        </CardContent>
      </Card>
    </div>
  );
}

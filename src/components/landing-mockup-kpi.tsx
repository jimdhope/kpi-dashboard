'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

export function MockupKpiDefinition() {
  return (
    <Card className="w-full shadow-md frosted-glass overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Rule Name</Label>
          <Input placeholder="e.g., Sales Calls" className="h-8 text-xs bg-card/70" disabled />
        </div>
        <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Emoji</Label>
                <Input placeholder="📞" className="h-8 text-xs text-center bg-card/70" disabled />
            </div>
            <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Points</Label>
                <Input type="number" placeholder="5" className="h-8 text-xs bg-card/70" disabled />
            </div>
        </div>
        <Button variant="outline" size="sm" className="w-full text-xs h-7 mt-2" disabled>
          <PlusCircle className="mr-1 h-3 w-3" /> Add Rule
        </Button>
      </CardContent>
    </Card>
  );
}

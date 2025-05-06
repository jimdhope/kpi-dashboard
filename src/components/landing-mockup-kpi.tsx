'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'; // Added CardHeader, CardTitle
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Separator } from './ui/separator';

export function MockupKpiDefinition() {
  return (
    <Card className="w-full shadow-md frosted-glass overflow-hidden">
      {/* Add CardHeader for the title */}
      <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium">Competition Rules</CardTitle>
      </CardHeader>
      <CardContent className="p-4 pt-0 space-y-3">
        {/* Rule Entry */}
        <div className="space-y-2 border-b pb-3">
            {/* Rule Name */}
            <div className="space-y-1">
                <Label htmlFor="mock-rule-name" className="text-xs text-muted-foreground">Name:</Label>
                <Input id="mock-rule-name" placeholder="e.g., Sales Calls" className="h-8 text-xs bg-card/70" disabled />
            </div>
            {/* Emoji and Points on the same line */}
            <div className="flex items-end gap-2">
                <div className="flex-shrink-0 w-16 space-y-1">
                    <Label htmlFor="mock-rule-emoji" className="text-xs text-muted-foreground">Emoji:</Label>
                    {/* Mock Emoji Picker with Input */}
                    <Input id="mock-rule-emoji" placeholder="📞" className="h-8 text-xs text-center bg-card/70" disabled />
                </div>
                 <div className="flex-shrink-0 w-20 space-y-1">
                    <Label htmlFor="mock-rule-points" className="text-xs text-muted-foreground">Points:</Label>
                    <Input id="mock-rule-points" type="number" placeholder="5" className="h-8 text-xs bg-card/70" disabled />
                 </div>
            </div>
        </div>

        {/* Placeholder for another rule (optional) */}
        {/* You could add another similar div structure here if needed */}
         <div className="space-y-2 border-b pb-3 opacity-60">
             {/* Rule Name */}
            <div className="space-y-1">
                <Label htmlFor="mock-rule-name-2" className="text-xs text-muted-foreground">Name:</Label>
                <Input id="mock-rule-name-2" placeholder="e.g., Deals Closed" className="h-8 text-xs bg-card/70" disabled />
            </div>
            {/* Emoji and Points */}
             <div className="flex items-end gap-2">
                 <div className="flex-shrink-0 w-16 space-y-1">
                    <Label htmlFor="mock-rule-emoji-2" className="text-xs text-muted-foreground">Emoji:</Label>
                    <Input id="mock-rule-emoji-2" placeholder="🤝" className="h-8 text-xs text-center bg-card/70" disabled />
                </div>
                 <div className="flex-shrink-0 w-20 space-y-1">
                    <Label htmlFor="mock-rule-points-2" className="text-xs text-muted-foreground">Points:</Label>
                    <Input id="mock-rule-points-2" type="number" placeholder="20" className="h-8 text-xs bg-card/70" disabled />
                 </div>
             </div>
         </div>


        {/* Add Rule Button */}
        <Button variant="outline" size="sm" className="w-full text-xs h-7 mt-3" disabled>
          <PlusCircle className="mr-1 h-3 w-3" /> Add Rule
        </Button>
      </CardContent>
    </Card>
  );
}

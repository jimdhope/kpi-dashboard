'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { Separator } from './ui/separator'; // Import Separator

export function MockupKpiDefinition() {
  return (
    <Card className="w-full shadow-md frosted-glass overflow-hidden">
      <CardContent className="p-4 space-y-3">
        {/* First Rule - Two Column Layout */}
        <div className="grid grid-cols-3 gap-2 items-end">
          {/* Left Column (Emoji & Points) */}
          <div className="col-span-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Emoji</Label>
            <Input placeholder="📞" className="h-8 text-xs text-center bg-card/70" disabled />
            <Label className="text-xs text-muted-foreground pt-1 block">Points</Label> {/* Added pt-1 */}
            <Input type="number" placeholder="5" className="h-8 text-xs bg-card/70" disabled />
          </div>
          {/* Right Column (Rule Name) */}
          <div className="col-span-2 space-y-1 self-start"> {/* Use self-start to align label with top input */}
             <Label className="text-xs text-muted-foreground">Rule Name</Label>
             <Input placeholder="e.g., Sales Calls" className="h-8 text-xs bg-card/70" disabled />
          </div>
        </div>


        {/* Separator */}
        <Separator className="my-3" />

        {/* Second Rule (Disabled/Placeholder) - Two Column Layout */}
         <div className="grid grid-cols-3 gap-2 items-end opacity-60">
            {/* Left Column (Emoji & Points) */}
            <div className="col-span-1 space-y-1">
              <Label className="text-xs text-muted-foreground">Emoji</Label>
              <Input placeholder="🤝" className="h-8 text-xs text-center bg-card/50" disabled />
              <Label className="text-xs text-muted-foreground pt-1 block">Points</Label>
              <Input type="number" placeholder="20" className="h-8 text-xs bg-card/50" disabled />
            </div>
            {/* Right Column (Rule Name) */}
            <div className="col-span-2 space-y-1 self-start">
               <Label className="text-xs text-muted-foreground">Rule Name</Label>
               <Input placeholder="e.g., Deals Closed" className="h-8 text-xs bg-card/50" disabled />
            </div>
         </div>

        <Button variant="outline" size="sm" className="w-full text-xs h-7 mt-3" disabled> {/* Added mt-3 */}
          <PlusCircle className="mr-1 h-3 w-3" /> Add Rule
        </Button>
      </CardContent>
    </Card>
  );
}

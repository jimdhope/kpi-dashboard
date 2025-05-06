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
        {/* Rule Entry 1 */}
        <div className="space-y-2 border-b pb-3">
            {/* Rule Name */}
            <div className="flex items-center gap-2"> {/* Use flex for horizontal layout */}
                <Label htmlFor="mock-rule-name-1" className="text-xs text-muted-foreground w-12 text-right flex-shrink-0">Name:</Label> {/* Fixed width, right align */}
                <Input id="mock-rule-name-1" placeholder="e.g., Sales Calls" className="h-8 text-xs bg-card/70 flex-grow" /> {/* Removed disabled */}
            </div>
            {/* Emoji and Points */}
            <div className="flex items-center gap-4"> {/* Main flex container for emoji/points row */}
                 {/* Emoji Group */}
                 <div className="flex items-center gap-2 flex-1"> {/* Flex for Emoji Label and Input */}
                     <Label htmlFor="mock-rule-emoji-1" className="text-xs text-muted-foreground w-12 text-right flex-shrink-0">Emoji:</Label>
                     <Input id="mock-rule-emoji-1" placeholder="📞" className="h-8 text-xs text-center bg-card/70 w-10" /> {/* Removed disabled */}
                 </div>
                 {/* Points Group */}
                 <div className="flex items-center gap-2 flex-1"> {/* Flex for Points Label and Input */}
                    <Label htmlFor="mock-rule-points-1" className="text-xs text-muted-foreground w-12 text-right flex-shrink-0">Points:</Label>
                    <Input id="mock-rule-points-1" type="number" placeholder="5" className="h-8 text-xs bg-card/70 w-16" /> {/* Removed disabled */}
                 </div>
            </div>
        </div>

        {/* Rule Entry 2 (Opacity reduced) */}
         <div className="space-y-2 border-b pb-3 opacity-60">
             {/* Rule Name */}
             <div className="flex items-center gap-2">
                <Label htmlFor="mock-rule-name-2" className="text-xs text-muted-foreground w-12 text-right flex-shrink-0">Name:</Label>
                <Input id="mock-rule-name-2" placeholder="e.g., Deals Closed" className="h-8 text-xs bg-card/70 flex-grow" /> {/* Removed disabled */}
             </div>
            {/* Emoji and Points */}
             <div className="flex items-center gap-4">
                 <div className="flex items-center gap-2 flex-1">
                     <Label htmlFor="mock-rule-emoji-2" className="text-xs text-muted-foreground w-12 text-right flex-shrink-0">Emoji:</Label>
                     <Input id="mock-rule-emoji-2" placeholder="🤝" className="h-8 text-xs text-center bg-card/70 w-10" /> {/* Removed disabled */}
                 </div>
                 <div className="flex items-center gap-2 flex-1">
                    <Label htmlFor="mock-rule-points-2" className="text-xs text-muted-foreground w-12 text-right flex-shrink-0">Points:</Label>
                    <Input id="mock-rule-points-2" type="number" placeholder="20" className="h-8 text-xs bg-card/70 w-16" /> {/* Removed disabled */}
                 </div>
             </div>
         </div>


        {/* Add Rule Button */}
        <Button variant="outline" size="sm" className="w-full text-xs h-7 mt-3"> {/* Removed disabled */}
          <PlusCircle className="mr-1 h-3 w-3" /> Add Rule
        </Button>
      </CardContent>
    </Card>
  );
}
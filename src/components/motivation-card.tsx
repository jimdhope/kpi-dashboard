import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, RefreshCw } from 'lucide-react'; // Using Sparkles for motivation/AI, RefreshCw for refresh
import React from 'react'; // Import React
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

interface MotivationCardProps {
  message: string | null;
  isLoading: boolean;
  onRefresh: () => void; // Callback to trigger fetching a new message
}

export function MotivationCard({ message, isLoading, onRefresh }: MotivationCardProps) {
  return (
    // Removed fixed gradient, use standard card background which adapts to theme
    <Card className="shadow-md h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        {/* Use theme-based text color */}
        <CardTitle className="text-sm font-medium text-primary">Your Daily Boost</CardTitle>
        {/* Use theme-based icon color */}
        <Sparkles className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent className="flex flex-col flex-grow">
        <div className="flex-grow">
          {isLoading ? (
            <div className="space-y-2">
              {/* Use Skeleton for loading state */}
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
             // Use theme-based text color (foreground)
            <p className="text-sm text-foreground leading-relaxed min-h-[40px]">
              {message || "Let's check your progress and get you motivated!"}
            </p>
          )}
        </div>
        <Button
          variant="outline" // Use standard outline variant which adapts better
          size="sm"
          className="mt-4 w-full sm:w-auto self-start" // Adjust width for responsiveness
          onClick={onRefresh}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} /> {/* Add Refresh icon */}
          {isLoading ? 'Generating...' : 'Refresh'} {/* Shorten button text */}
        </Button>
      </CardContent>
    </Card>
  );
}

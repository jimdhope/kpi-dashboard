import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from 'lucide-react'; // Using Sparkles for motivation/AI
import React from 'react'; // Import React for useState and useEffect

interface MotivationCardProps {
  message: string | null;
  isLoading: boolean;
  onRefresh: () => void; // Callback to trigger fetching a new message
}

export function MotivationCard({ message, isLoading, onRefresh }: MotivationCardProps) {
  return (
    <Card className="shadow-md bg-gradient-to-br from-teal-50 via-white to-yellow-50">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-teal-800">Your Daily Boost</CardTitle>
        <Sparkles className="h-4 w-4 text-yellow-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
             <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse"></div>
             <div className="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div>
           </div>
        ) : (
          <p className="text-sm text-gray-700 leading-relaxed min-h-[40px]">
             {message || "Let's check your progress and get you motivated!"}
           </p>
        )}
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-teal-200 text-teal-700 hover:bg-teal-100"
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? 'Generating...' : 'Refresh Motivation'}
        </Button>
      </CardContent>
    </Card>
  );
}

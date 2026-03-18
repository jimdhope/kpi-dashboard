'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, Clock } from "lucide-react";

export default function NotificationSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">Manage your notification preferences</p>
      </div>

      <Card variant="glass" className="max-w-2xl">
        <CardHeader className="text-center py-12">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full bg-yellow-500/20">
              <Clock className="h-12 w-12 text-yellow-500" />
            </div>
          </div>
          <CardTitle className="text-2xl mb-2">Coming Soon</CardTitle>
          <p className="text-muted-foreground max-w-md mx-auto">
            We're working on bringing you personalized notifications. 
            Stay tuned for updates on achievements, competition results, and team activities!
          </p>
        </CardHeader>
        <CardContent className="text-center pb-12">
          <p className="text-sm text-muted-foreground">
            This feature will be available in a future update.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

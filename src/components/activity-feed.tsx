"use client";

import { ActivityRecord } from "@/lib/contracts";

interface ActivityFeedProps {
  activities: ActivityRecord[];
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return <p className="text-sm text-muted-foreground">No recent activity found.</p>;
  }

  return (
    <div className="space-y-4">
      {activities.map((activity) => (
        <div key={activity.id} className="flex items-start justify-between gap-4 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary">{activity.type.replace(/_/g, " ")}</span>
              <span className="text-xs text-muted-foreground">
                {new Date(activity.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="font-semibold mt-1">
              {activity.richMessage || activity.title}
            </p>
            {activity.description && (
              <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
            )}
          </div>
          <div className="text-right min-w-[80px] shrink-0">
             <span className="text-xs text-muted-foreground">{activity.agentName || "System"}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

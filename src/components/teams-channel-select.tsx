"use client";

import { TeamsWebhookRecord, TeamsChannelCategory } from "@/lib/contracts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TeamsChannelSelectProps {
  webhooks: TeamsWebhookRecord[];
  value: string;
  onValueChange: (value: string) => void;
  category?: TeamsChannelCategory;
  placeholder?: string;
  disabled?: boolean;
}

export function TeamsChannelSelect({
  webhooks,
  value,
  onValueChange,
  category,
  placeholder = "Select a Teams channel",
  disabled = false,
}: TeamsChannelSelectProps) {
  // Filter webhooks by category if provided, and only show outgoing active webhooks
  const filteredWebhooks = webhooks.filter(
    (webhook) =>
      webhook.direction === "outgoing" &&
      webhook.isActive &&
      (!category || webhook.category === category)
  );

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {filteredWebhooks.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground text-center">
            No active Teams channels available
          </div>
        ) : (
          filteredWebhooks.map((webhook) => (
            <SelectItem key={webhook.id} value={webhook.id}>
              <div className="flex items-center gap-2">
                <span>{webhook.friendlyName || webhook.name}</span>
                {webhook.category && (
                  <span className="text-xs text-muted-foreground">
                    ({webhook.category.replace("_", " ")})
                  </span>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}

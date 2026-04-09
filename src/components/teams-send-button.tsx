"use client";

import { useState, useEffect } from "react";
import { TeamsWebhookRecord, TeamsMessageTemplateRecord, TeamsChannelCategory } from "@/lib/contracts";
import { TeamsSendModal } from "@/components/teams-send-modal";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

interface TeamsSendButtonProps {
  category?: TeamsChannelCategory;
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
  onSend?: () => void;
}

export function TeamsSendButton({
  category,
  variant = "outline",
  size = "default",
  children,
  onSend,
}: TeamsSendButtonProps) {
  const [webhooks, setWebhooks] = useState<TeamsWebhookRecord[]>([]);
  const [templates, setTemplates] = useState<TeamsMessageTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [webhooksRes, templatesRes] = await Promise.all([
          fetch("/api/integrations/teams-webhooks"),
          fetch("/api/integrations/teams-message-templates"),
        ]);

        if (webhooksRes.ok) {
          const data = await webhooksRes.json();
          setWebhooks(Array.isArray(data) ? data : []);
        }
        if (templatesRes.ok) {
          const data = await templatesRes.json();
          setTemplates(Array.isArray(data) ? data : []);
        }
      } catch (error) {
        console.error("Error fetching Teams data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <Button variant={variant} size={size} disabled>
        <Send className="mr-2 h-4 w-4" />
        Loading...
      </Button>
    );
  }

  // Don't render if no webhooks available
  const activeWebhooks = webhooks.filter((w) => w.direction === "outgoing" && w.isActive);
  if (activeWebhooks.length === 0) {
    return null;
  }

  return (
    <TeamsSendModal
      webhooks={webhooks}
      templates={templates}
      defaultCategory={category}
      onSend={onSend}
      trigger={
        <Button variant={variant} size={size}>
          <Send className="mr-2 h-4 w-4" />
          {children || "Send to Teams"}
        </Button>
      }
    />
  );
}

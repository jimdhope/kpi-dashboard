export interface TeamsWebhookMessage {
  title: string;
  text: string;
  facts?: Array<{ name: string; value: string }>;
  rawPayload?: Record<string, unknown>;
}

export async function sendTeamsWebhook(url: string, message: TeamsWebhookMessage) {
  const payload =
    message.rawPayload ??
    {
      "@type": "MessageCard",
      "@context": "https://schema.org/extensions",
      summary: message.title,
      themeColor: "007A5A",
      title: message.title,
      text: message.text,
      sections: message.facts && message.facts.length > 0 ? [{ facts: message.facts }] : undefined,
    };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Teams webhook failed with status ${response.status}`);
  }
}

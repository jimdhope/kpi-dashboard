import "server-only";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openrouter/free";

export interface OpenRouterResult {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenRouterError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "OpenRouterError";
  }
}

async function callOpenRouter(prompt: string, apiKey: string): Promise<OpenRouterResult> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEFAULT_MODEL,
      messages: [
        {
          role: "system",
          content:
            "You are a celebratory post writer for a workplace competition platform. Write engaging, professional, and concise posts. Fill in all {token} placeholders with the provided data. For {{...}} placeholders, generate creative, contextual content based on the competition name, theme, and tone of the section. Respect word count guidance. Do not invent data for {tokens}. Keep the tone uplifting and workplace-appropriate.",
        },
        { role: "user", content: prompt },
      ],
      reasoning: { enabled: true },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new OpenRouterError(
      `OpenRouter request failed (${res.status}): ${text.slice(0, 200)}`,
      res.status === 401 ? "UNAUTHORIZED" : res.status === 429 ? "RATE_LIMITED" : "API_ERROR"
    );
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new OpenRouterError("OpenRouter returned no content", "EMPTY_RESPONSE");
  }

  return {
    content,
    usage: data.usage,
  };
}

export async function generatePost(prompt: string, apiKey: string): Promise<OpenRouterResult> {
  // One retry on rate limit
  try {
    return await callOpenRouter(prompt, apiKey);
  } catch (err) {
    if (err instanceof OpenRouterError && err.code === "RATE_LIMITED") {
      await new Promise((r) => setTimeout(r, 2000));
      return callOpenRouter(prompt, apiKey);
    }
    throw err;
  }
}

export async function generatePosts(
  vePrompt: string,
  teamsPrompt: string,
  apiKey: string
): Promise<{ vePost: string; teamsPost: string }> {
  const [ve, teams] = await Promise.all([
    generatePost(vePrompt, apiKey),
    generatePost(teamsPrompt, apiKey),
  ]);
  return { vePost: ve.content, teamsPost: teams.content };
}

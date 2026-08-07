import "server-only";

import { randomUUID } from "crypto";

const GIPHY_SEARCH_ENDPOINT = "https://api.giphy.com/v1/gifs/search";

export type GiphySearchResult = {
  id: string;
  title: string;
  url: string;
  previewUrl: string | null;
  thumbnailUrl: string | null;
  width: number | null;
  height: number | null;
};

export type GiphySearchResponse = {
  results: GiphySearchResult[];
  provider: "giphy" | "unconfigured" | "error";
  error?: string;
};

function pickFixedUrl(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function toNumber(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

export function shapeGiphyResult(item: any): GiphySearchResult | null {
  const id = typeof item?.id === "string" ? item.id : null;
  const title = typeof item?.title === "string" ? item.title : "";
  const url =
    pickFixedUrl(item?.images?.original?.url) ??
    pickFixedUrl(item?.images?.fixed_height?.url) ??
    pickFixedUrl(item?.images?.fixed_width?.url);
  const previewUrl =
    pickFixedUrl(item?.images?.fixed_height?.url) ??
    pickFixedUrl(item?.images?.fixed_width?.url) ??
    pickFixedUrl(item?.images?.original?.url);
  const thumbnailUrl =
    pickFixedUrl(item?.images?.fixed_height_small_still?.url) ??
    pickFixedUrl(item?.images?.preview_gif?.url) ??
    pickFixedUrl(item?.images?.fixed_height_small?.url);
  const width = toNumber(item?.images?.fixed_height?.width ?? item?.images?.original?.width);
  const height = toNumber(item?.images?.fixed_height?.height ?? item?.images?.original?.height);

  if (!id || !url) return null;
  return { id, title, url, previewUrl, thumbnailUrl, width, height };
}

export const giphyService = {
  async search(query: string, limit = 12): Promise<GiphySearchResponse> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { results: [], provider: "error", error: "Query is required." };
    }

    const apiKey = process.env.GIPHY_API_KEY?.trim();
    if (!apiKey) {
      return { results: [], provider: "unconfigured" };
    }

    const url = new URL(GIPHY_SEARCH_ENDPOINT);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("q", trimmed);
    url.searchParams.set("limit", String(Math.min(Math.max(limit, 1), 24)));
    url.searchParams.set("rating", "pg");
    url.searchParams.set("lang", "en");

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return { results: [], provider: "error", error: `GIPHY request failed (${response.status}).` };
      }
      const payload = await response.json();
      const results = Array.isArray(payload?.data) ? payload.data.map(shapeGiphyResult).filter(Boolean) as GiphySearchResult[] : [];
      return { results, provider: "giphy" };
    } catch (error) {
      return {
        results: [],
        provider: "error",
        error: error instanceof Error ? error.message : `GIPHY request failed (${randomUUID()}).`,
      };
    }
  },
};

"use client";

import { useEffect, useRef } from "react";

const SCORE_EVENT_TYPES = new Set(["score_event_recorded", "score_event_voided"]);

/**
 * SSE is an invalidation signal; consumers always refetch canonical data.
 * Accepts a single competition id or several (e.g. every competition in a
 * campaign) — one EventSource per id, sharing a single debounce timer.
 */
export function useCompetitionScoreRefresh(
  competitionIds: string | string[] | null | undefined,
  refresh: () => void | Promise<void>,
) {
  const refreshRef = useRef(refresh);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  refreshRef.current = refresh;

  const subscriptionKey = Array.isArray(competitionIds)
    ? [...new Set(competitionIds.filter(Boolean))].sort().join(",")
    : (competitionIds ?? "");

  useEffect(() => {
    if (!subscriptionKey) return;
    const ids = subscriptionKey.split(",").filter(Boolean);
    let closed = false;
    const requestRefresh = () => {
      if (closed || timerRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!closed) void refreshRef.current();
      }, 150);
    };
    const streams = ids.map((id) => {
      const stream = new EventSource(`/api/competitions/sse/${encodeURIComponent(id)}`);
      stream.onmessage = (message) => {
        try {
          const update = JSON.parse(message.data) as { type?: string };
          if (update.type === "connected" || (update.type && SCORE_EVENT_TYPES.has(update.type))) requestRefresh();
        } catch {
          // A malformed invalidation must not prevent EventSource reconnects.
        }
      };
      return stream;
    });
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") requestRefresh(); };
    window.addEventListener("online", requestRefresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      closed = true;
      for (const stream of streams) stream.close();
      window.removeEventListener("online", requestRefresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [subscriptionKey]);
}

"use client";

import { useEffect, useRef } from "react";

const SCORE_EVENT_TYPES = new Set(["score_event_recorded", "score_event_voided"]);

/** SSE is an invalidation signal; consumers always refetch canonical data. */
export function useCompetitionScoreRefresh(
  competitionId: string | null | undefined,
  refresh: () => void | Promise<void>,
) {
  const refreshRef = useRef(refresh);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!competitionId) return;
    let closed = false;
    const requestRefresh = () => {
      if (closed || timerRef.current) return;
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (!closed) void refreshRef.current();
      }, 150);
    };
    const stream = new EventSource(`/api/competitions/sse/${encodeURIComponent(competitionId)}`);
    stream.onmessage = (message) => {
      try {
        const update = JSON.parse(message.data) as { type?: string };
        if (update.type === "connected" || (update.type && SCORE_EVENT_TYPES.has(update.type))) requestRefresh();
      } catch {
        // A malformed invalidation must not prevent EventSource reconnects.
      }
    };
    const refreshWhenVisible = () => { if (document.visibilityState === "visible") requestRefresh(); };
    window.addEventListener("online", requestRefresh);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      closed = true;
      stream.close();
      window.removeEventListener("online", requestRefresh);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [competitionId]);
}

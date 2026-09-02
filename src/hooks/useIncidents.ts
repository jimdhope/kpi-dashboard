"use client";

import { useEffect, useState } from "react";
import type { Incident } from "@/lib/types";

export type PostcodeResult = {
  postcode: string;
  outwardCode: string;
  searchLocation: { lon: number; lat: number };
  dno: string;
  count: number;
  activeCount: number;
  resolvedCount: number;
  incidents: Incident[];
  timestamp: number;
};

export async function searchPostcodeAPI(postcode: string): Promise<PostcodeResult> {
  const res = await fetch(`/api/postcode?postcode=${encodeURIComponent(postcode)}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export function useIncidents() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState("");

  async function refresh() {
    try {
      const res = await fetch("/api/power-cuts");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setIncidents(data.incidents || []);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 60000);
    return () => clearInterval(t);
  }, []);

  return { incidents, loading, error, refresh, version };
}

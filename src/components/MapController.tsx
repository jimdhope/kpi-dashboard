"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";
import type { Incident } from "@/lib/types";
import type { SearchResult } from "@/lib/search";

export function MapController({
  target,
  count,
  incidents,
}: {
  target: SearchResult | null;
  count: number;
  incidents: Incident[];
}) {
  const map = useMap();

  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lon], 10, { duration: 1.2 });
    }
  }, [target]);

  useEffect(() => {
    const withCoords = incidents.filter((i) => i.lon != null && i.lat != null);
    if (withCoords.length > 1 && !target) {
      const lons = withCoords.map((i) => i.lon as number);
      const lats = withCoords.map((i) => i.lat as number);
      const bounds: [[number, number], [number, number]] = [
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)],
      ];
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10, duration: 1 });
    } else if (withCoords.length === 1 && !target) {
      const c = withCoords[0];
      map.flyTo([c.lat as number, c.lon as number], 10, { duration: 1 });
    }
  }, [count, target]);

  return null;
}

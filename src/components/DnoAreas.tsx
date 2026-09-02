"use client";

import { useEffect, useState } from "react";
import { GeoJSON } from "react-leaflet";
import type * as GeoJSONNS from "geojson";
import type { PathOptions } from "leaflet";

const GEOJSON_NAME_MAP: Record<string, string> = {
  "UK Power Networks": "UK Power Networks",
  "National Grid Electricity Distribution": "National Grid (Western Power)",
  "Northern Powergrid": "Northern Powergrid",
  "SP Energy Networks": "SP Energy Networks",
  "Electricity North West": "Electricity North West",
  "Scottish and Southern Electricity Networks": "SSEN",
};

const AREA_COLORS: Record<string, PathOptions> = {
  "UK Power Networks": { color: "#ef5350", fillColor: "#ef5350", fillOpacity: 0.06, weight: 1.5 },
  "National Grid (Western Power)": { color: "#ffa726", fillColor: "#ffa726", fillOpacity: 0.06, weight: 1.5 },
  "Northern Powergrid": { color: "#42a5f5", fillColor: "#42a5f5", fillOpacity: 0.06, weight: 1.5 },
  "SP Energy Networks": { color: "#26c6da", fillColor: "#26c6da", fillOpacity: 0.06, weight: 1.5 },
  "Electricity North West": { color: "#9ccc65", fillColor: "#9ccc65", fillOpacity: 0.06, weight: 1.5 },
  "SSEN": { color: "#ab47bc", fillColor: "#ab47bc", fillOpacity: 0.06, weight: 1.5 },
};

const DEFAULT_AREA_STYLE: PathOptions = { color: "#8892a6", fillColor: "#8892a6", fillOpacity: 0.06, weight: 1.5 };

export function DnoAreas() {
  const [data, setData] = useState<GeoJSONNS.GeoJsonObject | null>(null);

  useEffect(() => {
    fetch("/dno-areas.geojson")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setData(d))
      .catch(() => {});
  }, []);

  if (!data) return null;

  const style = (feature: GeoJSONNS.Feature | undefined): PathOptions => {
    const geoJsonName = feature?.properties?.DNO_Full;
    const dnoName = GEOJSON_NAME_MAP[geoJsonName] ?? geoJsonName;
    return AREA_COLORS[dnoName] ?? DEFAULT_AREA_STYLE;
  };

  return <GeoJSON data={data} style={style} interactive={false} />;
}

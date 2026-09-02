"use client";

import "leaflet/dist/leaflet.css";
import { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { MapContainer, TileLayer, ZoomControl } from "react-leaflet";
import type { Map as LeafletMap } from "leaflet";
import L from "leaflet";
import { useIncidents, searchPostcodeAPI } from "@/hooks/useIncidents";
import type { Incident } from "@/lib/types";
import { POSTCODE_RE } from "@/lib/search";
import type { SearchResult } from "@/lib/search";
import { IncidentMarkers } from "@/components/IncidentMarkers";
import { DnoAreas } from "@/components/DnoAreas";
import { IncidentList } from "@/components/IncidentList";
import { Legend } from "@/components/Legend";
import { MapController } from "@/components/MapController";
import { VERSION } from "@/lib/config";
import { isLive, statusKind, dnoColor, statusLabel, formatDate } from "@/lib/ui";
import { lookupPostcode } from "@/lib/postcodes";
import { ArrowLeft, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const UK_BOUNDS: [[number, number], [number, number]] = [
  [49.8, -8.6],
  [60.9, 1.9],
];

const DNO_URLS: Record<string, string> = {
  "UK Power Networks": "https://www.ukpowernetworks.co.uk/power-cut/list",
  SSEN: "https://powertrack.ssen.co.uk/powertrack",
  "Northern Powergrid": "https://www.northernpowergrid.com/power-cuts-map",
  "National Grid (Western Power)": "https://powercuts.nationalgrid.co.uk/power-cut-map/tweets",
  "SP Energy Networks": "https://powercuts.spenergynetworks.co.uk/map",
  "Electricity North West": "https://www.enwl.co.uk/power-cuts/power-cuts-power-cuts-live-power-cut-information-fault-list/fault-list/",
};

function StatusPill({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px",
        borderRadius: 16,
        fontSize: 12,
        fontWeight: 600,
        textTransform: "uppercase",
        border: `2px solid ${active ? color : "transparent"}`,
        backgroundColor: active ? color : "var(--color-muted)",
        color: active ? "#fff" : "var(--color-muted-foreground)",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );
}

export default function PowerCutMap() {
  const { incidents, loading, error, version, refresh } = useIncidents();
  const [showLegend, setShowLegend] = useState(true);
  const [dnoFilter, setDnoFilter] = useState<string | null>(null);
  const [textFilter, setTextFilter] = useState("");
  const [searchTarget, setSearchTarget] = useState<SearchResult | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    const interval = setInterval(() => refresh(), 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const [searchRadius, setSearchRadius] = useState<number | null>(null);

  const haversine = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const filtered = useMemo(() => {
    let list = incidents;
    if (dnoFilter) list = list.filter((i) => i.dno === dnoFilter);
    if (textFilter) {
      const q = textFilter.toLowerCase();
      list = list.filter((i) =>
        [i.dno, i.source, i.road, i.town, i.postcode, i.reference]
          .filter(Boolean).join(" ").toLowerCase().includes(q)
      );
    }
    if (searchTarget && searchRadius) {
      const { lat: tLat, lon: tLon } = searchTarget;
      list = list.filter((i) => {
        if (i.lat == null || i.lon == null) return false;
        const d = haversine(tLat, tLon, i.lat, i.lon);
        return d <= searchRadius;
      });
    }
    return list;
  }, [incidents, dnoFilter, textFilter, searchTarget, searchRadius]);

  const kpi = useMemo(() => {
    const total = filtered.length;
    const live = filtered.filter((i) => isLive(i.status)).length;
    const planned = filtered.filter((i) => statusKind(i.status) === "planned").length;
    const customers = filtered.reduce((s, i) => s + (i.customersAffected || 0), 0);
    return { total, live, planned, customers };
  }, [filtered]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const geocodePostcode = useCallback((postcode: string): { lat: number; lon: number } | null => {
    const info = lookupPostcode(postcode.split(";")[0].trim());
    if (info) return { lat: info.lat, lon: info.lon };
    return null;
  }, []);

  const getIncidentCoords = useCallback((inc: Incident): { lat: number; lon: number } | null => {
    if (inc.lat != null && inc.lon != null) return { lat: inc.lat, lon: inc.lon };
    if (inc.postcode) {
      const firstPc = inc.postcode.split(";")[0].trim();
      return geocodePostcode(firstPc);
    }
    return null;
  }, [geocodePostcode]);

  const openPopup = useCallback((inc: Incident, coords: { lat: number; lon: number }) => {
    const map = mapRef.current;
    if (!map) return;
    
    const color = dnoColor(inc.dno);
    const dnoUrl = DNO_URLS[inc.dno];
    const outwardCodes = inc.postcode 
      ? [...new Set(inc.postcode.split(";").map((p) => p.trim().split(" ")[0]).filter(Boolean))] 
      : [];
    const mainTown = inc.town || "";
    const areaLooksLikePostcodes = /^([A-Z]{1,2}\d{1,2}[A-Z]?,?\s*)+$/.test(inc.area || "");
    const mainArea = (!areaLooksLikePostcodes && inc.area) || "";
    const simplifiedKind = statusKind(inc.status);
    const simplifiedLabel = simplifiedKind === "live" ? "Unplanned" : simplifiedKind === "planned" ? "Planned" : "Restored";
    const simplifiedColor = simplifiedKind === "live" ? "#ef5350" : simplifiedKind === "planned" ? "#f59e0b" : "#22c55e";
    const officialStatus = statusLabel(inc.status);
    const description = inc.description || inc.provider_raw_data?.customerstagesequencemessage || inc.provider_raw_data?.message || "";

    const html = `
      <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 300px; max-width: 340px; background-color: #1e293b; border-radius: 8px; overflow: hidden;">
        <div style="display: flex; justify-content: space-between; padding: 14px 14px 10px 14px; border-bottom: 1px solid #334155;">
          <div>
            <div style="font-size: 20px; font-weight: 700; color: #f1f5f9; line-height: 1.2; margin-bottom: 4px;">${mainTown || mainArea || "Unknown location"}</div>
            ${mainArea && mainTown ? `<div style="font-size: 11px; color: #94a3b8;">${mainArea}</div>` : ""}
          </div>
          <div style="text-align: right; margin-left: 12px;">
            <span style="display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 10px; font-weight: 700; text-transform: uppercase; background-color: ${simplifiedColor}; color: #fff; margin-bottom: 6px;">${simplifiedLabel}</span>
            <div style="font-size: 11px; color: #94a3b8; margin-bottom: 3px;">${officialStatus}</div>
            <div style="font-size: 12px; font-weight: 600; color: #e2e8f0; margin-bottom: 3px;">${inc.dno}</div>
            ${outwardCodes.length > 0 ? `<div style="font-size: 10px; color: #94a3b8; line-height: 1.5;">${outwardCodes.map((oc) => `<div>${oc}</div>`).join("")}</div>` : ""}
          </div>
        </div>
        <div style="padding: 10px 14px;">
          <div style="margin-bottom: 8px;">
            <div style="font-size: 12px; font-weight: 600; color: #e2e8f0;">First reported:</div>
            <div style="font-size: 14px; color: #f1f5f9;">${inc.startedAt ? formatDate(inc.startedAt) : "Unknown"}</div>
          </div>
          <div style="margin-bottom: 8px;">
            <div style="font-size: 12px; font-weight: 600; color: #e2e8f0;">${simplifiedKind === "resolved" ? "Restored:" : "Est. Restore:"}</div>
            <div style="font-size: 14px; color: #f1f5f9;">${inc.estRestoration ? formatDate(inc.estRestoration) : "Unknown"}</div>
          </div>
          <div style="margin-bottom: 8px;">
            <div style="font-size: 12px; font-weight: 600; color: #e2e8f0;">Properties affected:</div>
            <div style="font-size: 14px; color: #f1f5f9;">${inc.customersAffected != null ? inc.customersAffected : "Unknown"}</div>
          </div>
          ${description ? `<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #334155;">
            <div style="font-size: 12px; font-weight: 600; color: #e2e8f0; margin-bottom: 4px;">DNO Update:</div>
            <div style="font-size: 12px; color: #cbd5e1; line-height: 1.4;">${description.length > 200 ? description.substring(0, 200) + "..." : description}</div>
          </div>` : ""}
        </div>
        ${dnoUrl ? `<a href="${dnoUrl}" target="_blank" rel="noopener noreferrer" style="display: block; padding: 12px 14px; background-color: ${color}; color: #fff; font-size: 13px; font-weight: 600; text-decoration: none; text-align: center;">View on ${inc.dno} Website</a>` : ""}
      </div>
    `;

    map.closePopup();
    setTimeout(() => {
      L.popup({ maxWidth: 360, minWidth: 300, autoClose: false, closeOnClick: false })
        .setLatLng([coords.lat, coords.lon])
        .setContent(html)
        .openOn(map);
    }, 100);
  }, []);

  const flyToIncident = useCallback((inc: Incident) => {
    const coords = getIncidentCoords(inc);
    if (coords && mapRef.current) {
      mapRef.current.flyTo([coords.lat, coords.lon], 12, { duration: 1.5 });
      setTimeout(() => openPopup(inc, coords), 700);
    } else {
      showToast("No coordinates available for this incident");
    }
  }, [getIncidentCoords, openPopup, showToast]);

  const handleSearch = async (raw: string) => {
    if (!raw) {
      clearSearch();
      return;
    }
    const q = raw.trim();
    const normalized = q.toUpperCase().replace(/\s/g, "");
    
    if (POSTCODE_RE.test(normalized)) {
      try {
        const data = await searchPostcodeAPI(q);
        setDnoFilter(null);
        setTextFilter("");
        setSearchTarget({
          lon: data.searchLocation.lon,
          lat: data.searchLocation.lat,
          postcode: normalized,
        });
        setSearchRadius(50);
        if (mapRef.current) {
          mapRef.current.flyTo([data.searchLocation.lat, data.searchLocation.lon], 10, { duration: 1.2 });
        }
        showToast(`Found ${data.outwardCode} (${data.searchLocation.lat.toFixed(3)}, ${data.searchLocation.lon.toFixed(3)})`);
        if (data.activeCount === 0 && data.resolvedCount === 0) {
          showToast(`No incidents within ~50km of ${normalized}`);
        }
      } catch {
        showToast("Search failed. Please try again.");
      }
      return;
    }
    
    setDnoFilter(null);
    setTextFilter(q);
    setSearchRadius(null);
    const withCoord = filtered.find((i) => i.lon != null && i.lat != null) || incidents.find((i) => i.lon != null && i.lat != null);
    const matches = incidents.filter((i) =>
      [i.dno, i.source, i.road, i.town, i.postcode, i.reference].filter(Boolean).join(" ").toLowerCase().includes(q.toLowerCase())
    );
    if (matches.length) {
      if (withCoord) {
        mapRef.current?.flyTo([withCoord.lat!, withCoord.lon!], 8);
        showToast(`Found ${matches.length} incident(s) matching "${q}"`);
      } else {
        showToast(`Found ${matches.length} incident(s) matching "${q}" (no coordinates)`);
      }
    } else {
      showToast(`No incidents match "${q}"`);
    }
  };

  const clearSearch = () => {
    setTextFilter("");
    setDnoFilter(null);
    setSearchTarget(null);
    setSearchRadius(null);
    setStatusFilter("all");
    if (mapRef.current) {
      mapRef.current.fitBounds(UK_BOUNDS, { padding: [40, 40], maxZoom: 7 });
    }
  };

  const [statusFilter, setStatusFilter] = useState<"all" | "unplanned" | "planned" | "restored">("all");

  const statusFiltered = useMemo(() => {
    if (statusFilter === "all") return filtered;
    return filtered.filter((i) => {
      const kind = statusKind(i.status);
      if (statusFilter === "unplanned") return kind === "live";
      if (statusFilter === "planned") return kind === "planned";
      if (statusFilter === "restored") return kind === "resolved";
      return true;
    });
  }, [filtered, statusFilter]);

  const handleSelectIncident = useCallback((inc: Incident) => {
    flyToIncident(inc);
  }, [flyToIncident]);

  return (
    <div className="h-full w-full flex flex-col">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-glass-border bg-glass/50 backdrop-blur-xl px-4 py-2 md:flex-nowrap md:gap-4 md:px-6">
        <h1 className="whitespace-nowrap text-sm font-semibold text-primary md:text-base">⚡ UK Power Cut Map</h1>

        <div className="flex shrink-0 items-center gap-2 md:gap-3">
          <KpiBadge label="Active" value={String(kpi.total)} />
          <KpiBadge label="Live" value={String(kpi.live)} className="live" />
          <KpiBadge label="Planned" value={String(kpi.planned)} className="planned" />
          <KpiBadge label="Off Supply" value={kpi.customers.toLocaleString()} />
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <StatusPill
            label="Unplanned"
            color="#ef5350"
            active={statusFilter === "unplanned"}
            onClick={() => setStatusFilter(statusFilter === "unplanned" ? "all" : "unplanned")}
          />
          <StatusPill
            label="Planned"
            color="#f59e0b"
            active={statusFilter === "planned"}
            onClick={() => setStatusFilter(statusFilter === "planned" ? "all" : "planned")}
          />
          <StatusPill
            label="Restored"
            color="#22c55e"
            active={statusFilter === "restored"}
            onClick={() => setStatusFilter(statusFilter === "restored" ? "all" : "restored")}
          />
        </div>

        <div className="ml-auto">
          <Link href="/dashboard" passHref>
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-0 flex-1 min-w-0">
          <MapContainer
            ref={mapRef}
            center={[54.0, -3.0]}
            zoom={6.5}
            minZoom={5}
            maxZoom={15}
            zoomControl={false}
            maxBounds={[[49.5, -9], [61.5, 2.5]]}
            maxBoundsViscosity={0.8}
            className="h-full w-full"
          >
            <ZoomControl position="topright" />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <DnoAreas />
            <IncidentMarkers incidents={statusFiltered} onSelect={handleSelectIncident} />
            <MapController target={searchTarget} count={statusFiltered.length} incidents={statusFiltered} />
          </MapContainer>

          {showLegend && <Legend filter={dnoFilter} onFilter={setDnoFilter} onHide={() => setShowLegend(false)} />}
          {!showLegend && (
            <button
              onClick={() => setShowLegend(true)}
              className="absolute right-3 top-3 z-[1000] rounded-lg border border-glass-border bg-glass/80 backdrop-blur-xl px-3 py-1.5 text-xs text-muted-foreground"
            >
              Show legend
            </button>
          )}

          <div className="pointer-events-none absolute bottom-1 left-2 z-[1000] text-[0.6rem] text-muted-foreground opacity-60">
            v{version || VERSION}
          </div>

          {toast && (
            <div className="pointer-events-none absolute bottom-16 left-1/2 z-[1100] -translate-x-1/2 whitespace-nowrap rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground">
              {toast}
            </div>
          )}
        </div>

        <IncidentList
          incidents={statusFiltered}
          loading={loading}
          error={error}
          onSelect={handleSelectIncident}
          onShowLegend={() => setShowLegend(true)}
          onSearch={handleSearch}
        />
      </div>
    </div>
  );
}

function KpiBadge({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className="flex min-w-[70px] flex-col items-start rounded-xl border border-glass-border bg-glass/50 backdrop-blur-xl px-2 py-1">
      <span className="text-[0.65rem] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-base font-bold leading-tight ${className === "live" ? "text-red-400" : className === "planned" ? "text-amber-400" : "text-primary"}`}>
        {value}
      </span>
    </div>
  );
}

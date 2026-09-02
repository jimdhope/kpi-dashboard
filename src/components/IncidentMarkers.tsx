"use client";

import { useMap } from "react-leaflet";
import { useRef, useCallback, useEffect, useState } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import { createRoot } from "react-dom/client";
import React from "react";
import type { Incident } from "@/lib/types";
import { dnoColor, statusLabel, statusColor, formatDate, statusKind } from "@/lib/ui";

const DNO_URLS: Record<string, string> = {
  "UK Power Networks": "https://www.ukpowernetworks.co.uk/power-cut/list",
  SSEN: "https://powertrack.ssen.co.uk/powertrack",
  "Northern Powergrid": "https://www.northernpowergrid.com/power-cuts-map",
  "National Grid (Western Power)": "https://powercuts.nationalgrid.co.uk/power-cut-map/tweets",
  "SP Energy Networks": "https://powercuts.spenergynetworks.co.uk/map",
  "Electricity North West": "https://www.enwl.co.uk/power-cuts/power-cuts-power-cuts-live-power-cut-information-fault-list/fault-list/",
};

function extractOutwardCodes(postcode: string): string[] {
  return [...new Set(postcode.split(";").map((p) => p.trim().split(" ")[0]).filter(Boolean))];
}

function dedupeByCoords(incidents: Incident[]): Incident[] {
  const seen = new Map<string, Incident>();
  for (const inc of incidents) {
    if (inc.lat == null || inc.lon == null) continue;
    const key = `${Number(inc.lat).toFixed(4)},${Number(inc.lon).toFixed(4)}`;
    if (!seen.has(key)) seen.set(key, inc);
  }
  return Array.from(seen.values());
}

function PopupContent({ inc, color, dnoUrl }: { inc: Incident; color: string; dnoUrl?: string }) {
  const outwardCodes = extractOutwardCodes(inc.postcode || "");
  const mainTown = inc.town || "";
  const areaLooksLikePostcodes = /^([A-Z]{1,2}\d{1,2}[A-Z]?,?\s*)+$/.test(inc.area || "");
  const mainArea = (!areaLooksLikePostcodes && inc.area) || "";
  const simplifiedKind = statusKind(inc.status);
  const simplifiedLabel = simplifiedKind === "live" ? "Unplanned" : simplifiedKind === "planned" ? "Planned" : "Restored";
  const simplifiedColor = simplifiedKind === "live" ? "#ef5350" : simplifiedKind === "planned" ? "#f59e0b" : "#22c55e";
  const officialStatus = statusLabel(inc.status);
  const description = inc.description || inc.provider_raw_data?.customerstagesequencemessage || inc.provider_raw_data?.message || "";

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, sans-serif", minWidth: 300, maxWidth: 340, backgroundColor: "#1e293b", borderRadius: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "14px 14px 10px 14px", borderBottom: "1px solid #334155" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", lineHeight: 1.2, marginBottom: 4 }}>
            {mainTown || mainArea || "Unknown location"}
          </div>
          {mainArea && mainTown && <div style={{ fontSize: 11, color: "#94a3b8" }}>{mainArea}</div>}
        </div>
        <div style={{ textAlign: "right", marginLeft: 12 }}>
          <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 10, fontWeight: 700, textTransform: "uppercase", backgroundColor: simplifiedColor, color: "#fff", marginBottom: 6 }}>
            {simplifiedLabel}
          </span>
          <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 3 }}>{officialStatus}</div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginBottom: 3 }}>{inc.dno}</div>
          {outwardCodes.length > 0 && (
            <div style={{ fontSize: 10, color: "#94a3b8", lineHeight: 1.5 }}>
              {outwardCodes.map((oc) => <div key={oc}>{oc}</div>)}
            </div>
          )}
        </div>
      </div>
      <div style={{ padding: "10px 14px" }}>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>First reported:</div>
          <div style={{ fontSize: 14, color: "#f1f5f9" }}>{inc.startedAt ? formatDate(inc.startedAt) : "Unknown"}</div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>{simplifiedKind === "resolved" ? "Restored:" : "Est. Restore:"}</div>
          <div style={{ fontSize: 14, color: "#f1f5f9" }}>{inc.estRestoration ? formatDate(inc.estRestoration) : "Unknown"}</div>
        </div>
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0" }}>Properties affected:</div>
          <div style={{ fontSize: 14, color: "#f1f5f9" }}>{inc.customersAffected != null ? inc.customersAffected : "Unknown"}</div>
        </div>
        {description && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #334155" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#e2e8f0", marginBottom: 4 }}>DNO Update:</div>
            <div style={{ fontSize: 12, color: "#cbd5e1", lineHeight: 1.4 }}>{description.length > 200 ? description.substring(0, 200) + "..." : description}</div>
          </div>
        )}
      </div>
      {dnoUrl && (
        <a href={dnoUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "12px 14px", backgroundColor: color, color: "#fff", fontSize: 13, fontWeight: 600, textDecoration: "none", textAlign: "center" }}>
          View on {inc.dno} Website
        </a>
      )}
    </div>
  );
}

export function IncidentMarkers({ incidents, onSelect }: { incidents: Incident[]; onSelect: (i: Incident) => void }) {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);
  const clusterGroupRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  // Initialize cluster group
  useEffect(() => {
    if (!map) return;
    
    const clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 25,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: any) => {
        const count = cluster.getChildCount();
        const markers = cluster.getAllChildMarkers();
        
        // Determine color based on dominant DNO
        const dnoCounts: Record<string, number> = {};
        markers.forEach((m: any) => {
          const dno = m.incident?.dno || 'Unknown';
          dnoCounts[dno] = (dnoCounts[dno] || 0) + 1;
        });
        
        let dominantDno = 'Unknown';
        let maxCount = 0;
        for (const [dno, c] of Object.entries(dnoCounts)) {
          if (c > maxCount) {
            maxCount = c;
            dominantDno = dno;
          }
        }
        
        const color = dnoColor(dominantDno);
        const size = count < 10 ? 30 : count < 50 ? 40 : 50;
        
        return L.divIcon({
          html: `<div style="background-color: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${count < 10 ? 12 : 14}px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${count}</div>`,
          className: 'marker-cluster',
          iconSize: L.point(size, size),
        });
      },
    });
    
    map.addLayer(clusterGroup);
    clusterGroupRef.current = clusterGroup;
    setReady(true);
    
    return () => {
      map.removeLayer(clusterGroup);
    };
  }, [map]);

  // Update markers when incidents change
  useEffect(() => {
    if (!clusterGroupRef.current || !ready) return;
    
    const clusterGroup = clusterGroupRef.current;
    clusterGroup.clearLayers();
    
    const deduped = dedupeByCoords(incidents);
    
    deduped.forEach((inc) => {
      if (inc.lat == null || inc.lon == null) return;
      
      const color = dnoColor(inc.dno);
      const marker = L.circleMarker([inc.lat, inc.lon], {
        radius: 7,
        color: "#ffffff",
        fillColor: color,
        fillOpacity: 1,
        weight: 2,
      });
      
      (marker as any).incident = inc;
      
      marker.on("click", (e: L.LeafletMouseEvent) => {
        const dnoUrl = DNO_URLS[inc.dno];
        
        if (!containerRef.current) {
          containerRef.current = document.createElement("div");
          rootRef.current = createRoot(containerRef.current);
        }
        rootRef.current!.render(React.createElement(PopupContent, { inc, color, dnoUrl }));
        
        map.closePopup();
        
        L.popup({
          maxWidth: 360,
          minWidth: 300,
          autoClose: false,
          closeOnClick: false,
        })
          .setLatLng(e.latlng)
          .setContent(containerRef.current)
          .openOn(map);
        
        onSelect(inc);
      });
      
      clusterGroup.addLayer(marker);
    });
  }, [incidents, ready, map, onSelect]);

  return null;
}

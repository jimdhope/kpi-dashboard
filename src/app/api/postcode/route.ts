export const dynamic = "force-dynamic";

const GW = process.env.DATA_GATEWAY_URL || "http://10.0.0.245:4000";
const CENTRES: Record<string, [number, number]> = {
  AB: [-2.0, 57.0], AL: [-0.4, 51.8], B: [-2.0, 52.5],
  BA: [-2.5, 51.5], BB: [-2.0, 53.5], BD: [-1.5, 53.5],
  BH: [-1.5, 50.7], BL: [-3.0, 53.5], BR: [-0.1, 51.4],
  BS: [-2.5, 51.5], CA: [-3.5, 54.5], CB: [-0.1, 52.2],
  CF: [-3.0, 51.5], CH: [-2.5, 53.5], CM: [0.5, 51.5],
  CR: [-0.1, 51.5], CT: [-1.0, 51.5], CV: [-1.5, 52.5],
  DD: [-2.5, 54.5], DG: [-3.5, 55.5], DL: [-2.0, 54.5],
  DN: [-1.0, 54.5], DT: [-3.0, 50.7], E: [-0.1, 51.5],
  EC: [-0.1, 51.5], EH: [-3.0, 55.5], EN: [-0.3, 51.6],
  EX: [-3.0, 50.7], FY: [-3.0, 53.5], G: [-3.5, 55.0],
  GL: [-2.5, 51.5], GU: [0.3, 51.3], HA: [-0.3, 51.5],
  HD: [-1.5, 53.5], HG: [-1.5, 53.5], HR: [-1.0, 51.5],
  HU: [-1.0, 53.5], IG: [0.1, 51.5], IP: [1.0, 52.1],
  IV: [-4.0, 56.0], KA: [-4.0, 55.5], KT: [0.3, 51.3],
  KW: [-3.5, 58.0], L: [-2.5, 53.5], LA: [-3.5, 54.5],
  LD: [-3.0, 51.5], LE: [-1.5, 52.5], LL: [-3.0, 51.5],
  LN: [-0.5, 52.5], LS: [-1.5, 53.5], LU: [0.1, 51.6],
  M: [-2.0, 53.5], ME: [0.3, 51.4], MK: [-0.8, 52.0],
  N: [-0.2, 51.5], NE: [-1.5, 52.5], NG: [-1.0, 53.0],
  NN: [-1.0, 52.5], NR: [-1.0, 52.6], NW: [-0.2, 51.5],
  OL: [-2.0, 53.5], OX: [-1.5, 51.5], PA: [-4.5, 55.8],
  PE: [-0.5, 52.5], PH: [-4.0, 56.5], PL: [-4.0, 50.5],
  PO: [1.0, 51.0], PR: [-3.0, 53.5], RG: [-1.0, 51.5],
  S: [-1.5, 53.0], SE: [0.0, 51.5], SL: [-0.5, 51.5],
  SM: [-0.3, 51.4], SO: [-1.0, 51.0], SP: [-1.5, 51.5],
  SR: [-3.0, 51.5], SS: [-3.0, 51.5], ST: [-2.5, 52.0],
  SW: [-0.2, 51.5], SY: [-3.0, 52.0], TA: [-3.5, 51.0],
  TD: [-3.0, 55.5], TF: [-2.5, 52.5], TQ: [-0.5, 51.0],
  TR: [1.0, 51.0], TS: [-1.0, 54.5], TW: [-0.5, 51.3],
  UB: [0.3, 51.5], W: [-0.2, 51.5], WA: [-3.0, 52.5],
  WC: [-0.1, 51.5], WD: [-0.3, 51.6], WF: [-2.0, 54.0],
  WS: [-2.0, 52.5], WV: [-2.5, 52.5], YO: [-1.5, 53.5], ZE: [-3.5, 58.5],
};

function geocode(postcode: string): { lon: number; lat: number } {
  const n = postcode.toUpperCase().replace(/\s/g, "");
  const outward = n.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/)?.[1] || n.slice(0, 3);
  if (CENTRES[outward]) return { lon: CENTRES[outward][0], lat: CENTRES[outward][1] };
  const f = outward[0];
  const ROUGH: Record<string, [number, number]> = {
    A: [-2.0, 57.0], B: [-2.0, 52.5], C: [-3.0, 51.5], D: [-2.0, 54.5],
    E: [-0.1, 51.5], F: [-3.0, 50.5], G: [-3.5, 55.0], H: [-0.3, 51.5],
    K: [-4.0, 55.5], L: [-2.5, 53.5], M: [-2.0, 53.5], N: [-0.2, 51.5],
    P: [1.0, 51.0], R: [-1.0, 51.5], S: [-1.5, 53.0], T: [-2.5, 52.0], W: [-0.2, 51.5],
  };
  if (ROUGH[f]) return { lon: ROUGH[f][0], lat: ROUGH[f][1] };
  return { lon: -3.0, lat: 53.0 };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const postcode = searchParams.get("postcode") || "";
  const r = await fetch(`${GW}/api/postcode?postcode=${encodeURIComponent(postcode)}`, {
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json();
  
  // Geocode locally (data gateway doesn't return searchLocation)
  const loc = geocode(postcode);
  data.searchLocation = loc;
  
  // Map snake_case from data gateway to camelCase expected by UI
  if (data.incidents) {
    data.incidents = data.incidents.map((inc: any) => ({
      ...inc,
      lat: inc.lat != null ? parseFloat(inc.lat) : null,
      lon: inc.lon != null ? parseFloat(inc.lon) : null,
      startedAt: inc.started_at,
      estRestoration: inc.est_restoration,
      customersAffected: inc.customers_affected,
      updatedAt: inc.updated_at,
      createdAt: inc.created_at,
      provider_raw_data: inc.raw_data,
    }));
  }
  
  return new Response(JSON.stringify(data), {
    status: r.status,
    headers: { "content-type": "application/json" },
  });
}

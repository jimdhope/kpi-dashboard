export function outwardCode(postcode: string): string {
  const n = postcode.toUpperCase().replace(/\s/g, "");
  return n.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/)?.[1] || n.slice(0, 3);
}

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

const ROUGH: Record<string, [number, number]> = {
  A: [-2.0, 57.0], B: [-2.0, 52.5], C: [-3.0, 51.5], D: [-2.0, 54.5],
  E: [-0.1, 51.5], F: [-3.0, 50.5], G: [-3.5, 55.0], H: [-0.3, 51.5],
  K: [-4.0, 55.5], L: [-2.5, 53.5], M: [-2.0, 53.5], N: [-0.2, 51.5],
  P: [1.0, 51.0], R: [-1.0, 51.5], S: [-1.5, 53.0], T: [-2.5, 52.0], W: [-0.2, 51.5],
};

export function lookupLatLon(postcode: string): [number, number] {
  const oc = outwardCode(postcode);
  if (CENTRES[oc]) return CENTRES[oc];
  const f = oc[0];
  if (ROUGH[f]) return ROUGH[f];
  return [-3.0, 53.0];
}

const DNO_MAP: Record<string, string> = {
  AB3: "Northern Powergrid", BT: "Northern Powergrid", DD: "Northern Powergrid",
  DG: "Northern Powergrid", HD: "Northern Powergrid", HG: "Northern Powergrid",
  HX: "Northern Powergrid", IV: "Northern Powergrid", KW: "Northern Powergrid",
  LD: "Northern Powergrid", LL: "Northern Powergrid", LS: "Northern Powergrid",
  ML: "Northern Powergrid", OL: "Northern Powergrid", PA: "Northern Powergrid",
  PH: "Northern Powergrid", SR: "Northern Powergrid", TS: "Northern Powergrid",
  WF: "Northern Powergrid", ZE: "Northern Powergrid",
  AB: "SSEN", BD: "SSEN", KY: "SSEN", NE: "SSEN", TD: "SSEN",
  B: "National Grid (Western Power)", BA: "National Grid (Western Power)", BB: "National Grid (Western Power)",
  BH: "National Grid (Western Power)", BL: "National Grid (Western Power)", BR: "National Grid (Western Power)",
  BS: "National Grid (Western Power)", CA: "National Grid (Western Power)", CB: "National Grid (Western Power)",
  CF: "National Grid (Western Power)", CH: "National Grid (Western Power)", CM: "National Grid (Western Power)",
  CV: "National Grid (Western Power)", DH: "National Grid (Western Power)", DN: "National Grid (Western Power)",
  DT: "National Grid (Western Power)", EH: "National Grid (Western Power)", EX: "National Grid (Western Power)",
  FY: "National Grid (Western Power)", G: "National Grid (Western Power)", GL: "National Grid (Western Power)",
  GU: "National Grid (Western Power)", HR: "National Grid (Western Power)", HU: "National Grid (Western Power)",
  IP: "National Grid (Western Power)", L: "National Grid (Western Power)", LA: "National Grid (Western Power)",
  LE: "National Grid (Western Power)", LN: "National Grid (Western Power)", NG: "National Grid (Western Power)",
  NN: "National Grid (Western Power)", NR: "National Grid (Western Power)", OX: "National Grid (Western Power)",
  PL: "National Grid (Western Power)", PO: "National Grid (Western Power)", RG: "National Grid (Western Power)",
  S: "National Grid (Western Power)", SL: "National Grid (Western Power)", SM: "National Grid (Western Power)",
  SO: "National Grid (Western Power)", SP: "National Grid (Western Power)", ST: "National Grid (Western Power)",
  SY: "National Grid (Western Power)", TA: "National Grid (Western Power)", TF: "National Grid (Western Power)",
  TQ: "National Grid (Western Power)", TR: "National Grid (Western Power)", WA: "National Grid (Western Power)",
  WD: "National Grid (Western Power)", WR: "National Grid (Western Power)", WS: "National Grid (Western Power)",
  WV: "National Grid (Western Power)", YO: "National Grid (Western Power)",
  CR: "UK Power Networks", E: "UK Power Networks", EC: "UK Power Networks",
  EN: "UK Power Networks", HA: "UK Power Networks", IG: "UK Power Networks",
  KT: "UK Power Networks", N: "UK Power Networks", NW: "UK Power Networks",
  RM: "UK Power Networks", SE: "UK Power Networks", SW: "UK Power Networks",
  TW: "UK Power Networks", UB: "UK Power Networks", W: "UK Power Networks",
  WC: "UK Power Networks", WG: "UK Power Networks",
};

export function findDno(postcode: string): string {
  const oc = outwardCode(postcode);
  if (DNO_MAP[oc]) return DNO_MAP[oc];
  const lonLat = lookupLatLon(postcode);
  if (lonLat[1] > 55) return "Northern Powergrid";
  if (lonLat[1] < 51 && lonLat[0] < -2) return "National Grid (Western Power)";
  if (lonLat[1] > 52 && lonLat[0] > -2) return "UK Power Networks";
  if (lonLat[0] < -3) return "National Grid (Western Power)";
  return "National Grid (Western Power)";
}

export function regions(): Record<string, string> {
  return DNO_MAP;
}

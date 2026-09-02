export interface Incident {
  source: string;
  dno: string;
  incident_id: string;
  reference: string;
  postcode: string;
  status: string;
  severity: string;
  lat: number | null;
  lon: number | null;
  road: string;
  town: string;
  customersAffected: number | null;
  estRestoration: string;
  startedAt: string | null;
  updatedAt?: string;
  area?: string;
  description?: string;
  message?: string;
  allPostcodes?: string;
  provider_raw_data?: {
    description?: string;
    postcode?: string;
    lat?: number;
    lon?: number;
    status?: string;
    customerstagesequencemessage?: string;
    message?: string;
    [key: string]: unknown;
  };
}

export interface PostcodeResult {
  postcode: string;
  outwardCode: string;
  searchLocation: { lon: number; lat: number };
  dno: string;
  count: number;
  incidents: Incident[];
  timestamp: number;
}

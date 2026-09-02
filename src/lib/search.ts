export const POSTCODE_RE = /^[A-Z]{1,2}\d{1,2}[A-Z]?(\d[A-Z]{2})?$/;

export type SearchResult = {
  lon: number;
  lat: number;
  postcode: string;
};

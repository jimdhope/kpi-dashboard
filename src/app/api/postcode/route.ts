export const dynamic = "force-dynamic";

const GW = process.env.DATA_GATEWAY_URL || "http://10.0.0.245:4000";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const postcode = searchParams.get("postcode") || "";
  const r = await fetch(`${GW}/api/postcode?postcode=${encodeURIComponent(postcode)}`, {
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json();
  
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

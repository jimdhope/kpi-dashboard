export const dynamic = "force-dynamic";

const GW = process.env.DATA_GATEWAY_URL || "http://10.0.0.245:4000";

export async function GET() {
  const r = await fetch(`${GW}/api/power-cuts`, {
    signal: AbortSignal.timeout(10000),
  });
  const data = await r.json();
  
  // Map snake_case from data gateway to camelCase expected by UI
  if (data.incidents) {
    data.incidents = data.incidents.map((inc: any) => ({
      ...inc,
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

export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";

function mapIncident(row: any) {
  return {
    ...row,
    lat: row.lat != null ? parseFloat(row.lat) : null,
    lon: row.lon != null ? parseFloat(row.lon) : null,
    startedAt: row.started_at,
    estRestoration: row.est_restoration,
    customersAffected: row.customers_affected,
    updatedAt: row.updated_at,
    createdAt: row.created_at,
    provider_raw_data: row.raw_data,
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const postcode = searchParams.get("postcode") || "";
  const outward = postcode.split(' ')[0].toUpperCase();
  
  const { rows: active } = await pool.query(`
    SELECT *, 'active' as result_type
    FROM incidents
    WHERE SPLIT_PART(postcode, ' ', 1) ILIKE $1
    AND status NOT IN ('restored', 'resolved', 'completed', 'fixed', 'closed', 'fully_resolved')
    ORDER BY updated_at DESC
  `, [`${outward}%`]);

  const { rows: resolved } = await pool.query(`
    SELECT *, 'resolved' as result_type
    FROM incidents
    WHERE SPLIT_PART(postcode, ' ', 1) ILIKE $1
    AND status IN ('restored', 'resolved', 'completed', 'fixed', 'closed', 'fully_resolved')
    AND updated_at > NOW() - INTERVAL '24 hours'
    ORDER BY updated_at DESC
  `, [`${outward}%`]);

  return new Response(JSON.stringify({
    postcode,
    outwardCode: outward,
    count: active.length,
    activeCount: active.length,
    resolvedCount: resolved.length,
    incidents: [...active.map(mapIncident), ...resolved.map(mapIncident)],
    timestamp: Date.now(),
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

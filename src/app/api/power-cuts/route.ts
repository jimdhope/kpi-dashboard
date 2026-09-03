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

export async function GET() {
  const { rows } = await pool.query(`
    SELECT * FROM incidents 
    WHERE status NOT IN ('restored', 'resolved', 'completed', 'fixed', 'closed', 'fully_resolved')
    ORDER BY updated_at DESC
  `);
  const incidents = rows.map(mapIncident);
  return new Response(JSON.stringify({ incidents, activeCount: incidents.length, resolvedCount: 0, timestamp: Date.now() }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

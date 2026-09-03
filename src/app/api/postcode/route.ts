export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";

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
    incidents: [...active, ...resolved],
    timestamp: Date.now(),
  }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

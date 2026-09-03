export const dynamic = "force-dynamic";

import { pool } from "@/lib/db";

export async function GET() {
  const { rows } = await pool.query(`
    SELECT * FROM incidents 
    WHERE status NOT IN ('restored', 'resolved', 'completed', 'fixed', 'closed', 'fully_resolved')
    ORDER BY updated_at DESC
  `);
  return new Response(JSON.stringify({ incidents: rows, activeCount: rows.length, resolvedCount: 0, timestamp: Date.now() }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

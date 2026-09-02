export const dynamic = "force-dynamic";

const GW = process.env.DATA_GATEWAY_URL || "http://10.0.0.245:4000";

export async function GET() {
  const r = await fetch(`${GW}/api/power-cuts`, {
    signal: AbortSignal.timeout(10000),
  });
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { "content-type": "application/json" },
  });
}

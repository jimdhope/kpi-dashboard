export const dynamic = "force-dynamic";

const GW = process.env.DATA_GATEWAY_URL || "http://10.0.0.245:4000";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const postcode = searchParams.get("postcode") || "";
  const r = await fetch(`${GW}/api/postcode?postcode=${encodeURIComponent(postcode)}`, {
    signal: AbortSignal.timeout(10000),
  });
  return new Response(await r.body, {
    status: r.status,
    headers: { "content-type": "application/json" },
  });
}

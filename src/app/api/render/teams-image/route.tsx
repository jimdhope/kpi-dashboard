import { ImageResponse } from "next/og";

export const runtime = "nodejs";

function read(searchParams: URLSearchParams, key: string, fallback = "") {
  return searchParams.get(key)?.slice(0, 240) ?? fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = read(searchParams, "title", "KPI Quest");
  const subtitle = read(searchParams, "subtitle");
  const metric = read(searchParams, "metric");
  const footer = read(searchParams, "footer");
  const accent = read(searchParams, "accent", "007A5A").replace(/[^0-9A-Fa-f]/g, "").slice(0, 6) || "007A5A";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #f7f4eb 0%, #ece6d7 50%, #d7d1c0 100%)",
          color: "#16221c",
          padding: "56px",
          fontFamily: "Georgia",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxWidth: "72%" }}>
            <div style={{ fontSize: 20, letterSpacing: 3, textTransform: "uppercase", color: `#${accent}` }}>
              KPI Quest
            </div>
            <div style={{ fontSize: 64, lineHeight: 1.05, fontWeight: 700 }}>{title}</div>
            {subtitle ? <div style={{ fontSize: 28, lineHeight: 1.3, color: "#314338" }}>{subtitle}</div> : null}
          </div>
          <div
            style={{
              width: 120,
              height: 120,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 24,
              background: `#${accent}`,
              color: "#fffaf0",
              fontSize: 48,
              fontWeight: 700,
            }}
          >
            KQ
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {metric ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "18px",
                padding: "20px 24px",
                borderRadius: 20,
                background: "rgba(255,255,255,0.65)",
                border: "2px solid rgba(22,34,28,0.08)",
              }}
            >
              <div style={{ width: 12, height: 60, borderRadius: 999, background: `#${accent}` }} />
              <div style={{ fontSize: 36, fontWeight: 700 }}>{metric}</div>
            </div>
          ) : null}
          {footer ? <div style={{ fontSize: 22, color: "#4b5e53" }}>{footer}</div> : null}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

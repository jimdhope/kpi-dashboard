import { ImageResponse } from "next/og";

export const runtime = "edge";

interface KPIEntry {
  rank: number;
  agentName: string;
  score: number;
}

interface KPICardParams {
  kpiName: string;
  kpiType: string;
  sortOrder: string;
  entries: KPIEntry[];
}

function read(searchParams: URLSearchParams, key: string, fallback = "") {
  return searchParams.get(key)?.slice(0, 240) ?? fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kpiName = read(searchParams, "kpiName", "KPI");
  const kpiType = read(searchParams, "kpiType", "number");
  const sortOrder = read(searchParams, "sortOrder", "desc");
  const entriesJson = read(searchParams, "entries", "[]");

  let entries: KPIEntry[] = [];
  try {
    entries = JSON.parse(entriesJson);
  } catch {
    entries = [];
  }

  const isAsc = sortOrder === "asc";
  const medalColors = ["#FFD700", "#C0C0C0", "#CD7F32"];

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #f7f4eb 0%, #ece6d7 50%, #d7d1c0 100%)",
          color: "#16221c",
          padding: "32px",
          fontFamily: "Georgia",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                background: "rgba(0,122,90,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "24px",
              }}
            >
              📋
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "24px", fontWeight: 700 }}>{kpiName}</div>
              {kpiType === "percentage" && (
                <div style={{ fontSize: "14px", color: "#4b5e53" }}>{kpiType}</div>
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "6px",
              padding: "6px 12px",
              borderRadius: "999px",
              background: isAsc ? "rgba(59,130,246,0.1)" : "rgba(34,197,94,0.1)",
              color: isAsc ? "#3b82f6" : "#22c55e",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            {isAsc ? "↓ Lower is better" : "↑ Higher is better"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
          {entries.slice(0, 5).map((entry, index) => {
            const medalColor = index < 3 ? medalColors[index] : undefined;
            const bgColor = index < 3 ? "rgba(0,0,0,0.05)" : "transparent";
            const scoreText = kpiType === "percentage" ? `${entry.score.toFixed(1)}%` : entry.score.toLocaleString();

            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  borderRadius: "12px",
                  background: bgColor,
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "12px",
                    fontWeight: 700,
                    border: `2px solid ${medalColor ? medalColor + "50" : "#ccc"}`,
                    color: medalColor || "#666",
                    background: medalColor ? medalColor + "30" : "#f0f0f0",
                  }}
                >
                  {entry.rank}
                </div>
                <div style={{ flex: 1, fontSize: "16px", fontWeight: 500 }}>{entry.agentName}</div>
                <div style={{ fontSize: "18px", fontWeight: 700 }}>{scoreText}</div>
              </div>
            );
          })}
        </div>
      </div>
    ),
    {
      width: 500,
      height: 400,
    },
  );
}

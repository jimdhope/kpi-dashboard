import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#111621",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Side strips */}
        <div style={{ position: "absolute", top: 0, left: 0, width: 8, height: "100%", backgroundColor: "#d4af37", opacity: 0.5 }} />
        <div style={{ position: "absolute", top: 0, right: 0, width: 8, height: "100%", backgroundColor: "#d4af37", opacity: 0.5 }} />

        {/* Main content - simpler structure */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "60px 80px", position: "relative", zIndex: 1 }}>
          <div style={{ fontSize: 56, color: "#d4af37", marginBottom: 16 }}>🏆</div>
          <div style={{
            fontSize: 48,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            background: "linear-gradient(to right, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "#d4af37",
            textAlign: "center",
            lineHeight: 1.2,
            marginBottom: 16,
          }}>
            Test Pod KPI Competition
          </div>
          <div style={{ width: 96, height: 4, background: "#475569", borderRadius: 2, marginBottom: 40 }} />
          
          <div style={{ fontSize: 18, color: "#94a3b8", fontStyle: "italic", marginBottom: 16 }}>
            This is to officially recognize
          </div>
          <div style={{ fontSize: 56, fontWeight: 900, color: "#f8fafc", letterSpacing: "-0.02em", marginBottom: 24 }}>
            Winner Name
          </div>
          <div style={{ fontSize: 14, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.15em", marginBottom: 8 }}>
            for coming 1st Place during
          </div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#60a5fa", fontStyle: "italic", marginBottom: 40 }}>
            Test Week
          </div>
          
          <div style={{ display: "flex", gap: 120, marginTop: "auto" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 20, color: "#e2e8f0", borderBottom: "1px solid #475569", paddingBottom: 8, minWidth: 160, textAlign: "center" }}>
                Wed Mar 25 2026
              </div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em" }}>
                Date
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 20, color: "#e2e8f0", borderBottom: "1px solid #475569", paddingBottom: 8, minWidth: 160, textAlign: "center" }}>
                Team Manager
              </div>
              <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.15em" }}>
                Team Manager
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 848,
    }
  );
}

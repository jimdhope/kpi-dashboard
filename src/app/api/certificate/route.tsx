import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rank = parseInt(url.searchParams.get("rank") || "1", 10);
    const winnerName = url.searchParams.get("name") || "Winner";
    const podName = url.searchParams.get("podName") || "Team";
    const dateText = url.searchParams.get("date") || "Date";
    const competitionName = url.searchParams.get("competitionName") || "Competition";
    const managerName = url.searchParams.get("managerName") || "Manager";
    const isTeam = url.searchParams.get("isTeam") === "true";
    const membersParam = url.searchParams.get("members") || "";
    const membersList = membersParam ? membersParam.split(",").join("  •  ") : "";
    
    // Rank configurations
    const rankConfig: Record<number, { primary: string; gradient: string; position: string }> = {
      1: { primary: "#d4af37", gradient: "linear-gradient(to right, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c)", position: "1st" },
      2: { primary: "#c0c0c0", gradient: "linear-gradient(to right, #c0c0c0, #e8e8e8, #a8a8a8, #d3d3d3, #b5b5b5)", position: "2nd" },
      3: { primary: "#cd7f32", gradient: "linear-gradient(to right, #cd7f32, #daa520, #b87333, #e6be8a, #a57164)", position: "3rd" },
    };
    
    const config = rankConfig[rank] || rankConfig[1];

    // Load fonts from public folder
    const mrDafoeFont = readFileSync(join(process.cwd(), "public/fonts/mrdafoe.woff"));
    const lexendFont = readFileSync(join(process.cwd(), "public/fonts/lexend-400.ttf"));

    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            width: 1200,
            height: 848,
            backgroundColor: "#0f172a",
            color: "#f8fafc",
            fontFamily: "Lexend, sans-serif",
            position: "relative",
          }}
        >
          {/* Outer border */}
          <div
            style={{
              position: "absolute",
              top: 30,
              bottom: 30,
              left: 30,
              right: 30,
              borderWidth: 3,
              borderStyle: "solid",
              borderColor: config.primary,
              display: "flex",
            }}
          />
          
          {/* Inner border */}
          <div
            style={{
              position: "absolute",
              top: 42,
              bottom: 42,
              left: 42,
              right: 42,
              borderWidth: 1,
              borderStyle: "solid",
              borderColor: config.primary,
              opacity: 0.5,
              display: "flex",
            }}
          />
          
          {/* Main content - centered */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
              padding: 60,
              zIndex: 0,
            }}
          >
            {/* Trophy */}
            <span style={{ fontSize: 72, display: "flex" }}>
              🏆
            </span>
            
            {/* Header */}
            <span
              style={{
                fontSize: 20,
                letterSpacing: 6,
                color: "#64748b",
                textTransform: "uppercase",
                marginTop: 16,
                display: "flex",
              }}
            >
              Certificate of Excellence
            </span>
            
            {/* Competition title */}
            <span
              style={{
                fontSize: 44,
                fontWeight: 800,
                marginTop: 24,
                color: "#f8fafc",
                textAlign: "center",
                display: "flex",
              }}
            >
              {podName} KPI Competition
            </span>
            
            {/* Recognition text */}
            <span
              style={{
                fontSize: 22,
                fontStyle: "italic",
                marginTop: 48,
                color: "#94a3b8",
                display: "flex",
              }}
            >
              This is to officially recognize
            </span>
            
            {/* Winner name - Mr Dafoe font with rank color */}
            <span
              style={{
                fontSize: 72,
                fontWeight: 400,
                marginTop: 24,
                color: config.primary,
                fontFamily: "Mr Dafoe, cursive",
                borderBottomWidth: 2,
                borderBottomStyle: "solid",
                borderBottomColor: "#334155",
                paddingLeft: 48,
                paddingRight: 48,
                paddingBottom: 12,
                display: "flex",
              }}
            >
              {winnerName}
            </span>
            
            {/* Achievement text */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 32,
              }}
            >
              <span
                style={{
                  fontSize: 24,
                  color: "#64748b",
                  display: "flex",
                }}
              >
                for achieving
              </span>
              <span
                style={{
                  fontSize: 28,
                  fontWeight: 600,
                  color: config.primary,
                  marginLeft: 12,
                  marginRight: 12,
                  display: "flex",
                }}
              >
                {config.position} Place
              </span>
              <span
                style={{
                  fontSize: 24,
                  color: "#64748b",
                  display: "flex",
                }}
              >
                during {competitionName} Week
              </span>
            </div>
            
            {/* Team members section */}
            {isTeam && membersList && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  marginTop: 32,
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    color: "#64748b",
                    textTransform: "uppercase",
                    letterSpacing: 2,
                    display: "flex",
                  }}
                >
                  Team Members
                </span>
                <span
                  style={{
                    fontSize: 18,
                    color: "#94a3b8",
                    marginTop: 8,
                    display: "flex",
                  }}
                >
                  {membersList}
                </span>
              </div>
            )}
            
            {/* Signatures - pushed to bottom */}
            <div
              style={{
                display: "flex",
                flexDirection: "row",
                justifyContent: "space-between",
                width: "80%",
                maxWidth: 700,
                marginTop: "auto",
                paddingTop: 24,
              }}
            >
              {/* Date signature - Mr Dafoe font */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 26,
                    color: "#e2e8f0",
                    borderBottomWidth: 1,
                    borderBottomStyle: "solid",
                    borderBottomColor: "#475569",
                    paddingBottom: 10,
                    minWidth: 220,
                    textAlign: "center",
                    fontFamily: "Mr Dafoe, cursive",
                    display: "flex",
                  }}
                >
                  {dateText}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 10,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    display: "flex",
                  }}
                >
                  Date
                </span>
              </div>
              
              {/* Manager signature - Mr Dafoe font */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: 26,
                    color: "#e2e8f0",
                    borderBottomWidth: 1,
                    borderBottomStyle: "solid",
                    borderBottomColor: "#475569",
                    paddingBottom: 10,
                    minWidth: 220,
                    textAlign: "center",
                    fontFamily: "Mr Dafoe, cursive",
                    display: "flex",
                  }}
                >
                  {managerName}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    marginTop: 10,
                    textTransform: "uppercase",
                    letterSpacing: 1,
                    display: "flex",
                  }}
                >
                  Team Manager
                </span>
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 848,
        fonts: [
          {
            name: "Mr Dafoe",
            data: mrDafoeFont,
            weight: 400,
            style: "normal",
          },
          {
            name: "Lexend",
            data: lexendFont,
            weight: 400,
            style: "normal",
          },
        ],
      }
    );
  } catch (error) {
    console.error("Certificate error:", error);
    return new Response("Error: " + (error instanceof Error ? error.message : "Unknown"), { status: 500 });
  }
}

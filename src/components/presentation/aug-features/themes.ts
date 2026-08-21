export type ActId = "opening" | "dashboard" | "byb" | "league" | "close";

export type SceneConfig = {
  particleColor: string;
  trophy: boolean;
  sparkleColor: string | null;
};

export type ActTheme = {
  id: ActId;
  label: string;
  gradient: string;
  accent: string;
  accent2: string;
  scene: SceneConfig;
};

export const ACT_THEMES: Record<ActId, ActTheme> = {
  opening: {
    id: "opening",
    label: "Prologue",
    gradient:
      "radial-gradient(120% 90% at 75% 15%, #2a1b54 0%, #150b2e 45%, #0b0716 100%)",
    accent: "#f5c04e",
    accent2: "#8b5cf6",
    scene: { particleColor: "#a78bfa", trophy: true, sparkleColor: "#e9d5ff" },
  },
  dashboard: {
    id: "dashboard",
    label: "Your Dashboard",
    gradient:
      "radial-gradient(115% 90% at 65% 25%, #0d3a38 0%, #062120 50%, #03100f 100%)",
    accent: "#2dd4bf",
    accent2: "#5eead4",
    scene: { particleColor: "#2dd4bf", trophy: false, sparkleColor: null },
  },
  byb: {
    id: "byb",
    label: "Feature 01 · Beat Your Best",
    gradient:
      "radial-gradient(115% 90% at 70% 25%, #0a2a5e 0%, #041531 50%, #020a14 100%)",
    accent: "#60a5fa",
    accent2: "#38bdf8",
    scene: { particleColor: "#60a5fa", trophy: false, sparkleColor: null },
  },
  league: {
    id: "league",
    label: "Feature 02 · The KPI League",
    gradient:
      "radial-gradient(115% 90% at 30% 20%, #0b3d1f 0%, #062312 50%, #03130a 100%)",
    accent: "#4ade80",
    accent2: "#fbbf24",
    scene: { particleColor: "#4ade80", trophy: false, sparkleColor: "#fbbf24" },
  },
  close: {
    id: "close",
    label: "Save the Date",
    gradient:
      "radial-gradient(120% 90% at 50% 80%, #3a2a06 0%, #1d1403 50%, #0f0a02 100%)",
    accent: "#fbbf24",
    accent2: "#f59e0b",
    scene: { particleColor: "#fbbf24", trophy: true, sparkleColor: "#fde68a" },
  },
};

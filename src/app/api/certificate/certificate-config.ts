/**
 * Certificate Template Configuration
 * 
 * Edit this file to customize the certificate appearance.
 * The values here are used by the /api/certificate route.
 */

// ============================================
// COLORS
// ============================================

export const COLORS = {
  // Background colors
  background: "#0f172a",      // Main background
  backgroundOverlay: "#111827", // Overlay layer
  
  // Rank colors
  gold: {
    primary: "#d4af37",
    gradient: "linear-gradient(to right, #bf953f, #fcf6ba, #b38728, #fbf5b7, #aa771c)",
  },
  silver: {
    primary: "#a8a8a8", 
    gradient: "linear-gradient(to right, #c0c0c0, #e8e8e8, #a8a8a8, #d3d3d3, #b5b5b5)",
  },
  bronze: {
    primary: "#b87333",
    gradient: "linear-gradient(to right, #cd7f32, #daa520, #b87333, #e6be8a, #a57164)",
  },
  
  // Text colors
  text: {
    primary: "#f8fafc",      // Main text (white)
    secondary: "#94a3b8",    // Subtitle text
    muted: "#64748b",        // Labels/captions
    blue: "#60a5fa",         // Competition name
    border: "#334155",        // Dividers/borders
  },
  
  // Decorative
  sideStripOpacity: 0.8,
  titleDividerOpacity: 0.5,
};

// ============================================
// LAYOUT SIZES
// ============================================

export const SIZES = {
  // Certificate dimensions (DO NOT CHANGE - used by ImageResponse)
  width: 1200,
  height: 848,
  
  // Side strips
  sideStripWidth: 6,
  topLineHeight: 4,
  
  // Typography
  trophySize: 64,
  titleSize: 38,
  nameSize: 52,
  competitionSize: 26,
  subtitleSize: 18,
  labelSize: 14,
  captionSize: 12,
  signatureSize: 18,
  signatureLabelSize: 10,
  
  // Spacing
  padding: 48,
  marginTop: {
    title: 12,
    titleDivider: 16,
    subtitle: 40,
    name: 16,
    position: 20,
    teamMembers: 28,
    signatures: 32,
  },
  dividerWidth: 80,
  signatureMinWidth: 140,
  signatureMaxWidth: 480,
};

// ============================================
// CONTENT TEMPLATES
// ============================================

export const TEMPLATES = {
  // Trophy emoji
  trophy: "🏆",
  
  // Subtitle text
  subtitle: "This is to officially recognize",
  
  // Position text template
  positionText: (position: string) => `for coming ${position} Place during`,
  
  // Competition suffix
  competitionSuffix: "Week",
  
  // Team members label
  teamMembersLabel: "Team Members",
  
  // Signature labels
  signatureLabels: {
    date: "Date",
    manager: "Team Manager",
  },
  
  // Title template
  titleTemplate: (podName: string) => `${podName} KPI Competition`,
};

// ============================================
// RANK CONFIGURATIONS
// ============================================

export type RankType = 1 | 2 | 3;

export const RANK_CONFIGS: Record<RankType, {
  primary: string;
  gradient: string;
  position: string;
}> = {
  1: {
    primary: COLORS.gold.primary,
    gradient: COLORS.gold.gradient,
    position: "1st",
  },
  2: {
    primary: COLORS.silver.primary,
    gradient: COLORS.silver.gradient,
    position: "2nd",
  },
  3: {
    primary: COLORS.bronze.primary,
    gradient: COLORS.bronze.gradient,
    position: "3rd",
  },
};

// ============================================
// JSX TEMPLATE (for reference)
// ============================================

/**
 * The actual JSX used in /api/certificate/route.tsx:
 * 
 * ```tsx
 * <div
 *   style={{
 *     height: "100%",
 *     width: "100%",
 *     display: "flex",
 *     flexDirection: "column",
 *     background: COLORS.background,
 *     position: "relative",
 *   }}
 * >
 *   {/* Background overlay *\/}
 *   <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: COLORS.backgroundOverlay, display: "flex" }} />
 *   
 *   {/* Side strips *\/}
 *   <div style={{ position: "absolute", top: 0, left: 0, width: SIZES.sideStripWidth, height: "100%", background: config.primary, opacity: COLORS.sideStripOpacity, display: "flex" }} />
 *   <div style={{ position: "absolute", top: 0, right: 0, width: SIZES.sideStripWidth, height: "100%", background: config.primary, opacity: COLORS.sideStripOpacity, display: "flex" }} />
 *   
 *   {/* Top decorative line *\/}
 *   <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: SIZES.topLineHeight, background: config.primary, opacity: 0.6, display: "flex" }} />
 *   
 *   {/* Main content *\/}
 *   <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: SIZES.padding, flex: 1, position: "relative" }}>
 *     
 *     {/* Trophy *\/}
 *     <div style={{ fontSize: SIZES.trophySize, color: config.primary, display: "flex" }}>{TEMPLATES.trophy}</div>
 *     
 *     {/* Title *\/}
 *     <div style={{ fontSize: SIZES.titleSize, fontWeight: 800, background: config.gradient, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textAlign: "center", textTransform: "uppercase", letterSpacing: "0.04em", marginTop: SIZES.marginTop.title, display: "flex" }}>
 *       {TEMPLATES.titleTemplate(podName)}
 *     </div>
 *     
 *     {/* Title divider *\/}
 *     <div style={{ width: SIZES.dividerWidth, height: 4, backgroundColor: config.primary, opacity: SIZES.titleDividerOpacity, marginTop: SIZES.marginTop.titleDivider, borderRadius: 2, display: "flex" }} />
 *     
 *     {/* Subtitle *\/}
 *     <div style={{ fontSize: SIZES.subtitleSize, color: COLORS.text.secondary, fontStyle: "italic", marginTop: SIZES.marginTop.subtitle, display: "flex" }}>
 *       {TEMPLATES.subtitle}
 *     </div>
 *     
 *     {/* Winner name *\/}
 *     <div style={{ fontSize: SIZES.nameSize, fontWeight: 900, color: COLORS.text.primary, marginTop: SIZES.marginTop.name, display: "flex", padding: "8px 32px", borderBottom: `2px solid ${COLORS.text.border}` }}>
 *       {name}
 *     </div>
 *     
 *     {/* Position *\/}
 *     <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: SIZES.marginTop.position }}>
 *       <div style={{ fontSize: SIZES.labelSize, color: COLORS.text.muted, textTransform: "uppercase", letterSpacing: "0.12em", display: "flex" }}>
 *         {TEMPLATES.positionText(config.position)}
 *       </div>
 *       <div style={{ fontSize: SIZES.competitionSize, color: COLORS.text.blue, fontStyle: "italic", marginTop: 8, display: "flex" }}>
 *         {competitionName} {TEMPLATES.competitionSuffix}
 *       </div>
 *     </div>
 *     
 *     {/* Team members (if team) *\/}
 *     {isTeam && members.length > 0 && (
 *       <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: SIZES.marginTop.teamMembers }}>
 *         <div style={{ fontSize: SIZES.captionSize, color: COLORS.text.muted, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex" }}>
 *           {TEMPLATES.teamMembersLabel}
 *         </div>
 *         <div style={{ fontSize: 16, color: "#cbd5e1", marginTop: 8, display: "flex" }}>
 *           {members.join("  •  ")}
 *         </div>
 *       </div>
 *     )}
 *     
 *     {/* Signatures *\/}
 *     <div style={{ display: "flex", justifyContent: "space-between", width: "100%", maxWidth: SIZES.signatureMaxWidth, marginTop: "auto", paddingTop: SIZES.marginTop.signatures, borderTop: `1px solid ${COLORS.text.border}` }}>
 *       <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
 *         <div style={{ fontSize: SIZES.signatureSize, color: COLORS.text.primary, display: "flex", paddingBottom: 6, borderBottom: `1px solid ${COLORS.text.border}`, minWidth: SIZES.signatureMinWidth, justifyContent: "center" }}>{date}</div>
 *         <div style={{ fontSize: SIZES.signatureLabelSize, color: COLORS.text.muted, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex" }}>{TEMPLATES.signatureLabels.date}</div>
 *       </div>
 *       <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
 *         <div style={{ fontSize: SIZES.signatureSize, color: COLORS.text.primary, display: "flex", paddingBottom: 6, borderBottom: `1px solid ${COLORS.text.border}`, minWidth: SIZES.signatureMinWidth, justifyContent: "center" }}>{managerName}</div>
 *         <div style={{ fontSize: SIZES.signatureLabelSize, color: COLORS.text.muted, marginTop: 8, textTransform: "uppercase", letterSpacing: "0.1em", display: "flex" }}>{TEMPLATES.signatureLabels.manager}</div>
 *       </div>
 *     </div>
 *   </div>
 * </div>
 * ```
 */

// ============================================
// USAGE IN ROUTE.TSX
// ============================================

/**
 * To use this configuration in your route.tsx:
 * 
 * 1. Import the config:
 *    import { COLORS, SIZES, TEMPLATES, RANK_CONFIGS } from '../../certificate-config';
 * 
 * 2. Get the config for the current rank:
 *    const config = RANK_CONFIGS[rank as 1 | 2 | 3] || RANK_CONFIGS[1];
 * 
 * 3. Use the values in your JSX style objects.
 * 
 * Note: Since this is a separate file, you'll need to update route.tsx
 * to actually use these values. The config file is for REFERENCE and
 * makes it easy to see all customizable values in one place.
 */

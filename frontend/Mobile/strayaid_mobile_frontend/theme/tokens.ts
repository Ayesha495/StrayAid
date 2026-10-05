// StrayAid design tokens, taken from the Stitch design system
// (stitch_strayaid_app_design_system/strayaid_design_system/DESIGN.md).
// Every redesigned screen reads colours, type, spacing and shapes from here.

export const colors = {
  // Brand
  primary: "#1E6B56", // Rescue Green: primary buttons, active nav, verified
  primaryDeep: "#12251D",
  secondary: "#35A982", // Emerald: progress, success, rescued
  critical: "#F47C6C", // Urgent Coral: high/critical severity, destructive
  warning: "#F4B860", // Amber: medium severity, pending
  info: "#4A90E2", // Blue: info, AI highlights, map pins

  // Text
  ink: "#243447", // Slate Navy: headings and primary text
  inkMuted: "#747474", // supporting text
  onPrimary: "#FFFFFF",

  // Surfaces
  canvas: "#F8FAFC", // screen background
  surface: "#FFFFFF", // cards and containers
  mint: "#E7F4EE", // soft tint, selected chips
  border: "#E2E8F0",

  // Status chip backgrounds
  criticalSoft: "#FDECE9",
  warningSoft: "#FEF6EB",
  successSoft: "#E8F7F2",

  // Splash and photo overlays
  splashBase: "#0B1114",
};

// Font family names registered in app/_layout.tsx.
// Manrope is for headings and Inter for body text. Use these instead of fontWeight,
// because Android ignores fontWeight on custom fonts.
export const fonts = {
  displayMedium: "Manrope_500Medium",
  displaySemiBold: "Manrope_600SemiBold",
  displayBold: "Manrope_700Bold",
  displayExtraBold: "Manrope_800ExtraBold",
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
};

export const type = {
  displayLg: { fontFamily: fonts.displayExtraBold, fontSize: 32, lineHeight: 40 },
  headlineLg: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32 },
  headlineMd: { fontFamily: fonts.displayBold, fontSize: 20, lineHeight: 28 },
  headlineSm: { fontFamily: fonts.displaySemiBold, fontSize: 18, lineHeight: 24 },
  bodyLg: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  bodyMd: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  bodySm: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16 },
  labelLg: { fontFamily: fonts.bodySemiBold, fontSize: 14, lineHeight: 20 },
  labelMd: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16 },
  labelSm: { fontFamily: fonts.bodySemiBold, fontSize: 11, lineHeight: 14 },
  badge: { fontFamily: fonts.bodyBold, fontSize: 10, lineHeight: 12 },
} as const;

export const radius = {
  sm: 4,
  md: 8,
  input: 12,
  lg: 16,
  xl: 24,
  pill: 9999,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  gutter: 16,
};

// Soft tinted shadows (Slate Navy base). Level 1 = cards, 2 = sheets/dock, 3 = popovers.
export const shadows = {
  level1: {
    shadowColor: "#243447",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  level2: {
    shadowColor: "#243447",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 6,
  },
  level3: {
    shadowColor: "#243447",
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 10,
  },
};

export const sizes = {
  touchTarget: 48, // buttons and inputs
  iconButton: 40,
};

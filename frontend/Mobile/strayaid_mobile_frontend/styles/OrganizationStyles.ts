import { StyleSheet } from "react-native";
import { mobileTheme as theme } from "./mobileTheme";

export const organizationStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.surfaceMuted },
  scrollContent: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 48 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  topBarButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.surface, alignItems: "center", justifyContent: "center" },
  topBarSpacer: { width: 44, height: 44 },
  pageTitle: { color: theme.colors.ink, fontSize: 26, fontWeight: "800" },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, gap: theme.spacing.md, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  heroImage: { width: "100%", height: 220, borderRadius: theme.radius.md, backgroundColor: theme.colors.primarySoft },
  title: { color: theme.colors.ink, fontSize: 24, fontWeight: "800" },
  subtitle: { color: theme.colors.inkMuted, lineHeight: 22 },
  sectionTitle: { color: theme.colors.ink, fontSize: 20, fontWeight: "800" },
  metaText: { color: theme.colors.inkMuted, fontSize: 13 },
  bodyText: { color: theme.colors.inkSoft, lineHeight: 22 },
  infoGrid: { gap: theme.spacing.sm },
  infoCard: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing.md, backgroundColor: theme.colors.surfaceMuted, gap: 4 },
  infoLabel: { color: theme.colors.inkMuted, textTransform: "uppercase", fontWeight: "700", fontSize: 11 },
  animalCard: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.md, padding: theme.spacing.md, gap: theme.spacing.sm, backgroundColor: theme.colors.surfaceMuted },
  animalImage: { width: "100%", height: 180, borderRadius: theme.radius.md, backgroundColor: theme.colors.primarySoft },
  badge: { alignSelf: "flex-start", backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { color: theme.colors.primary, fontWeight: "700", fontSize: 11, textTransform: "uppercase" },
  animalTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: "700" },
  animalText: { color: theme.colors.inkSoft, lineHeight: 21 },
  actionButton: { alignSelf: "flex-start", backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, paddingHorizontal: 16, paddingVertical: 12 },
  actionButtonText: { color: theme.colors.surface, fontWeight: "700" },
});

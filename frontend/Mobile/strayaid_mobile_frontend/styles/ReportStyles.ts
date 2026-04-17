import { StyleSheet } from "react-native";
import { mobileTheme as theme } from "./mobileTheme";

export const reportStyles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.surfaceMuted },
  scrollContent: { padding: theme.spacing.lg, gap: theme.spacing.lg, paddingBottom: 120 },
  topBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { color: theme.colors.ink, fontSize: 28, fontWeight: "800" },
  card: { backgroundColor: theme.colors.surface, borderRadius: theme.radius.lg, padding: theme.spacing.lg, gap: theme.spacing.md, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  label: { color: theme.colors.ink, fontWeight: "700", marginBottom: 8 },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.sm, backgroundColor: theme.colors.surfaceMuted, paddingHorizontal: theme.spacing.md, paddingVertical: 14, color: theme.colors.ink, fontSize: 15 },
  textArea: { minHeight: 120, textAlignVertical: "top" },
  row: { flexDirection: "row", gap: theme.spacing.sm },
  rowButton: { flex: 1 },
  actionButton: { backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.sm, paddingVertical: 14, alignItems: "center" },
  actionButtonText: { color: theme.colors.primaryDeep, fontWeight: "700" },
  primaryButton: { backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, paddingVertical: 16, alignItems: "center" },
  primaryButtonText: { color: theme.colors.surface, fontWeight: "700", fontSize: 15 },
  imagePreview: { width: "100%", height: 220, borderRadius: theme.radius.md, backgroundColor: theme.colors.primarySoft },
  locationRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  locationInput: { flex: 1 },
  mapButton: { width: 54, height: 54, borderRadius: theme.radius.sm, backgroundColor: theme.colors.primarySoft, alignItems: "center", justifyContent: "center" },
  helperText: { color: theme.colors.inkMuted, lineHeight: 20, fontSize: 13 },
});

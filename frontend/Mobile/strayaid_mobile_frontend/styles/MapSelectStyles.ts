import { StyleSheet } from "react-native";
import { mobileTheme as theme } from "./mobileTheme";

export const mapSelectStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.surfaceMuted },
  map: { flex: 1 },
  bottomPanel: { padding: theme.spacing.lg, backgroundColor: theme.colors.surface, borderTopLeftRadius: theme.radius.lg, borderTopRightRadius: theme.radius.lg, gap: theme.spacing.md },
  title: { color: theme.colors.ink, fontSize: 20, fontWeight: "700" },
  helper: { color: theme.colors.inkMuted, lineHeight: 21 },
  coordinatesText: { fontSize: 14, color: theme.colors.primaryDeep, fontWeight: "700" },
  buttonRow: { flexDirection: "row", gap: theme.spacing.sm },
  secondaryButton: { flex: 1, backgroundColor: theme.colors.primarySoft, borderRadius: theme.radius.sm, paddingVertical: 14, alignItems: "center" },
  secondaryButtonText: { color: theme.colors.primaryDeep, fontWeight: "700" },
  primaryButton: { flex: 1, backgroundColor: theme.colors.primary, borderRadius: theme.radius.sm, paddingVertical: 14, alignItems: "center" },
  primaryButtonText: { color: theme.colors.surface, fontWeight: "700" },
});

import { StyleSheet } from "react-native";
import { mobileTheme as theme } from "./mobileTheme";

export const loginStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.surfaceMuted,
  },
  container: {
    flex: 1,
    padding: theme.spacing.xl,
    justifyContent: "center",
    gap: theme.spacing.lg,
  },
  heroCard: {
    backgroundColor: theme.colors.primaryDeep,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    shadowColor: theme.colors.primaryDeep,
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  eyebrow: {
    color: "#c9e8f7",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontSize: 12,
    fontWeight: "700",
    marginBottom: theme.spacing.sm,
  },
  heroTitle: {
    color: theme.colors.surface,
    fontSize: 32,
    fontWeight: "800",
    marginBottom: theme.spacing.sm,
  },
  heroText: {
    color: "#e7f4fb",
    fontSize: 15,
    lineHeight: 24,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  formTitle: {
    color: theme.colors.ink,
    fontSize: 24,
    fontWeight: "700",
  },
  formSubtitle: {
    color: theme.colors.inkMuted,
    fontSize: 14,
    lineHeight: 22,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 14,
    color: theme.colors.ink,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.sm,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryButtonText: {
    color: theme.colors.surface,
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: theme.colors.surface,
  },
  secondaryButtonText: {
    color: theme.colors.primaryDeep,
    fontSize: 15,
    fontWeight: "700",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  footerText: {
    color: theme.colors.inkMuted,
  },
  footerLink: {
    color: theme.colors.primary,
    fontWeight: "700",
  },
});

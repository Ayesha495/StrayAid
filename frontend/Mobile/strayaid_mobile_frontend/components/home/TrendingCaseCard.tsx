import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Severity, TrendingCase } from "../../services/homeService";
import { colors, fonts, shadows, type } from "../../theme/tokens";
import { formatDistance, timeAgo } from "../../utils/format";

// Stitch screen 3: a compact rescue case card for "Trending Rescue Cases".

const SEVERITY_STYLE: Record<Severity, { background: string; text: string; dot: string }> = {
  critical: { background: colors.critical, text: colors.onPrimary, dot: colors.onPrimary },
  high: { background: colors.critical, text: colors.onPrimary, dot: colors.onPrimary },
  medium: { background: colors.warning, text: colors.ink, dot: colors.ink },
  low: { background: "rgba(255,255,255,0.92)", text: colors.ink, dot: colors.secondary },
};

// Cases with a responder show the status in emerald; unclaimed ones stay neutral.
const ACTIVE_STATUSES = ["assigned", "in_progress"];

type Props = {
  item: TrendingCase;
  distanceKm: number | null;
  onPress: () => void;
};

export default function TrendingCaseCard({ item, distanceKm, onPress }: Props) {
  const severity = SEVERITY_STYLE[item.severity] ?? SEVERITY_STYLE.medium;
  const statusColor = ACTIVE_STATUSES.includes(item.status) ? colors.secondary : colors.inkMuted;
  const details = [
    item.title,
    `${item.severity} severity`,
    item.confidence_score != null ? `${item.confidence_score}% AI match` : null,
    distanceKm != null ? `${formatDistance(distanceKm)} away` : null,
    item.status_label,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={details}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.media}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        ) : (
          <MaterialIcons name="pets" size={28} color={colors.inkMuted} />
        )}
        <View style={[styles.severity, { backgroundColor: severity.background }]}>
          <View style={[styles.severityDot, { backgroundColor: severity.dot }]} />
          <Text style={[styles.severityText, { color: severity.text }]}>{item.severity.toUpperCase()}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <View>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
          </View>
          <View style={styles.badges}>
            {item.confidence_score != null && (
              <View style={styles.aiChip}>
                <MaterialIcons name="auto-awesome" size={13} color={colors.primary} />
                <Text style={styles.aiText}>{item.confidence_score}% AI Match</Text>
              </View>
            )}
            {distanceKm != null && (
              <View style={styles.distance}>
                <MaterialIcons name="near-me" size={14} color={colors.inkMuted} />
                <Text style={styles.distanceText}>{formatDistance(distanceKm)}</Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.footer}>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status_label}</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={18} color={colors.inkMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...shadows.level1,
  },
  pressed: { transform: [{ scale: 0.99 }] },
  media: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#E5EEFF",
    alignItems: "center",
    justifyContent: "center",
  },
  severity: {
    position: "absolute",
    top: 4,
    left: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  severityDot: { width: 6, height: 6, borderRadius: 3 },
  severityText: { ...type.badge },
  body: { flex: 1, minWidth: 0, height: 80, justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 4 },
  title: { flex: 1, fontFamily: fonts.displaySemiBold, fontSize: 16, lineHeight: 22, color: colors.ink },
  time: { ...type.labelSm, fontFamily: fonts.bodyMedium, color: colors.inkMuted },
  badges: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  aiChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.mint,
  },
  aiText: { ...type.labelSm, color: colors.primary },
  distance: { flexDirection: "row", alignItems: "center", gap: 2 },
  distanceText: { ...type.bodySm, color: colors.inkMuted },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { ...type.labelSm },
});

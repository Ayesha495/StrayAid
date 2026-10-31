import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import type { TrendingCase } from "../../services/homeService";
import type { LatLng } from "../../services/reportDraft";
import { colors, fonts } from "../../theme/tokens";
import { distanceKm, formatDistance } from "../../utils/format";

const CARD_WIDTH = 216;
const GAP = 12;

// Reported cases around the person, swiped sideways. Each card shows what someone looking for
// a reported animal knows about it: the address, how urgent it is and how far away.
export default function NearbyCaseCarousel({
  cases,
  me,
  onOpen,
}: {
  cases: TrendingCase[];
  me: LatLng | null;
  onOpen: (item: TrendingCase) => void;
}) {
  return (
    <FlatList
      horizontal
      data={cases}
      keyExtractor={(item) => String(item.id)}
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_WIDTH + GAP}
      decelerationRate="fast"
      contentContainerStyle={styles.list}
      style={styles.strip}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => {
        const urgent = item.severity === "critical" || item.severity === "high";
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.title}, ${item.status_label}. Open case`}
            onPress={() => onOpen(item)}
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          >
            <View style={styles.photo}>
              {item.image ? (
                <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <MaterialIcons name="pets" size={30} color="#BEC9C3" />
              )}
              <Text style={[styles.badge, urgent && styles.badgeUrgent]}>{item.severity[0].toUpperCase() + item.severity.slice(1)}</Text>
            </View>
            <View style={styles.body}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
              <View style={styles.row}>
                <MaterialIcons name="place" size={14} color={colors.primary} />
                <Text style={styles.area} numberOfLines={1}>
                  {item.area || "Address not given"}
                </Text>
              </View>
              <Text style={styles.meta} numberOfLines={1}>
                {[item.status_label, me && `${formatDistance(distanceKm(me, item))} away`].filter(Boolean).join(" • ")}
              </Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  strip: { marginHorizontal: -16 },
  list: { paddingHorizontal: 16, paddingVertical: 4, gap: GAP },
  card: {
    width: CARD_WIDTH,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: colors.surface,
    shadowColor: "#243447",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 2,
  },
  pressed: { transform: [{ scale: 0.98 }] },
  photo: { height: 112, backgroundColor: "#E5EEFF", alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    overflow: "hidden",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: "#86F4C8",
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 14,
    color: "#00513B",
  },
  badgeUrgent: { backgroundColor: "#FFDAD6", color: "#93000A" },
  body: { padding: 10, gap: 3 },
  title: { fontFamily: fonts.displaySemiBold, fontSize: 14, lineHeight: 19, color: "#0B1C2E" },
  row: { flexDirection: "row", alignItems: "center", gap: 3 },
  area: { flex: 1, fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: "#0B1C2E" },
  meta: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: "#3F4945" },
});

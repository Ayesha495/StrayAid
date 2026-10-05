import { Image } from "expo-image";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { StoryGroup } from "../../services/homeService";
import { colors, fonts } from "../../theme/tokens";

// Stitch screen 2: highlight-style story circles grouped by category.

type Props = {
  groups: StoryGroup[];
  onOpen: (group: StoryGroup) => void;
};

export default function StoriesRow({ groups, onOpen }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      accessibilityLabel="Stories"
    >
      {groups.map((group) => {
        const cover = group.stories[0]?.image;
        return (
          <Pressable
            key={group.category}
            accessibilityRole="button"
            accessibilityLabel={`${group.label} stories, ${group.stories.length} new`}
            onPress={() => onOpen(group)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
          >
            <View style={styles.ring}>
              <View style={styles.photoFrame}>
                {cover ? (
                  <Image source={{ uri: cover }} style={styles.photo} contentFit="cover" transition={150} />
                ) : (
                  <View style={[styles.photo, styles.photoFallback]} />
                )}
              </View>
            </View>
            <Text style={styles.label} numberOfLines={1}>
              {group.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const PHOTO = 58;

const styles = StyleSheet.create({
  row: { paddingHorizontal: 20, gap: 14, paddingBottom: 4 },
  item: { alignItems: "center", width: 68, gap: 6 },
  pressed: { transform: [{ scale: 0.96 }] },
  ring: {
    padding: 2.5,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  photoFrame: {
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.surface,
    overflow: "hidden",
  },
  photo: { width: PHOTO, height: PHOTO, borderRadius: PHOTO / 2 },
  photoFallback: { backgroundColor: "#F1F5F9" },
  label: {
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: -0.1,
    color: colors.ink,
    textAlign: "center",
    maxWidth: 68,
  },
});

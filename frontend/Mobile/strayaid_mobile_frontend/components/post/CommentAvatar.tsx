import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";

import type { CommentAuthor } from "../../services/postService";
import { colors, fonts } from "../../theme/tokens";

// Round avatar for a comment: the photo if there is one, the organization's paw, or initials
// on one of the design's soft tints.

const TINTS = [
  { bg: "#DBE9FF", fg: "#00523F" },
  { bg: "#86F4C8", fg: "#007153" },
  { bg: "#89F7CB", fg: "#002116" },
];

export default function CommentAvatar({ author, size = 36 }: { author: CommentAuthor; size?: number }) {
  const tint = TINTS[author.id % TINTS.length];
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (author.avatar) return <Image source={{ uri: author.avatar }} style={box} contentFit="cover" />;
  if (author.is_organization) {
    return (
      <View style={[box, styles.center, { backgroundColor: colors.primary }]}>
        <MaterialIcons name="pets" size={size * 0.45} color={colors.onPrimary} />
      </View>
    );
  }
  return (
    <View style={[box, styles.center, { backgroundColor: tint.bg }]}>
      <Text style={[styles.initials, { color: tint.fg, fontSize: size * 0.36 }]}>{author.initials}</Text>
    </View>
  );
}

// "Author", "Donor"... next to a commenter's name.
export function AuthorBadge({ badge }: { badge: string }) {
  if (!badge) return null;
  const author = badge === "Author";
  return (
    <Text style={[styles.badge, author ? styles.badgeAuthor : badge === "Donor" ? styles.badgeDonor : styles.badgeMint]}>
      {badge}
    </Text>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  initials: { fontFamily: fonts.bodyBold },
  badge: {
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    fontFamily: fonts.bodyBold,
    fontSize: 10,
    lineHeight: 14,
  },
  badgeMint: { backgroundColor: "#86F4C8", color: "#007153" },
  badgeDonor: { backgroundColor: "#FFDAD5", color: "#82271D" },
  badgeAuthor: { backgroundColor: "#E5EEFF", color: "#00523F" },
});

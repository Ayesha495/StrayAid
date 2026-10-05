import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { FeedPost } from "../../services/homeService";
import { colors, fonts, type } from "../../theme/tokens";
import { compactCount, timeAgo } from "../../utils/format";

// Stitch screen 2: community post card.

// Public wording for the rescued animal's status, shown on the photo.
const ANIMAL_STATUS_LABELS: Record<string, string> = {
  rescued: "Rescued",
  recovering: "Under Treatment",
  adoptable: "Ready for Adoption",
  adopted: "Adopted",
};

type Props = {
  post: FeedPost;
  onLike: () => void;
  onComment: () => void;
  onShare: () => void;
  onMore: () => void;
  onOpenAnimal: () => void;
  onOpenOrganization: () => void;
};

export default function PostCard({ post, onLike, onComment, onShare, onMore, onOpenAnimal, onOpenOrganization }: Props) {
  const organization = post.organization;
  const statusLabel = ANIMAL_STATUS_LABELS[post.animal?.status] ?? null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${organization.name}, open profile`}
            onPress={onOpenOrganization}
            style={styles.author}
          >
            <View>
              {organization.image ? (
                <Image source={{ uri: organization.image }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Text style={styles.avatarInitial}>{organization.name.charAt(0)}</Text>
                </View>
              )}
              {organization.is_verified && (
                <View style={styles.verified} accessibilityLabel="Verified organization">
                  <MaterialIcons name="check" size={10} color={colors.onPrimary} />
                </View>
              )}
            </View>
            <View style={styles.authorText}>
              <Text style={styles.orgName} numberOfLines={1}>
                {organization.name}
              </Text>
              <Text style={styles.meta}>
                {[organization.city, timeAgo(post.created_at)].filter(Boolean).join("  •  ")}
              </Text>
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="More options" onPress={onMore} hitSlop={10}>
            <MaterialIcons name="more-vert" size={20} color="#94A3B8" />
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={`Open ${post.animal?.name ?? "animal"}'s profile`} onPress={onOpenAnimal}>
          <Text style={styles.content}>{post.content}</Text>
          {post.image && (
            <View style={styles.media}>
              <Image source={{ uri: post.image }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
              {statusLabel && (
                <View style={styles.statusChip}>
                  <View style={styles.statusDot} />
                  <Text style={styles.statusText}>{statusLabel}</Text>
                </View>
              )}
            </View>
          )}
        </Pressable>

        <View style={styles.actions}>
          <View style={styles.actionGroup}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${post.liked_by_me ? "Unlike" : "Like"}, ${post.like_count} likes`}
              accessibilityState={{ selected: post.liked_by_me }}
              onPress={onLike}
              hitSlop={8}
              style={styles.action}
            >
              <MaterialIcons
                name={post.liked_by_me ? "favorite" : "favorite-border"}
                size={18}
                color={post.liked_by_me ? colors.critical : colors.ink}
              />
              <Text style={styles.count}>{compactCount(post.like_count)}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Comments, ${post.comment_count}`}
              onPress={onComment}
              hitSlop={8}
              style={styles.action}
            >
              <MaterialIcons name="chat-bubble-outline" size={17} color={colors.ink} />
              <Text style={styles.count}>{compactCount(post.comment_count)}</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Share post" onPress={onShare} hitSlop={8}>
            <MaterialIcons name="share" size={18} color={colors.ink} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { paddingHorizontal: 16, paddingVertical: 8 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F1F5F9",
    overflow: "hidden",
    shadowColor: colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 1,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14 },
  author: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: "#F1F5F9" },
  avatarFallback: { backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.primary },
  verified: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.surface,
  },
  authorText: { flex: 1, minWidth: 0 },
  orgName: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 18, color: colors.ink },
  meta: { fontFamily: fonts.body, fontSize: 11, lineHeight: 15, color: colors.inkMuted, marginTop: 2 },
  content: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 21,
    color: "#334155",
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  media: { height: 224, backgroundColor: "#F1F5F9" },
  statusChip: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(36,52,71,0.7)",
  },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.secondary },
  statusText: { fontFamily: fonts.bodyMedium, fontSize: 11, lineHeight: 14, color: colors.onPrimary },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#F8FAFC",
  },
  actionGroup: { flexDirection: "row", alignItems: "center", gap: 16 },
  action: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 24 },
  count: { ...type.labelMd, color: colors.ink },
});

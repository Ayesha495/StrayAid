import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { getPublicAnimals, getPublicFeed } from "../../../services/authService";

type Organization = {
  id: number;
  name: string;
};

type Animal = {
  id: number;
  name: string;
  status: string;
  image: string | null;
  organization: Organization;
};

type Post = {
  id: number;
  title: string;
  content: string;
  image: string | null;
  animal: Animal;
  organization: Organization;
};

const palette = {
  white: "#ffffff",
  soft: "#f7faf9",
  teal: "#0f766e",
  amber: "#d97706",
  ink: "#172033",
  muted: "#6e6458",
  border: "#e7efed",
};

export default function FeedPage() {
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadFeed = useCallback(async () => {
    const [animalData, feedData] = await Promise.all([getPublicAnimals(), getPublicFeed()]);
    setAnimals(animalData);
    setPosts(feedData);
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadFeed()
        .catch(() => {
          setAnimals([]);
          setPosts([]);
        })
        .finally(() => setIsLoading(false));
    }, [loadFeed])
  );

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await loadFeed();
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={palette.teal} />}
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>StrayAid Feed</Text>
            <Text style={styles.title}>Follow rescue updates and adoptable animals.</Text>
          </View>
          <Pressable style={styles.reportButton} onPress={() => router.push("../home")}>
            <Text style={styles.reportButtonText}>Submit Report</Text>
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={palette.teal} />
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Public Animal Profiles</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.animalRow}>
                {animals.map((animal) => (
                  <View key={animal.id} style={styles.animalCard}>
                    {animal.image ? <Image source={{ uri: animal.image }} style={styles.animalImage} /> : <View style={styles.animalFallback} />}
                    <Text style={styles.badge}>{animal.status}</Text>
                    <Text style={styles.cardTitle}>{animal.name}</Text>
                    <Text style={styles.cardMeta}>{animal.organization.name}</Text>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Latest Updates</Text>
              <View style={styles.feedList}>
                {posts.map((post) => (
                  <View key={post.id} style={styles.feedCard}>
                    <Text style={styles.feedOrg}>{post.organization.name}</Text>
                    {post.image ? (
                      <Image source={{ uri: post.image }} style={styles.feedImage} />
                    ) : post.animal.image ? (
                      <Image source={{ uri: post.animal.image }} style={styles.feedImage} />
                    ) : null}
                    <Text style={styles.feedTitle}>{post.title}</Text>
                    <Text style={styles.feedText}>{post.content}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.white,
  },
  container: {
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 22,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 14,
  },
  headerText: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: palette.amber,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  title: {
    color: palette.ink,
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "800",
  },
  reportButton: {
    backgroundColor: palette.teal,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  reportButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  loadingCard: {
    backgroundColor: palette.soft,
    borderRadius: 24,
    padding: 28,
    alignItems: "center",
  },
  section: {
    gap: 14,
  },
  sectionTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "700",
  },
  animalRow: {
    gap: 14,
    paddingRight: 20,
  },
  animalCard: {
    width: 220,
    backgroundColor: palette.soft,
    borderRadius: 24,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  animalImage: {
    width: "100%",
    height: 140,
    borderRadius: 18,
  },
  animalFallback: {
    width: "100%",
    height: 140,
    borderRadius: 18,
    backgroundColor: "#dce9e6",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: "#fff3df",
    color: palette.amber,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    overflow: "hidden",
    fontSize: 12,
    fontWeight: "700",
  },
  cardTitle: {
    color: palette.ink,
    fontSize: 18,
    fontWeight: "700",
  },
  cardMeta: {
    color: palette.muted,
    fontSize: 14,
  },
  feedList: {
    gap: 14,
  },
  feedCard: {
    backgroundColor: palette.soft,
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: palette.border,
  },
  feedOrg: {
    color: palette.teal,
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  feedImage: {
    width: "100%",
    height: 190,
    borderRadius: 18,
  },
  feedTitle: {
    color: palette.ink,
    fontSize: 20,
    fontWeight: "700",
  },
  feedText: {
    color: palette.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});

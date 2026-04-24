import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { router, type Href } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { feedStyles as styles } from "../../../styles/FeedStyles";
import { getPublicAnimals, getPublicFeed, type MobileAnimal, type MobilePost } from "../../../services/mobileContentService";

function AnimatedCard({ children, index }: { children: React.ReactNode; index: number }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(18)).current;

  useEffect(() => {
    // Stagger cards slightly so the feed feels less abrupt on load.
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 320, delay: index * 70, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 320, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, translateY]);

  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

export default function FeedPage() {
  const [posts, setPosts] = useState<MobilePost[]>([]);
  const [animals, setAnimals] = useState<MobileAnimal[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sponsorAnimal, setSponsorAnimal] = useState<MobileAnimal | null>(null);

  const load = async () => {
    // The feed mixes organization posts with public animal profiles.
    const [postsData, animalsData] = await Promise.all([getPublicFeed(), getPublicAnimals()]);
    setPosts(postsData);
    setAnimals(animalsData);
  };

  useEffect(() => {
    load().catch(console.error);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <View style={styles.topBar}>
            <Text style={styles.pageTitle}>Feed</Text>
          </View>

          <AnimatedCard index={0}>
            <View style={styles.heroCard}>
              <View style={styles.heroIconWrap}>
                <Ionicons name="camera-outline" size={34} color="#ffffff" />
              </View>
              <Text style={styles.heroTitle}>See Something? Report It.</Text>
              <Text style={styles.heroText}>
                Add a photo, pin the location, and send a report to the rescue network so help can start moving faster.
              </Text>
              <Pressable style={styles.heroButton} onPress={() => router.push("/(tabs)/report" as Href)}>
                <Text style={styles.heroButtonText}>Make Report</Text>
              </Pressable>
            </View>
          </AnimatedCard>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Animals In Care</Text>
            <Text style={styles.sectionText}>Public animal profiles from rescue organizations.</Text>
          </View>

          {animals.length ? animals.map((animal, index) => (
            <AnimatedCard key={animal.id} index={index + 1}>
              <Pressable style={styles.animalCard} onPress={() => router.push(`/animals/${animal.id}` as Href)}>
                {animal.image ? <Image source={{ uri: animal.image }} style={styles.animalImage} /> : null}
                <View style={styles.badge}><Text style={styles.badgeText}>{animal.status}</Text></View>
                <Text style={styles.cardTitle}>{animal.name}</Text>
                <Pressable onPress={() => router.push(`/organizations/${animal.organization.id}` as Href)}>
                  <Text style={styles.linkText}>{animal.organization.name}</Text>
                </Pressable>
                <Text style={styles.cardText}>{animal.description || "This animal profile does not have a public description yet."}</Text>
              </Pressable>
            </AnimatedCard>
          )) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No public animal profiles yet.</Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Latest Updates</Text>
            <Text style={styles.sectionText}>Stories and progress updates from the organizations.</Text>
          </View>

          {posts.length ? posts.map((post, index) => (
            <AnimatedCard key={post.id} index={index + animals.length + 1}>
              <View style={styles.postCard}>
                <View style={styles.postTopRow}>
                  <Pressable style={styles.orgChip} onPress={() => router.push(`/organizations/${post.organization.id}` as Href)}>
                    <Text style={styles.orgChipText}>{post.organization.name}</Text>
                  </Pressable>
                  {/* Donation details are shown inline so the user can stay in the feed. */}
                  <Pressable style={styles.sponsorButton} onPress={() => setSponsorAnimal(post.animal)}>
                    <Text style={styles.sponsorButtonText}>Donation Info</Text>
                  </Pressable>
                </View>
                {(post.image || post.animal.image) ? (
                  <Image source={{ uri: post.image || post.animal.image || undefined }} style={styles.postImage} />
                ) : null}
                <Text style={styles.cardTitle}>{post.title}</Text>
                <Pressable onPress={() => router.push(`/animals/${post.animal.id}` as Href)}>
                  <Text style={styles.linkText}>{post.animal.name}</Text>
                </Pressable>
                <Text style={styles.metaText}>{new Date(post.created_at).toLocaleDateString()}</Text>
                <Text style={styles.cardText}>{post.content}</Text>
              </View>
            </AnimatedCard>
          )) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No public updates yet.</Text>
            </View>
          )}
        </ScrollView>
      </View>
      <Modal visible={Boolean(sponsorAnimal)} transparent animationType="fade" onRequestClose={() => setSponsorAnimal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSponsorAnimal(null)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalEyebrow}>Donation Information</Text>
            <Text style={styles.modalTitle}>{sponsorAnimal?.name}</Text>
            <Text style={styles.modalText}>
              {sponsorAnimal?.donation_info || "This organization has not shared donation information for this animal yet."}
            </Text>
            <Pressable style={styles.modalClose} onPress={() => setSponsorAnimal(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

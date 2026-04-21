import { useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { animalDetailStyles as styles } from "../../styles/AnimalDetailStyles";
import {
  getAnimal,
  getAnimalPosts,
  type MobileAnimal,
  type MobilePost,
} from "../../services/mobileContentService";

export default function AnimalDetailPage() {
  const { animalId } = useLocalSearchParams<{ animalId: string }>();
  const [animal, setAnimal] = useState<MobileAnimal | null>(null);
  const [posts, setPosts] = useState<MobilePost[]>([]);
  const [showSponsor, setShowSponsor] = useState(false);

  useEffect(() => {
    if (!animalId) {
      return;
    }

    Promise.all([getAnimal(animalId), getAnimalPosts(animalId)])
      .then(([animalData, postData]) => {
        setAnimal(animalData);
        setPosts(postData);
      })
      .catch(console.error);
  }, [animalId]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable style={styles.topBarButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#12344a" />
          </Pressable>
          <Text style={styles.pageTitle}>Animal Profile</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.heroCard}>
          {animal?.image ? <Image source={{ uri: animal.image }} style={styles.image} /> : null}
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{animal?.status || "loading"}</Text>
          </View>
          <Text style={styles.title}>{animal?.name || "Loading animal..."}</Text>
          <View style={styles.subtitleRow}>
            {animal?.organization ? (
              <Pressable onPress={() => router.push(`/organizations/${animal.organization.id}`)}>
                <Text style={styles.linkText}>{animal.organization.name}</Text>
              </Pressable>
            ) : null}
            {animal?.breed ? <Text style={styles.subtitle}>{animal.breed}</Text> : null}
          </View>
          <Text style={styles.bodyText}>
            {animal?.description || "No public description has been added for this animal yet."}
          </Text>
          <Pressable style={styles.sponsorButton} onPress={() => setShowSponsor(true)}>
            <Text style={styles.sponsorButtonText}>View Donation Information</Text>
          </Pressable>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Care Information</Text>
          <Text style={styles.bodyText}>
            {animal?.medical_info || "No medical or recovery notes have been shared yet."}
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Updates</Text>
          {posts.length ? (
            posts.map((post) => (
              <View key={post.id} style={styles.updateCard}>
                {post.image ? <Image source={{ uri: post.image }} style={styles.updateImage} /> : null}
                <Text style={styles.title}>{post.title}</Text>
                <Text style={styles.metaText}>{new Date(post.created_at).toLocaleDateString()}</Text>
                <Text style={styles.bodyText}>{post.content}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.bodyText}>No public updates have been posted for this animal yet.</Text>
          )}
        </View>
      </ScrollView>

      <Modal visible={showSponsor} transparent animationType="fade" onRequestClose={() => setShowSponsor(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSponsor(false)}>
          <Pressable style={styles.modalCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.modalEyebrow}>Donation Information</Text>
            <Text style={styles.modalTitle}>{animal?.name || "Animal"}</Text>
            <Text style={styles.modalText}>
              {animal?.donation_info || "This organization has not shared donation information for this animal yet."}
            </Text>
            <Pressable style={styles.modalClose} onPress={() => setShowSponsor(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

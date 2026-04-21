import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getOrganization, getOrganizationAnimals, type MobileAnimal, type MobileOrganization } from "../../services/mobileContentService";
import { organizationStyles as styles } from "../../styles/OrganizationStyles";

export default function OrganizationProfilePage() {
  const { organizationId } = useLocalSearchParams<{ organizationId: string }>();
  const [organization, setOrganization] = useState<MobileOrganization | null>(null);
  const [animals, setAnimals] = useState<MobileAnimal[]>([]);

  useEffect(() => {
    if (!organizationId) {
      return;
    }

    Promise.all([getOrganization(organizationId), getOrganizationAnimals(organizationId)])
      .then(([organizationData, animalData]) => {
        setOrganization(organizationData);
        setAnimals(animalData);
      })
      .catch(console.error);
  }, [organizationId]);

  const donationDetails = [
    organization?.bank_account_title ? `Account Title: ${organization.bank_account_title}` : null,
    organization?.bank_account_number ? `Account Number or Wallet ID: ${organization.bank_account_number}` : null,
  ].filter(Boolean);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Pressable style={styles.topBarButton} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#12344a" />
          </Pressable>
          <Text style={styles.pageTitle}>Organization</Text>
          <View style={styles.topBarSpacer} />
        </View>

        <View style={styles.card}>
          {organization?.image ? <Image source={{ uri: organization.image }} style={styles.heroImage} /> : null}
          <Text style={styles.title}>{organization?.name || "Loading organization..."}</Text>
          <Text style={styles.subtitle}>{organization?.city || organization?.address || "Public rescue organization profile"}</Text>
          <Text style={styles.bodyText}>{organization?.description || "This organization has not added a public description yet."}</Text>
          <View style={styles.infoGrid}>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Contact Email</Text>
              <Text style={styles.bodyText}>{organization?.contact_email || organization?.user_email || "Not shared publicly"}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Phone</Text>
              <Text style={styles.bodyText}>{organization?.phone_number || "Not shared publicly"}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Address</Text>
              <Text style={styles.bodyText}>{organization?.address || "Address not shared"}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Capacity</Text>
              <Text style={styles.bodyText}>{organization?.capacity ? `${organization.capacity} animals` : "Not shared publicly"}</Text>
            </View>
            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>Service Radius</Text>
              <Text style={styles.bodyText}>{organization?.radius ? `${organization.radius} km` : "Not shared publicly"}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Animals In Their Care</Text>
          {animals.length ? animals.map((animal) => (
            <View key={animal.id} style={styles.animalCard}>
              {animal.image ? <Image source={{ uri: animal.image }} style={styles.animalImage} /> : null}
              <View style={styles.badge}><Text style={styles.badgeText}>{animal.status}</Text></View>
              <Text style={styles.animalTitle}>{animal.name}</Text>
              <Text style={styles.animalText}>{animal.description || "No public description has been shared yet."}</Text>
              <Pressable style={styles.actionButton} onPress={() => router.push(`/animals/${animal.id}`)}>
                <Text style={styles.actionButtonText}>View Animal</Text>
              </Pressable>
            </View>
          )) : <Text style={styles.bodyText}>No animal profiles are available yet.</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Donation Information</Text>
          <Text style={styles.bodyText}>
            {donationDetails.length ? donationDetails.join(" | ") : "This organization has not shared donation information yet."}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

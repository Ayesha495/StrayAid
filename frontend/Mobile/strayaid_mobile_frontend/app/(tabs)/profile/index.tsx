import { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { profileStyles as styles } from "../../../styles/ProfileStyles";
import { getCurrentUser, getMyReports, type MobileCase, type MobileUser } from "../../../services/mobileContentService";
import { logoutUser } from "../../../services/authService";

export default function ProfilePage() {
  const [reports, setReports] = useState<MobileCase[]>([]);
  const [user, setUser] = useState<MobileUser | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(console.error);
    getMyReports().then(setReports).catch(console.error);
  }, []);

  const handleLogout = async () => {
    await logoutUser();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Profile</Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {(user?.username || user?.email || "U").slice(0, 1).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.profileTitle}>{user?.username || "Public User"}</Text>
              <Text style={styles.profileSubtitle}>
                Manage your account details and review the rescue reports submitted from this phone.
              </Text>
            </View>
          </View>

          <View style={styles.infoGrid}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Username</Text>
              <Text style={styles.infoValue}>{user?.username || "Not available"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email</Text>
              <Text style={styles.infoValue}>{user?.email || "Not available"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Role</Text>
              <Text style={styles.infoValue}>{user?.role || "public"}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Reports Submitted</Text>
              <Text style={styles.infoValue}>{reports.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>My Reports</Text>
          <Text style={styles.sectionText}>Every case you have submitted or contributed to appears here.</Text>
          {reports.length ? reports.map((item) => (
            <View key={item.id} style={styles.reportCard}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.status}</Text>
              </View>
              <Text style={styles.reportTitle}>Case #{item.id}</Text>
              <Text style={styles.sectionText}>{item.description || "No description provided."}</Text>
              <Text style={styles.metaText}>{item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}</Text>
              <Text style={styles.metaText}>
                {item.reports.length} report{item.reports.length === 1 ? "" : "s"} attached
              </Text>
            </View>
          )) : <Text style={styles.emptyText}>You have not submitted any reports yet.</Text>}
        </View>

        <Pressable
          style={styles.logoutButton}
          onPress={() => {
            Alert.alert("Log out", "You will return to the login flow.", [
              { text: "Cancel", style: "cancel" },
              { text: "Log out", style: "destructive", onPress: handleLogout },
            ]);
          }}
        >
          <Text style={styles.logoutButtonText}>Logout</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

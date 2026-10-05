import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { LEGAL_DOCS } from "../../constants/legal";
import { colors, fonts } from "../../theme/tokens";

// Terms of Service / Privacy Policy, opened from the sign-up screen (Stitch 6 footer links).

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const content = LEGAL_DOCS[doc === "privacy" ? "privacy" : "terms"];

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/home"));

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={goBack}
          hitSlop={8}
          style={({ pressed }) => [styles.back, pressed && styles.backPressed]}
        >
          <MaterialIcons name="chevron-left" size={28} color={colors.ink} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title} accessibilityRole="header">
          {content.title}
        </Text>
        <Text style={styles.updated}>Last updated {content.updated}</Text>

        {content.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  bar: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
  back: { width: 32, height: 32, borderRadius: 16, marginLeft: -10, alignItems: "center", justifyContent: "center" },
  backPressed: { backgroundColor: "#F3F4F6" },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  title: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32, letterSpacing: -0.5, color: colors.ink },
  updated: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.inkMuted, marginTop: 4 },
  section: { marginTop: 24, gap: 6 },
  heading: { fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: "#4B5563" },
});

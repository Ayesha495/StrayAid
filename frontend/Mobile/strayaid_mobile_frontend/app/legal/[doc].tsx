import { MaterialIcons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandBadge } from "../../components/brand/BrandHeader";
import { LEGAL_DOCS, LegalDocKey, POLICY_ORDER } from "../../constants/legal";
import { SITE } from "../../constants/site";
import { colors, fonts } from "../../theme/tokens";

// The policies (sign-up links, Profile → Settings) and the volunteer guidelines (Profile).

const isLegalDoc = (key: string | undefined): key is LegalDocKey => Boolean(key && key in LEGAL_DOCS);

export default function LegalScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const key: LegalDocKey = isLegalDoc(doc) ? doc : "terms";
  const content = LEGAL_DOCS[key];

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
        <View style={styles.logo}>
          <BrandBadge size={52} />
        </View>
        <Text style={styles.title} accessibilityRole="header">
          {content.title}
        </Text>
        <Text style={styles.updated}>Last updated {content.updated}</Text>
        <Text style={styles.summary}>{content.summary}</Text>

        {content.sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.heading} accessibilityRole="header">
              {section.heading}
            </Text>
            <Text style={styles.body}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.contact}>
          <Text style={styles.heading} accessibilityRole="header">
            Contact
          </Text>
          <Text style={styles.body}>
            {SITE.name} is run by {SITE.operator}. {SITE.about}
            {SITE.contactEmail ? ` Email ${SITE.contactEmail} with any question about this policy.` : ""}
          </Text>
        </View>

        <View style={styles.others}>
          <Text style={styles.othersTitle}>All policies</Text>
          {POLICY_ORDER.filter((other) => other !== key).map((other) => (
            <Pressable
              key={other}
              accessibilityRole="link"
              accessibilityLabel={LEGAL_DOCS[other].title}
              onPress={() => router.replace({ pathname: "/legal/[doc]", params: { doc: other } })}
              style={({ pressed }) => [styles.otherRow, pressed && styles.backPressed]}
            >
              <Text style={styles.otherText}>{LEGAL_DOCS[other].title}</Text>
              <MaterialIcons name="chevron-right" size={20} color={colors.inkMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.surface },
  bar: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4 },
  back: { width: 44, height: 44, borderRadius: 22, marginLeft: -12, alignItems: "center", justifyContent: "center" },
  backPressed: { backgroundColor: "#F3F4F6" },
  content: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40 },
  logo: { marginBottom: 14 },
  title: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 32, letterSpacing: -0.5, color: colors.ink },
  updated: { fontFamily: fonts.bodyMedium, fontSize: 13, lineHeight: 18, color: colors.inkMuted, marginTop: 4 },
  summary: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 22, color: colors.ink, marginTop: 12 },
  section: { marginTop: 24, gap: 6 },
  heading: { fontFamily: fonts.displayBold, fontSize: 16, lineHeight: 22, color: colors.ink },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 22, color: "#4B5563" },
  contact: { marginTop: 28, padding: 16, borderRadius: 16, backgroundColor: colors.mint, gap: 6 },
  others: { marginTop: 28 },
  othersTitle: { fontFamily: fonts.bodySemiBold, fontSize: 13, letterSpacing: 0.3, color: colors.inkMuted, marginBottom: 4 },
  otherRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  otherText: { fontFamily: fonts.bodySemiBold, fontSize: 15, color: colors.ink },
});

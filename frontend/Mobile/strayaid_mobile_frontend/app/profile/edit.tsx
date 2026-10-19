import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { getProfile, Profile, ProfileError, updateProfile } from "../../services/profileService";
import { colors, fonts } from "../../theme/tokens";
import { pickPhoto, PickedPhoto } from "../../utils/pickPhoto";

// Edit Profile, opened from the Profile screen: photo, name, area and emergency phone.

const C = { surface: "#F8F9FF", low: "#EEF4FF", primary: "#00523F", ink: "#0B1C2E", soft: "#3F4945", outline: "#6F7974" };

type Form = { first_name: string; last_name: string; area: string; phone: string };

export default function EditProfileScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Form>({ first_name: "", last_name: "", area: "", phone: "" });
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getProfile()
      .then((me) => {
        setProfile(me);
        setForm({ first_name: me.first_name, last_name: me.last_name, area: me.area, phone: me.phone });
      })
      .catch(() => router.back());
  }, []);

  const set = (key: keyof Form) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: "" }));
  };

  const goBack = () => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"));

  const save = async () => {
    if (!form.first_name.trim()) {
      setErrors({ first_name: "Enter your first name." });
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        area: form.area.trim(),
        phone: form.phone.trim(),
        ...(photo ? { avatar: photo } : {}),
      });
      goBack();
    } catch (err) {
      if (err instanceof ProfileError && Object.keys(err.fields).length) setErrors(err.fields);
      else Alert.alert("Couldn't save", err instanceof Error ? err.message : "Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return (
      <SafeAreaView style={[styles.screen, styles.centered]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const avatar = photo?.uri ?? profile.avatar;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.back}>
          <MaterialIcons name="arrow-back-ios-new" size={22} color={C.ink} />
        </Pressable>
        <Text style={styles.title} accessibilityRole="header">
          Edit Profile
        </Text>
        <View style={styles.back} />
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change profile photo"
            onPress={async () => setPhoto((await pickPhoto("library", "choose a profile photo")) ?? photo)}
            style={styles.photoWrap}
          >
            <View style={styles.photo}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={StyleSheet.absoluteFill} contentFit="cover" />
              ) : (
                <MaterialIcons name="person" size={40} color={C.primary} />
              )}
            </View>
            <View style={styles.photoBadge}>
              <MaterialIcons name="photo-camera" size={16} color={colors.onPrimary} />
            </View>
            <Text style={styles.photoText}>Change photo</Text>
          </Pressable>

          <Field label="First name" value={form.first_name} onChange={set("first_name")} error={errors.first_name} autoComplete="given-name" />
          <Field label="Last name" value={form.last_name} onChange={set("last_name")} error={errors.last_name} autoComplete="family-name" />
          <Field
            label="Area"
            value={form.area}
            onChange={set("area")}
            error={errors.area}
            placeholder="e.g. G-11, Islamabad"
            hint="Shown on your profile instead of your address."
          />
          <Field
            label="Emergency phone"
            value={form.phone}
            onChange={set("phone")}
            error={errors.phone}
            placeholder="+92 300 1234567"
            keyboardType="phone-pad"
            autoComplete="tel"
            hint="Only rescue teams see it, when they call you about a case near you."
          />
        </ScrollView>
        <View style={styles.footer}>
          <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={({ pressed }) => [styles.save, pressed && styles.savePressed]}>
            {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={styles.saveText}>Save changes</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  hint,
  placeholder,
  keyboardType,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  placeholder?: string;
  keyboardType?: "phone-pad";
  autoComplete?: "given-name" | "family-name" | "tel";
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.outline}
        keyboardType={keyboardType}
        autoComplete={autoComplete}
        style={[styles.input, !!error && styles.inputError]}
        accessibilityLabel={label}
      />
      {!!error ? <Text style={styles.error}>{error}</Text> : !!hint && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.surface },
  flex: { flex: 1 },
  centered: { alignItems: "center", justifyContent: "center" },
  header: { height: 64, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.displaySemiBold, fontSize: 18, color: C.ink },
  scroll: { padding: 16, gap: 16 },
  photoWrap: { alignItems: "center", gap: 8, marginBottom: 8 },
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: "hidden",
    backgroundColor: "#E5EEFF",
    alignItems: "center",
    justifyContent: "center",
  },
  photoBadge: {
    position: "absolute",
    top: 66,
    left: "54%",
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: C.surface,
    backgroundColor: C.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  photoText: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: C.primary },
  field: { gap: 6 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: C.ink },
  input: {
    height: 48,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#DBE4F0",
    backgroundColor: colors.surface,
    fontFamily: fonts.body,
    fontSize: 15,
    color: C.ink,
  },
  inputError: { borderColor: colors.critical },
  error: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.critical },
  hint: { fontFamily: fonts.body, fontSize: 12, color: C.outline },
  footer: { padding: 16 },
  save: { height: 52, borderRadius: 999, backgroundColor: C.primary, alignItems: "center", justifyContent: "center" },
  savePressed: { backgroundColor: "#003D2F" },
  saveText: { fontFamily: fonts.displayBold, fontSize: 16, color: colors.onPrimary },
});

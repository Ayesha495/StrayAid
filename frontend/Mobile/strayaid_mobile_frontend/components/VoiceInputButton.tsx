import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text } from "react-native";
import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { mobileTheme as theme } from "../styles/mobileTheme";
import { colors, fonts } from "../theme/tokens";

// Loaded lazily: the native module only exists in a development/production build,
// so importing it directly would crash the screen inside Expo Go.
let speech: typeof import("expo-speech-recognition") | null = null;
try {
  speech = require("expo-speech-recognition");
} catch {
  speech = null;
}

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  lang?: string;
  // "pill": the small white "Voice" button inside the report description box (Stitch 8).
  variant?: "icon" | "pill";
};

const joinText = (base: string, spoken: string) => {
  const trimmedBase = base.trimEnd();
  const trimmedSpoken = spoken.trim();
  if (!trimmedSpoken) return base;
  return trimmedBase ? `${trimmedBase} ${trimmedSpoken}` : trimmedSpoken;
};

export default function VoiceInputButton({ value, onChangeText, lang = "en-US", variant = "icon" }: Props) {
  const [listening, setListening] = useState(false);
  const [starting, setStarting] = useState(false);
  // Text that was already in the box when recording started; speech is appended to it.
  const baseTextRef = useRef(value);
  const onChangeRef = useRef(onChangeText);
  onChangeRef.current = onChangeText;

  useEffect(() => {
    if (!speech) return;
    const module = speech.ExpoSpeechRecognitionModule;

    const subscriptions = [
      module.addListener("start", () => {
        setStarting(false);
        setListening(true);
      }),
      module.addListener("end", () => {
        setStarting(false);
        setListening(false);
      }),
      module.addListener("result", (event) => {
        const transcript = event.results[0]?.transcript ?? "";
        const combined = joinText(baseTextRef.current, transcript);
        onChangeRef.current(combined);
        if (event.isFinal) baseTextRef.current = combined;
      }),
      module.addListener("error", (event) => {
        setStarting(false);
        setListening(false);
        // "no-speech" / "aborted" just mean the user stayed silent or cancelled.
        if (event.error === "no-speech" || event.error === "aborted") return;
        Alert.alert("Voice input error", event.message || "Speech recognition failed.");
      }),
    ];

    return () => {
      subscriptions.forEach((subscription) => subscription.remove());
      module.abort();
    };
  }, []);

  const toggleListening = async () => {
    if (!speech) {
      Alert.alert(
        "Voice input unavailable",
        "Voice input needs the StrayAid development build. It is not available in Expo Go."
      );
      return;
    }
    const module = speech.ExpoSpeechRecognitionModule;

    if (listening || starting) {
      module.stop();
      return;
    }

    if (!module.isRecognitionAvailable()) {
      Alert.alert("Voice input unavailable", "Speech recognition is not available on this device.");
      return;
    }

    const permission = await module.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission required", "Microphone access is needed to dictate the description.");
      return;
    }

    baseTextRef.current = value;
    setStarting(true);
    module.start({
      lang,
      interimResults: true,
      continuous: false,
      addsPunctuation: true,
    });
  };

  if (variant === "pill") {
    return (
      <Pressable
        style={({ pressed }) => [styles.pill, listening && styles.pillActive, pressed && styles.pillPressed]}
        onPress={toggleListening}
        accessibilityRole="button"
        accessibilityLabel={listening ? "Stop voice input" : "Start voice input"}
        hitSlop={4}
      >
        {starting ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <MaterialIcons name={listening ? "stop" : "mic"} size={14} color={listening ? colors.onPrimary : colors.primary} />
        )}
        <Text style={[styles.pillText, listening && styles.pillTextActive]}>{listening ? "Stop" : "Voice"}</Text>
      </Pressable>
    );
  }

  return (
    <Pressable
      style={[styles.micButton, listening && styles.micButtonActive]}
      onPress={toggleListening}
      accessibilityRole="button"
      accessibilityLabel={listening ? "Stop voice input" : "Start voice input"}
    >
      {starting ? (
        <ActivityIndicator color={theme.colors.primaryDeep} />
      ) : (
        <Ionicons
          name={listening ? "stop" : "mic-outline"}
          size={24}
          color={listening ? theme.colors.surface : theme.colors.primaryDeep}
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  micButton: {
    width: 54,
    height: 54,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  micButtonActive: { backgroundColor: theme.colors.danger },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: colors.surface,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  pillActive: { backgroundColor: colors.critical, borderColor: colors.critical },
  pillPressed: { backgroundColor: "#F8FAFC" },
  pillText: { fontFamily: fonts.bodySemiBold, fontSize: 12, lineHeight: 16, color: "#475569" },
  pillTextActive: { color: colors.onPrimary },
});

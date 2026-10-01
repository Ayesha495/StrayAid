import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { mobileTheme as theme } from "../styles/mobileTheme";

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
};

const joinText = (base: string, spoken: string) => {
  const trimmedBase = base.trimEnd();
  const trimmedSpoken = spoken.trim();
  if (!trimmedSpoken) return base;
  return trimmedBase ? `${trimmedBase} ${trimmedSpoken}` : trimmedSpoken;
};

export default function VoiceInputButton({ value, onChangeText, lang = "en-US" }: Props) {
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
});

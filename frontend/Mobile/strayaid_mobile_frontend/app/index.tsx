import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";

import LogoMark from "../components/brand/Logo";
import { colors, fonts } from "../theme/tokens";

// Stitch screen 1: Splash.
const SPLASH_DURATION_MS = 1800;
const GLOW_SIZE = 240;

export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    // Everyone lands on Home; guests can browse and sign in when they want to act.
    const timer = setTimeout(() => router.replace("/(tabs)/home"), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <Image
        source={require("../assets/images/brand/splash-bg.jpg")}
        style={styles.background}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
      <LinearGradient
        colors={["rgba(0,0,0,0.6)", "rgba(0,0,0,0.35)", "rgba(0,0,0,0.75)"]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.center} accessible accessibilityLabel="StrayAid. Every rescue starts with someone who cares.">
        <Svg width={GLOW_SIZE} height={GLOW_SIZE} style={styles.glow} pointerEvents="none">
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.14} />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#glow)" />
        </Svg>

        <View style={styles.logo}>
          <LogoMark size={80} />
        </View>
        <Text style={styles.wordmark}>StrayAid</Text>
        <Text style={styles.tagline}>Every rescue starts with someone who cares.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.splashBase,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    transform: [{ scale: 1.05 }],
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  glow: {
    // Centred on the whole logo + text block, as in the reference.
    position: "absolute",
  },
  logo: {
    marginBottom: 20,
    // iOS shadows follow the logo's shape; elsewhere a shadow on this transparent box
    // would draw a visible rectangle, so it is iOS-only.
    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
      },
      default: {},
    }),
  },
  wordmark: {
    fontFamily: fonts.displayExtraBold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.9,
    color: colors.onPrimary,
    marginBottom: 10,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  tagline: {
    fontFamily: fonts.body,
    fontSize: 15.5,
    lineHeight: 25,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    maxWidth: 230,
    textShadowColor: "rgba(0,0,0,0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
});

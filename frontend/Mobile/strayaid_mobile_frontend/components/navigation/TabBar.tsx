import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, fonts } from "../../theme/tokens";
import { getToken } from "../../utils/tokenStorage";

// The one bottom tab bar used by every tab screen (Stitch screens 2, 3, 24).

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const TABS: Record<string, { label: string; icon: IconName; activeIcon: IconName; needsAccount: boolean }> = {
  "home/index": { label: "Home", icon: "home-outline", activeIcon: "home", needsAccount: false },
  "explore/index": { label: "Explore", icon: "compass-outline", activeIcon: "compass", needsAccount: false },
  "report-tab/index": { label: "Report", icon: "plus", activeIcon: "plus", needsAccount: true },
  "activity/index": { label: "Activity", icon: "heart-outline", activeIcon: "heart", needsAccount: true },
  "profile/index": { label: "Profile", icon: "account-circle-outline", activeIcon: "account-circle", needsAccount: true },
};

export default function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;
        const isReport = route.name === "report-tab/index";

        const onPress = async () => {
          const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (event.defaultPrevented) return;
          if (tab.needsAccount && !(await getToken())) {
            router.push("/auth-sheet");
            return;
          }
          // Reporting is a full-screen flow over the tabs (Stitch 7-9), not a tab page.
          if (isReport) {
            router.push("/report");
            return;
          }
          if (!focused) navigation.navigate(route.name);
        };

        if (isReport) {
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityLabel="Report an animal"
              onPress={onPress}
              style={styles.item}
            >
              <View style={styles.reportCircle}>
                <MaterialCommunityIcons name="plus" size={26} color={colors.onPrimary} />
              </View>
              <Text style={[styles.label, styles.reportLabel]}>{tab.label}</Text>
            </Pressable>
          );
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={`${tab.label} tab`}
            onPress={onPress}
            style={styles.item}
          >
            <MaterialCommunityIcons
              name={focused ? tab.activeIcon : tab.icon}
              size={24}
              color={focused ? colors.primary : colors.inkMuted}
            />
            <Text style={[styles.label, focused ? styles.labelActive : styles.labelInactive]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 8,
  },
  item: { minWidth: 56, alignItems: "center", justifyContent: "flex-end", gap: 2 },
  label: { fontSize: 10, lineHeight: 13, letterSpacing: -0.1 },
  labelActive: { fontFamily: fonts.bodySemiBold, color: colors.primary },
  labelInactive: { fontFamily: fonts.bodyMedium, color: colors.inkMuted },
  reportCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginTop: -12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  reportLabel: { fontFamily: fonts.bodyMedium, color: colors.inkMuted },
});

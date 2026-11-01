import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";

import { getCommunityStats } from "../services/homeService";
import { fonts } from "../theme/tokens";

// Says so plainly when the app is showing the seeded demo data, not real rescues.
export default function DemoNotice() {
  const [demo, setDemo] = useState(false);

  useEffect(() => {
    getCommunityStats()
      .then((stats) => setDemo(!!stats.demo_data))
      .catch(() => setDemo(false));
  }, []);

  if (!demo) return null;
  return (
    <Text style={styles.notice} accessibilityRole="text">
      Demo data: these animals, rescues and people are made up for a university project.
    </Text>
  );
}

const styles = StyleSheet.create({
  notice: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    backgroundColor: "#FFF4DC",
    fontFamily: fonts.bodyMedium,
    fontSize: 11,
    lineHeight: 15,
    textAlign: "center",
    color: "#6B4200",
  },
});

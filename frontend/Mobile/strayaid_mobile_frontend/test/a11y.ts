import type { ReactTestInstance } from "react-test-renderer";
import { Pressable, Text, TouchableOpacity } from "react-native";

const TAPPABLE = new Set<unknown>([Pressable, TouchableOpacity, Text]);

function textOf(node: ReactTestInstance | string): string {
  if (typeof node === "string") return node;
  return node.children.map(textOf).join(" ");
}

/** Every tappable element must say what it is and what it does, for TalkBack and VoiceOver. */
export function unlabelledTappables(root: ReactTestInstance): string[] {
  return root
    .findAll((node) => TAPPABLE.has(node.type) && typeof node.props.onPress === "function", { deep: true })
    .filter((node) => {
      if (node.props.accessibilityElementsHidden || node.props.importantForAccessibility === "no") return false;
      const named = Boolean(node.props.accessibilityLabel || textOf(node).trim());
      const role = node.type === Text ? node.props.accessibilityRole ?? "link" : node.props.accessibilityRole;
      return !named || !role;
    })
    .map((node) => `${(node.type as { displayName?: string }).displayName ?? "Tappable"}: "${textOf(node).trim().slice(0, 40)}"`);
}

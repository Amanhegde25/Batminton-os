import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors } from "../theme/colors";

interface BadgeProps {
  label: string;
  tone?: "primary" | "success" | "warning" | "danger" | "muted";
}

export function Badge({ label, tone = "muted" }: BadgeProps) {
  const getBadgeStyle = () => {
    switch (tone) {
      case "primary":
        return { bg: colors.primaryLight, text: colors.primary, border: "rgba(16, 185, 129, 0.3)" };
      case "success":
        return { bg: colors.successLight, text: colors.success, border: "rgba(16, 185, 129, 0.3)" };
      case "warning":
        return { bg: colors.warningLight, text: colors.warning, border: "rgba(245, 158, 11, 0.3)" };
      case "danger":
        return { bg: colors.dangerLight, text: colors.danger, border: "rgba(239, 68, 68, 0.3)" };
      case "muted":
      default:
        return { bg: "rgba(161, 161, 170, 0.1)", text: colors.textMuted, border: colors.cardBorder };
    }
  };

  const styleConfig = getBadgeStyle();

  return (
    <View style={[styles.badge, { backgroundColor: styleConfig.bg, borderColor: styleConfig.border }]}>
      <Text style={[styles.text, { color: styleConfig.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: "flex-start"
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  }
});

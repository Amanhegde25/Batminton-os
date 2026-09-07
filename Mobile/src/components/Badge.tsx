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
        return { bg: colors.primaryLight, text: colors.primary };
      case "success":
        return { bg: colors.successLight, text: colors.success };
      case "warning":
        return { bg: colors.warningLight, text: colors.warning };
      case "danger":
        return { bg: colors.dangerLight, text: colors.danger };
      case "muted":
      default:
        return { bg: "rgba(161, 161, 170, 0.15)", text: colors.textMuted };
    }
  };

  const styleConfig = getBadgeStyle();

  return (
    <View style={[styles.badge, { backgroundColor: styleConfig.bg }]}>
      <Text style={[styles.text, { color: styleConfig.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start"
  },
  text: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase"
  }
});

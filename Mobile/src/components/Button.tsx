import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type TouchableOpacityProps
} from "react-native";
import { colors } from "../theme/colors";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: "primary" | "outline" | "danger" | "secondary";
  loading?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  title,
  variant = "primary",
  loading = false,
  disabled,
  icon,
  style,
  ...props
}: ButtonProps) {
  const isOutline = variant === "outline";
  const isDanger = variant === "danger";
  const isSecondary = variant === "secondary";

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      disabled={disabled || loading}
      style={[
        styles.base,
        isOutline
          ? styles.outline
          : isDanger
          ? styles.danger
          : isSecondary
          ? styles.secondary
          : styles.primary,
        (disabled || loading) && styles.disabled,
        style
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={isOutline ? colors.text : colors.primaryForeground}
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              isOutline
                ? styles.textOutline
                : isDanger
                ? styles.textDanger
                : isSecondary
                ? styles.textSecondary
                : styles.textPrimary
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 48,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    gap: 8
  },
  primary: {
    backgroundColor: colors.primary
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  secondary: {
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  danger: {
    backgroundColor: colors.danger
  },
  disabled: {
    opacity: 0.5
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: -0.2
  },
  textPrimary: {
    color: colors.primaryForeground
  },
  textOutline: {
    color: colors.text
  },
  textSecondary: {
    color: colors.text
  },
  textDanger: {
    color: "#ffffff"
  }
});

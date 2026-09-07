import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/auth";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { useRouter } from "expo-router";

export default function HomeScreen() {
  const { user } = useAuth();
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <Text style={styles.welcome}>Welcome back,</Text>
            <Text style={styles.userName}>{user?.name || "Player"}</Text>
          </View>
          <Badge label={user?.role ?? "PLAYER"} tone="primary" />
        </View>

        <Card style={styles.overviewCard}>
          <View style={styles.clubHeader}>
            <Text style={styles.clubEmoji}>🏸</Text>
            <View>
              <Text style={styles.clubTitle}>Badminton Club OS</Text>
              <Text style={styles.clubSub}>Active Season 2026</Text>
            </View>
          </View>
          <Text style={styles.clubBlurb}>
            Manage your court bookings, matches, attendance, wallet, and live notifications.
          </Text>
        </Card>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/notifications")}
          >
            <Text style={styles.actionIcon}>🔔</Text>
            <Text style={styles.actionText}>View Alerts</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push("/(tabs)/profile")}
          >
            <Text style={styles.actionIcon}>👤</Text>
            <Text style={styles.actionText}>My Profile</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Backend Connection</Text>
        </View>

        <Card style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>User ID:</Text>
            <Text style={styles.statusVal} numberOfLines={1}>{user?.id}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Email:</Text>
            <Text style={styles.statusVal}>{user?.email}</Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Auth Method:</Text>
            <Text style={styles.statusHighlight}>Bearer JWT + Expo SecureStore</Text>
          </View>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  content: {
    padding: 20,
    gap: 20
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  welcome: {
    fontSize: 13,
    color: colors.textMuted
  },
  userName: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text
  },
  overviewCard: {
    gap: 12,
    borderColor: "rgba(16, 185, 129, 0.3)",
    backgroundColor: "rgba(16, 185, 129, 0.05)"
  },
  clubHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  clubEmoji: {
    fontSize: 28
  },
  clubTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  clubSub: {
    fontSize: 12,
    color: colors.textMuted
  },
  clubBlurb: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18
  },
  sectionHeader: {
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  actionsGrid: {
    flexDirection: "row",
    gap: 12
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    gap: 8
  },
  actionIcon: {
    fontSize: 26
  },
  actionText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text
  },
  statusCard: {
    gap: 8
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  statusLabel: {
    fontSize: 13,
    color: colors.textMuted
  },
  statusVal: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
    maxWidth: "60%"
  },
  statusHighlight: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "700"
  }
});

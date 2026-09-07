import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/context/auth";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleSignOut() {
    setLoggingOut(true);
    try {
      await signOut();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.screenTitle}>My Account</Text>
          <Text style={styles.screenSub}>User preferences & session controls</Text>
        </View>

        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>{user?.name || "Player"}</Text>
            <Text style={styles.email}>{user?.email}</Text>
            <View style={{ marginTop: 6 }}>
              <Badge label={user?.role ?? "PLAYER"} tone="primary" />
            </View>
          </View>
        </Card>

        <Card style={styles.detailsCard}>
          <Text style={styles.sectionHeading}>Session Details</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>User ID</Text>
            <Text style={styles.detailVal} numberOfLines={1}>{user?.id}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Token Version</Text>
            <Text style={styles.detailVal}>{user?.tokenVersion}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Mobile</Text>
            <Text style={styles.detailVal}>{user?.mobile || "Not linked"}</Text>
          </View>
        </Card>

        <Button
          title="Sign Out"
          variant="danger"
          loading={loggingOut}
          onPress={handleSignOut}
          style={styles.logoutBtn}
        />
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
    paddingBottom: 4
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text
  },
  screenSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primary
  },
  profileInfo: {
    flex: 1
  },
  name: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text
  },
  email: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2
  },
  detailsCard: {
    gap: 12
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  detailLabel: {
    fontSize: 13,
    color: colors.textMuted
  },
  detailVal: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "500",
    maxWidth: "60%"
  },
  logoutBtn: {
    marginTop: 12
  }
});

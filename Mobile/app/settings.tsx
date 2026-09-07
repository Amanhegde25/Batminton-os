import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, User, Shield, LogOut, Check } from "lucide-react-native";
import { useAuth } from "../src/context/auth";
import { useClub } from "../src/context/club";
import { api } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { Card } from "../src/components/Card";

const DOMINANT_HANDS = ["RIGHT", "LEFT"];
const STYLES = ["ATTACKING", "DEFENSIVE", "ALL_ROUND"];
const TIMES = ["MORNING", "EVENING", "NIGHT"];

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const { me, refreshClubContext, activeClub } = useClub();

  const [name, setName] = useState(user?.name || "");
  const [mobile, setMobile] = useState(user?.mobile || "");
  const [hand, setHand] = useState(user?.dominantHand || "RIGHT");
  const [style, setStyle] = useState(user?.playingStyle || "ALL_ROUND");
  const [time, setTime] = useState(user?.preferredTime || "EVENING");

  const saveMutation = useMutation({
    mutationFn: () =>
      api.users.updateProfile({
        name,
        mobile,
        dominantHand: hand,
        playingStyle: style,
        preferredTime: time
      }),
    onSuccess: async () => {
      await refreshClubContext();
      Alert.alert("Success", "Profile preferences saved successfully!");
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message || "Failed to update profile.");
    }
  });

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topBarTitle}>Settings & Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile Card */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeading}>Player Profile</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={colors.textSubtle}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Mobile Number</Text>
            <TextInput
              value={mobile}
              onChangeText={setMobile}
              keyboardType="phone-pad"
              style={styles.input}
              placeholder="+91 98765 43210"
              placeholderTextColor={colors.textSubtle}
            />
          </View>

          {/* Dominant Hand */}
          <View style={styles.field}>
            <Text style={styles.label}>Dominant Hand</Text>
            <View style={styles.optionRow}>
              {DOMINANT_HANDS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[styles.optionBtn, hand === h && styles.optionBtnActive]}
                  onPress={() => setHand(h)}
                >
                  <Text style={[styles.optionText, hand === h && styles.optionTextActive]}>
                    {h === "RIGHT" ? "Right-Handed" : "Left-Handed"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Playing Style */}
          <View style={styles.field}>
            <Text style={styles.label}>Playing Style</Text>
            <View style={styles.optionRow}>
              {STYLES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.optionBtn, style === s && styles.optionBtnActive]}
                  onPress={() => setStyle(s)}
                >
                  <Text style={[styles.optionText, style === s && styles.optionTextActive]}>
                    {s.replace(/_/g, " ")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Preferred Time */}
          <View style={styles.field}>
            <Text style={styles.label}>Preferred Time</Text>
            <View style={styles.optionRow}>
              {TIMES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.optionBtn, time === t && styles.optionBtnActive]}
                  onPress={() => setTime(t)}
                >
                  <Text style={[styles.optionText, time === t && styles.optionTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Text style={styles.saveBtnText}>Save Preferences</Text>
            )}
          </TouchableOpacity>
        </Card>

        {/* Club Info */}
        <Card style={styles.card}>
          <Text style={styles.sectionHeading}>Club Environment</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Active Club:</Text>
            <Text style={styles.infoVal}>{activeClub?.name || "None"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>City:</Text>
            <Text style={styles.infoVal}>{activeClub?.city || "Local"}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Plan:</Text>
            <Text style={[styles.infoVal, { color: colors.primary, fontWeight: "700" }]}>
              {activeClub?.subscriptionPlan || "PRO"}
            </Text>
          </View>
        </Card>

        {/* Logout */}
        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => void signOut()}
        >
          <LogOut size={16} color={colors.danger} />
          <Text style={styles.logoutBtnText}>Sign Out of Club OS</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 36
  },
  card: {
    padding: 18,
    gap: 14
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 4
  },
  field: {
    gap: 6
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  input: {
    height: 46,
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 12,
    color: colors.text,
    fontSize: 14
  },
  optionRow: {
    flexDirection: "row",
    gap: 8
  },
  optionBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  optionBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  optionText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted
  },
  optionTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryForeground
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textMuted
  },
  infoVal: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "600"
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 4
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.danger
  }
});

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, RefreshCw, Users, Shield, Award } from "lucide-react-native";
import { useClub } from "../src/context/club";
import { api } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import type { MatchmakingPreview } from "../src/lib/types";

export default function MatchmakingScreen() {
  const router = useRouter();
  const { activeClubId, isStaff } = useClub();
  const [mode, setMode] = useState<"DOUBLES" | "SINGLES">("DOUBLES");

  const {
    data: preview,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<MatchmakingPreview>({
    queryKey: ["matchmakingPreview", activeClubId, mode],
    queryFn: () => api.matchmaking.generate(activeClubId!, mode),
    enabled: !!activeClubId
  });

  const assignments = preview?.assignments ?? [];
  const queue = preview?.queue ?? [];

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
        <Text style={styles.topBarTitle}>Smart Matchmaking</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => refetch()}
          activeOpacity={0.7}
        >
          <RefreshCw size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Mode Toggle & Info */}
        <Card style={styles.controlCard}>
          <View style={styles.modeRow}>
            {(["DOUBLES", "SINGLES"] as const).map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.modeBtn, mode === m && styles.modeBtnActive]}
                onPress={() => setMode(m)}
              >
                <Text style={[styles.modeBtnText, mode === m && styles.modeBtnTextActive]}>
                  {m}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.statsBar}>
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{preview?.availablePlayers ?? 0}</Text>
              <Text style={styles.statLabel}>Checked-in Players</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{preview?.availableCourts ?? 0}</Text>
              <Text style={styles.statLabel}>Available Courts</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statCol}>
              <Text style={styles.statNum}>{assignments.length}</Text>
              <Text style={styles.statLabel}>Generated Games</Text>
            </View>
          </View>
        </Card>

        {/* Assignments List */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Generated Pairings</Text>
          <Badge label={`Mode: ${mode}`} tone="primary" />
        </View>

        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Running matchmaking algorithm...</Text>
          </View>
        ) : assignments.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Sparkles size={36} color={colors.primary} />
            <Text style={styles.emptyTitle}>
              {preview?.summary?.reasonIfEmpty || "No Pairings Available"}
            </Text>
            <Text style={styles.emptySub}>
              Ensure enough members are checked in today (minimum{" "}
              {mode === "DOUBLES" ? 4 : 2} players) and courts are available.
            </Text>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={() => refetch()}
            >
              <RefreshCw size={14} color={colors.primaryForeground} />
              <Text style={styles.refreshBtnText}>Regenerate</Text>
            </TouchableOpacity>
          </Card>
        ) : (
          assignments.map((asg, idx) => (
            <Card key={idx} style={styles.assignmentCard}>
              <View style={styles.assignmentHeader}>
                <Text style={styles.courtName}>
                  {asg.court?.name ?? `Court ${idx + 1}`}
                </Text>
                <View style={styles.balancePill}>
                  <Text style={styles.balanceText}>
                    {Math.round(asg.explanation.balancePct)}% Balanced
                  </Text>
                </View>
              </View>

              <View style={styles.matchupBox}>
                <View style={styles.teamCol}>
                  <Text style={styles.teamLabel}>Team A</Text>
                  {asg.teamA.map((p) => (
                    <View key={p.id} style={styles.playerRow}>
                      <Text style={styles.playerName}>{p.name}</Text>
                      <Text style={styles.playerElo}>{Math.round(p.rating)}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.vsBox}>
                  <Text style={styles.vsText}>VS</Text>
                  <Text style={styles.diffText}>
                    Δ {Math.round(asg.explanation.ratingDiff)}
                  </Text>
                </View>

                <View style={styles.teamCol}>
                  <Text style={styles.teamLabel}>Team B</Text>
                  {asg.teamB.map((p) => (
                    <View key={p.id} style={styles.playerRow}>
                      <Text style={styles.playerName}>{p.name}</Text>
                      <Text style={styles.playerElo}>{Math.round(p.rating)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </Card>
          ))
        )}

        {/* Queue / Waiting List */}
        {queue.length > 0 && (
          <View style={styles.queueSection}>
            <Text style={styles.sectionTitle}>Waiting Queue ({queue.length})</Text>
            <Card style={styles.queueCard}>
              {queue.map((name, i) => (
                <Text key={i} style={styles.queueItem}>
                  {i + 1}. {name}
                </Text>
              ))}
            </Card>
          </View>
        )}
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
    paddingBottom: 32
  },
  controlCard: {
    padding: 16,
    gap: 14
  },
  modeRow: {
    flexDirection: "row",
    gap: 8
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  modeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  modeBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted
  },
  modeBtnTextActive: {
    color: colors.primary
  },
  statsBar: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 12
  },
  statCol: {
    flex: 1,
    alignItems: "center"
  },
  statNum: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text
  },
  statLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: "center"
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.cardBorder
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  assignmentCard: {
    padding: 16,
    gap: 12
  },
  assignmentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  courtName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  balancePill: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6
  },
  balanceText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary
  },
  matchupBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    padding: 12
  },
  teamCol: {
    flex: 1,
    gap: 4
  },
  teamLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase"
  },
  playerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  playerName: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text
  },
  playerElo: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "700"
  },
  vsBox: {
    paddingHorizontal: 12,
    alignItems: "center"
  },
  vsText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textSubtle
  },
  diffText: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 8
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260
  },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 8
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryForeground
  },
  queueSection: {
    gap: 8
  },
  queueCard: {
    padding: 14,
    gap: 6
  },
  queueItem: {
    fontSize: 13,
    color: colors.textMuted
  },
  center: {
    padding: 40,
    alignItems: "center",
    gap: 8
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted
  }
});

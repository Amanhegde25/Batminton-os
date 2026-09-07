import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Sparkles, Plus, Trophy } from "lucide-react-native";
import { useClub } from "../../src/context/club";
import { api } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import type { MatchRow } from "../../src/lib/types";

const TAB_STATUS: Record<string, string | undefined> = {
  live: "LIVE,IN_PROGRESS",
  upcoming: "SCHEDULED,READY",
  done: "COMPLETED,WALKOVER",
  all: undefined
};

export default function MatchesScreen() {
  const { activeClubId, isStaff } = useClub();
  const router = useRouter();
  const [tab, setTab] = useState<"live" | "upcoming" | "done" | "all">("upcoming");

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["matchesList", activeClubId, tab],
    queryFn: () =>
      api.matches.list(activeClubId!, {
        status: TAB_STATUS[tab],
        pageSize: 30
      }),
    enabled: !!activeClubId
  });

  const matches = data?.items ?? [];

  const renderItem = ({ item }: { item: MatchRow }) => {
    const teamA = item.teams?.[0]?.players?.map((p) => p.name).join(" & ") || "TBD";
    const teamB = item.teams?.[1]?.players?.map((p) => p.name).join(" & ") || "TBD";
    const isLive = item.status === "LIVE" || item.status === "IN_PROGRESS";
    const isCompleted = item.status === "COMPLETED";
    const winnerIdx = item.winnerTeamIndex;

    return (
      <Card style={[styles.card, isLive && styles.liveCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.courtBadge}>
            <Clock size={12} color={colors.textMuted} />
            <Text style={styles.courtName}>
              {item.court?.name ?? "Court"} • {item.type}
            </Text>
          </View>
          <Badge
            label={item.status.replace(/_/g, " ")}
            tone={isLive ? "danger" : isCompleted ? "success" : "primary"}
          />
        </View>

        {/* Team Matchup */}
        <View style={styles.matchup}>
          <View style={styles.teamRow}>
            <View style={styles.teamDetails}>
              {winnerIdx === 0 && <Trophy size={14} color="#f59e0b" />}
              <Text
                style={[
                  styles.teamName,
                  winnerIdx === 0 && styles.winnerTeamName
                ]}
              >
                {teamA}
              </Text>
            </View>
            {item.scores && item.scores.length > 0 && (
              <Text style={styles.scoreText}>
                {item.scores.map((s) => s.a).join(" · ")}
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.teamRow}>
            <View style={styles.teamDetails}>
              {winnerIdx === 1 && <Trophy size={14} color="#f59e0b" />}
              <Text
                style={[
                  styles.teamName,
                  winnerIdx === 1 && styles.winnerTeamName
                ]}
              >
                {teamB}
              </Text>
            </View>
            {item.scores && item.scores.length > 0 && (
              <Text style={styles.scoreText}>
                {item.scores.map((s) => s.b).join(" · ")}
              </Text>
            )}
          </View>
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <Text style={styles.scheduledTime}>
            {new Date(item.scheduledAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit"
            })}
          </Text>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Matches</Text>
          <Text style={styles.screenSub}>Club matches & live score tracking</Text>
        </View>

        <TouchableOpacity
          style={styles.matchmakerBtn}
          onPress={() => router.push("/matchmaking")}
        >
          <Sparkles size={14} color={colors.primaryForeground} />
          <Text style={styles.matchmakerBtnText}>Matchmaking</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs Switcher */}
      <View style={styles.tabsRow}>
        {(["upcoming", "live", "done", "all"] as const).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tabItem, tab === t && styles.tabItemActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading matches...</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>🏸</Text>
              <Text style={styles.emptyTitle}>No matches found</Text>
              <Text style={styles.emptySub}>
                {tab === "live"
                  ? "No live matches on court right now."
                  : "Matches scheduled or played in this club will appear here."}
              </Text>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => router.push("/matchmaking")}
              >
                <Sparkles size={14} color={colors.primaryForeground} />
                <Text style={styles.actionBtnText}>Launch AI Matchmaker</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14
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
  matchmakerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10
  },
  matchmakerBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryForeground
  },
  tabsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8
  },
  tabItem: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  tabItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  tabText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted
  },
  tabTextActive: {
    color: colors.primary
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12
  },
  card: {
    gap: 12,
    padding: 16
  },
  liveCard: {
    borderColor: "rgba(239, 68, 68, 0.4)",
    backgroundColor: "rgba(239, 68, 68, 0.04)"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  courtBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  courtName: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  matchup: {
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    padding: 12,
    gap: 10
  },
  teamRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  teamDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1
  },
  teamName: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text
  },
  winnerTeamName: {
    color: "#f59e0b",
    fontWeight: "800"
  },
  scoreText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary,
    marginLeft: 12
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  scheduledTime: {
    fontSize: 11,
    color: colors.textSubtle
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 10
  },
  emptyEmoji: {
    fontSize: 40
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 260
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 8
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryForeground
  }
});

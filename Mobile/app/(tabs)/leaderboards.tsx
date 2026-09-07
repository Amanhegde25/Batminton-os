import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { Trophy, Medal, Crown, Target, Flame, CalendarDays, Award, Rocket } from "lucide-react-native";
import { useClub } from "../../src/context/club";
import { api } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import type { LeaderboardEntry } from "../../src/lib/types";

const CATEGORIES = [
  { key: "HIGHEST_RATING", label: "Rating", icon: Crown },
  { key: "HIGHEST_WIN_RATE", label: "Win Rate %", icon: Target },
  { key: "LONGEST_WINNING_STREAK", label: "Win Streak", icon: Flame },
  { key: "ATTENDANCE_CHAMPION", label: "Attendance", icon: CalendarDays },
  { key: "BEST_PLAYER", label: "Best Player", icon: Award },
  { key: "MOST_IMPROVED", label: "Most Improved", icon: Rocket }
];

const PERIODS = [
  { key: "WEEKLY", label: "Weekly" },
  { key: "MONTHLY", label: "Monthly" },
  { key: "ALL_TIME", label: "All-Time" }
];

export default function LeaderboardsScreen() {
  const { activeClubId } = useClub();
  const [selectedCategory, setSelectedCategory] = useState("HIGHEST_RATING");
  const [selectedPeriod, setSelectedPeriod] = useState("ALL_TIME");

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ["leaderboard", activeClubId, selectedCategory, selectedPeriod],
    queryFn: () =>
      api.leaderboards.get(activeClubId!, selectedCategory, selectedPeriod),
    enabled: !!activeClubId
  });

  const entries = data?.entries ?? [];

  const renderRankBadge = (rank: number) => {
    if (rank === 0) {
      return (
        <View style={[styles.medalBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
          <Medal size={16} color="#f59e0b" />
        </View>
      );
    }
    if (rank === 1) {
      return (
        <View style={[styles.medalBox, { backgroundColor: "rgba(148, 163, 184, 0.15)" }]}>
          <Medal size={16} color="#94a3b8" />
        </View>
      );
    }
    if (rank === 2) {
      return (
        <View style={[styles.medalBox, { backgroundColor: "rgba(180, 83, 9, 0.15)" }]}>
          <Medal size={16} color="#b45309" />
        </View>
      );
    }
    return (
      <View style={styles.rankNumBox}>
        <Text style={styles.rankNumText}>#{rank + 1}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.screenTitle}>Leaderboards</Text>
        <Text style={styles.screenSub}>Club rankings and performance records</Text>
      </View>

      {/* Category Filter Chips */}
      <View style={{ height: 44 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryScroll}
        >
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isSelected = selectedCategory === cat.key;
            return (
              <TouchableOpacity
                key={cat.key}
                style={[styles.categoryChip, isSelected && styles.categoryChipActive]}
                onPress={() => setSelectedCategory(cat.key)}
              >
                <Icon size={14} color={isSelected ? colors.primaryForeground : colors.textMuted} />
                <Text style={[styles.categoryChipText, isSelected && styles.categoryChipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Period Filter Chips */}
      <View style={styles.periodRow}>
        {PERIODS.map((per) => {
          const isSelected = selectedPeriod === per.key;
          return (
            <TouchableOpacity
              key={per.key}
              style={[styles.periodBtn, isSelected && styles.periodBtnActive]}
              onPress={() => setSelectedPeriod(per.key)}
            >
              <Text style={[styles.periodBtnText, isSelected && styles.periodBtnTextActive]}>
                {per.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Leaderboard List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Calculating rankings...</Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item, idx) => `${item.userId}-${idx}`}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item, index }) => (
            <Card style={styles.rankCard}>
              <View style={styles.rankLeft}>
                {renderRankBadge(index)}
                <View style={styles.avatarBox}>
                  <Text style={styles.avatarText}>
                    {item.name ? item.name[0].toUpperCase() : "U"}
                  </Text>
                </View>
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{item.name}</Text>
                  {item.meta && <Text style={styles.playerMeta}>{item.meta}</Text>}
                </View>
              </View>

              <View style={styles.metricBox}>
                <Text style={styles.metricDisplay}>{item.display}</Text>
              </View>
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.center}>
              <Trophy size={40} color={colors.textSubtle} />
              <Text style={styles.emptyTitle}>No ranking data</Text>
              <Text style={styles.emptySub}>
                Play matches and attend sessions to rank on the leaderboard!
              </Text>
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
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10
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
  categoryScroll: {
    paddingHorizontal: 20,
    gap: 8
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  categoryChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  categoryChipTextActive: {
    color: colors.primaryForeground,
    fontWeight: "700"
  },
  periodRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginVertical: 10,
    gap: 8
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center"
  },
  periodBtnActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  periodBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted
  },
  periodBtnTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 10
  },
  rankCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14
  },
  rankLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1
  },
  medalBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center"
  },
  rankNumBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center"
  },
  rankNumText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary
  },
  playerInfo: {
    flex: 1
  },
  playerName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  playerMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 1
  },
  metricBox: {
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  metricDisplay: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primary
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 8
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center"
  }
});

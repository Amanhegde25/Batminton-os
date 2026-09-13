import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert,
  ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Sparkles,
  Trophy,
  X,
  RotateCcw,
  ArrowLeftRight,
  Flag,
  Radio,
  Grid
} from "lucide-react-native";
import { useClub } from "../../src/context/club";
import { api } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import type { MatchRow } from "../../src/lib/types";

const TAB_STATUS: Record<string, string | undefined> = {
  live: "LIVE,IN_PROGRESS",
  upcoming: "SCHEDULED,READY",
  done: "COMPLETED,WALKOVER",
  all: undefined
};

// BWF Badminton Win Condition Evaluator
function evaluateWinCondition(a: number, b: number): { won: boolean; winnerIdx: 0 | 1 | null; reason: string } {
  if (a >= 21 && a - b >= 2) {
    return {
      won: true,
      winnerIdx: 0,
      reason: a === 21 && b < 20 ? "Standard Set Win (21 points, 2+ lead)" : "Deuce Advantage Win (2-point lead)"
    };
  }
  if (b >= 21 && b - a >= 2) {
    return {
      won: true,
      winnerIdx: 1,
      reason: b === 21 && a < 20 ? "Standard Set Win (21 points, 2+ lead)" : "Deuce Advantage Win (2-point lead)"
    };
  }
  if (a >= 30 && a > b) {
    return { won: true, winnerIdx: 0, reason: "Sudden Death Golden Point (Max 30 Cap)" };
  }
  if (b >= 30 && b > a) {
    return { won: true, winnerIdx: 1, reason: "Sudden Death Golden Point (Max 30 Cap)" };
  }
  return { won: false, winnerIdx: null, reason: "" };
}

export default function MatchesScreen() {
  const { activeClubId, isStaff } = useClub();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"live" | "upcoming" | "done" | "all">("upcoming");

  // Selected match for live scoring modal
  const [selectedMatch, setSelectedMatch] = useState<MatchRow | null>(null);
  const [liveA, setLiveA] = useState(0);
  const [liveB, setLiveB] = useState(0);
  const [swapped, setSwapped] = useState(false);
  const [serving, setServing] = useState<0 | 1>(0);
  const [history, setHistory] = useState<{ a: number; b: number; serving: 0 | 1 }[]>([]);
  const [busy, setBusy] = useState(false);

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

  const teamNameA = selectedMatch?.teams?.[0]?.players?.map((p) => p.name).join(" & ") || "Team A";
  const teamNameB = selectedMatch?.teams?.[1]?.players?.map((p) => p.name).join(" & ") || "Team B";
  const completedSets = selectedMatch?.scores ?? [];
  const currentSetNum = completedSets.length + 1;
  const setsWonA = completedSets.filter((s) => s.a > s.b).length;
  const setsWonB = completedSets.filter((s) => s.b > s.a).length;

  const openMatchModal = (m: MatchRow) => {
    setSelectedMatch(m);
    setLiveA(0);
    setLiveB(0);
    setHistory([]);
    setSwapped(false);
    setServing(0);
  };

  const closeMatchModal = () => {
    setSelectedMatch(null);
    void refetch();
  };

  // Perform API Action
  const act = async (actionData: Record<string, unknown>) => {
    if (!selectedMatch || !activeClubId) return;
    setBusy(true);
    try {
      await api.matches.act(activeClubId, selectedMatch.id, actionData);
      const updated = await api.matches.get(activeClubId, selectedMatch.id);
      setSelectedMatch(updated);
      void queryClient.invalidateQueries({ queryKey: ["matchesList"] });
    } catch (err) {
      Alert.alert("Action Failed", err instanceof Error ? err.message : "Request failed");
    } finally {
      setBusy(false);
    }
  };

  // Point scoring for +1, +2, +3, -1, -2
  const handleScoreAdjust = (teamIdx: 0 | 1, delta: number) => {
    if (busy) return;
    setHistory((prev) => [...prev, { a: liveA, b: liveB, serving }]);

    let nextA = liveA;
    let nextB = liveB;

    if (teamIdx === 0) {
      nextA = Math.max(0, Math.min(30, liveA + delta));
      setLiveA(nextA);
      if (delta > 0) setServing(0);
    } else {
      nextB = Math.max(0, Math.min(30, liveB + delta));
      setLiveB(nextB);
      if (delta > 0) setServing(1);
    }

    // Check Win Condition
    const win = evaluateWinCondition(nextA, nextB);
    if (win.won && win.winnerIdx !== null) {
      const winner = win.winnerIdx;
      const winnerName = winner === 0 ? teamNameA : teamNameB;
      const setsWonByWinner = (winner === 0 ? setsWonA : setsWonB) + 1;
      const isMatchOver = setsWonByWinner >= 2 || currentSetNum >= 3;

      const newSets = [...completedSets.map((s) => ({ a: s.a, b: s.b })), { a: nextA, b: nextB }];

      if (isMatchOver) {
        Alert.alert(
          "Match Victory Reached!",
          `${winnerName} wins the match (${nextA} - ${nextB})!\n\n${win.reason}`,
          [
            {
              text: "Finalize & Complete Match",
              style: "default",
              onPress: async () => {
                await act({ action: "complete", sets: newSets });
                closeMatchModal();
              }
            },
            {
              text: "Undo Point",
              style: "cancel",
              onPress: handleUndo
            }
          ]
        );
      } else {
        Alert.alert(
          `Set ${currentSetNum} Won!`,
          `${winnerName} wins Set ${currentSetNum} (${nextA} - ${nextB})!\n\n${win.reason}\n\nStarting Set ${currentSetNum + 1}...`,
          [
            {
              text: `Start Set ${currentSetNum + 1} →`,
              style: "default",
              onPress: async () => {
                await act({ action: "score", sets: newSets });
                setLiveA(0);
                setLiveB(0);
                setHistory([]);
              }
            },
            {
              text: "Undo Point",
              style: "cancel",
              onPress: handleUndo
            }
          ]
        );
      }
    }
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setLiveA(last.a);
    setLiveB(last.b);
    setServing(last.serving);
    setHistory((prev) => prev.slice(0, -1));
  };

  const renderItem = ({ item }: { item: MatchRow }) => {
    const teamA = item.teams?.[0]?.players?.map((p) => p.name).join(" & ") || "TBD";
    const teamB = item.teams?.[1]?.players?.map((p) => p.name).join(" & ") || "TBD";
    const isLive = item.status === "LIVE" || item.status === "IN_PROGRESS";
    const isCompleted = item.status === "COMPLETED";
    const winnerIdx = item.winnerTeamIndex;

    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => openMatchModal(item)}>
        <Card style={[styles.card, isLive && styles.liveCard]}>
          <View style={styles.cardHeader}>
            <View style={styles.courtBadge}>
              <Clock size={12} color={colors.textMuted} />
              <Text style={styles.courtName}>
                {item.court?.name ?? "Court"} • {item.type}
              </Text>
            </View>
            <Badge
              label={isLive ? "LIVE SCORING" : item.status.replace(/_/g, " ")}
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
                  numberOfLines={1}
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
                  numberOfLines={1}
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
            <Text style={styles.tapToScore}>Tap to score →</Text>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Matches</Text>
          <Text style={styles.screenSub}>Badminton live scoring & schedule</Text>
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

      {/* LIVE SCORING MODAL CONSOLE (per user request) */}
      <Modal
        visible={!!selectedMatch}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeMatchModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Badminton Scoring Console</Text>
              <Text style={styles.modalSub}>
                {selectedMatch?.court?.name || "Court"} · {selectedMatch?.type}
              </Text>
            </View>
            <TouchableOpacity onPress={closeMatchModal} style={styles.closeBtn}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.modalScroll}>
            {/* Match Status & Completed Sets */}
            <Card style={styles.scoreOverviewCard}>
              <View style={styles.matchup}>
                <View style={styles.teamRow}>
                  <Text style={styles.teamNameModal}>{teamNameA}</Text>
                  <Text style={styles.setsWonModal}>{setsWonA}</Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.teamRow}>
                  <Text style={styles.teamNameModal}>{teamNameB}</Text>
                  <Text style={styles.setsWonModal}>{setsWonB}</Text>
                </View>
              </View>

              {completedSets.length > 0 && (
                <View style={styles.completedSetsRow}>
                  {completedSets.map((s, idx) => (
                    <View key={idx} style={styles.setHistoryPill}>
                      <Text style={styles.setHistoryPillText}>
                        Set {idx + 1}: {s.a} - {s.b}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Card>

            {/* Scheduled Controls if match not started */}
            {["SCHEDULED", "READY"].includes(selectedMatch?.status || "") && (
              <View style={styles.startMatchSection}>
                <Button
                  title="▶ Start Live Match"
                  loading={busy}
                  onPress={() => act({ action: "start" })}
                />
              </View>
            )}

            {/* Live Scoring Console if IN_PROGRESS */}
            {(selectedMatch?.status === "IN_PROGRESS" || selectedMatch?.status === "LIVE") && (
              <Card style={styles.liveScoreboardCard}>
                <View style={styles.scoreboardTop}>
                  <Badge
                    label={currentSetNum === 3 ? "DECIDER SET" : `SET ${currentSetNum}`}
                    tone="primary"
                  />
                  <View style={styles.scoringActions}>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      onPress={() => setSwapped(!swapped)}
                    >
                      <ArrowLeftRight size={14} color={colors.text} />
                      <Text style={styles.iconActionBtnText}>Swap</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconActionBtn}
                      disabled={history.length === 0}
                      onPress={handleUndo}
                    >
                      <RotateCcw size={14} color={colors.text} />
                      <Text style={styles.iconActionBtnText}>Undo</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Left and Right Teams live scorepads */}
                {(() => {
                  const leftIdx = swapped ? 1 : 0;
                  const rightIdx = swapped ? 0 : 1;
                  const scoreLeft = swapped ? liveB : liveA;
                  const scoreRight = swapped ? liveA : liveB;
                  const isServingLeft = serving === leftIdx;
                  const isServingRight = serving === rightIdx;

                  return (
                    <View style={styles.padsContainer}>
                      {/* Left Pad */}
                      <View style={styles.padColumn}>
                        <View style={styles.padHeader}>
                          <Text style={styles.padTeamName} numberOfLines={1}>
                            {leftIdx === 0 ? teamNameA : teamNameB}
                          </Text>
                          {isServingLeft && (
                            <View style={styles.servingPill}>
                              <Text style={styles.servingPillText}>SERVE</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.padScore}>{scoreLeft}</Text>

                        {/* +1 Rally Button */}
                        <TouchableOpacity
                          style={styles.primaryPointBtn}
                          onPress={() => handleScoreAdjust(leftIdx, 1)}
                        >
                          <Text style={styles.primaryPointBtnText}>+1 Rally</Text>
                        </TouchableOpacity>

                        {/* +2, +3 Tactical additions */}
                        <View style={styles.pointRow}>
                          <TouchableOpacity
                            style={styles.secondaryPointBtn}
                            onPress={() => handleScoreAdjust(leftIdx, 2)}
                          >
                            <Text style={styles.secondaryPointBtnText}>+2 Smash</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.secondaryPointBtn}
                            onPress={() => handleScoreAdjust(leftIdx, 3)}
                          >
                            <Text style={styles.secondaryPointBtnText}>+3 Run</Text>
                          </TouchableOpacity>
                        </View>

                        {/* -1, -2 Corrections */}
                        <View style={styles.pointRow}>
                          <TouchableOpacity
                            style={styles.outlinePointBtn}
                            onPress={() => handleScoreAdjust(leftIdx, -1)}
                          >
                            <Text style={styles.outlinePointBtnText}>-1</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.outlinePointBtn}
                            onPress={() => handleScoreAdjust(leftIdx, -2)}
                          >
                            <Text style={styles.outlinePointBtnText}>-2</Text>
                          </TouchableOpacity>
                        </View>
                      </View>

                      {/* Right Pad */}
                      <View style={styles.padColumn}>
                        <View style={styles.padHeader}>
                          <Text style={styles.padTeamName} numberOfLines={1}>
                            {rightIdx === 0 ? teamNameA : teamNameB}
                          </Text>
                          {isServingRight && (
                            <View style={styles.servingPill}>
                              <Text style={styles.servingPillText}>SERVE</Text>
                            </View>
                          )}
                        </View>

                        <Text style={styles.padScore}>{scoreRight}</Text>

                        {/* +1 Rally Button */}
                        <TouchableOpacity
                          style={styles.primaryPointBtn}
                          onPress={() => handleScoreAdjust(rightIdx, 1)}
                        >
                          <Text style={styles.primaryPointBtnText}>+1 Rally</Text>
                        </TouchableOpacity>

                        {/* +2, +3 Tactical additions */}
                        <View style={styles.pointRow}>
                          <TouchableOpacity
                            style={styles.secondaryPointBtn}
                            onPress={() => handleScoreAdjust(rightIdx, 2)}
                          >
                            <Text style={styles.secondaryPointBtnText}>+2 Smash</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.secondaryPointBtn}
                            onPress={() => handleScoreAdjust(rightIdx, 3)}
                          >
                            <Text style={styles.secondaryPointBtnText}>+3 Run</Text>
                          </TouchableOpacity>
                        </View>

                        {/* -1, -2 Corrections */}
                        <View style={styles.pointRow}>
                          <TouchableOpacity
                            style={styles.outlinePointBtn}
                            onPress={() => handleScoreAdjust(rightIdx, -1)}
                          >
                            <Text style={styles.outlinePointBtnText}>-1</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.outlinePointBtn}
                            onPress={() => handleScoreAdjust(rightIdx, -2)}
                          >
                            <Text style={styles.outlinePointBtnText}>-2</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  );
                })()}

                <Text style={styles.rulesHint}>
                  BWF Rules: First to 21 with 2+ lead. Deuce at 20-20. Golden point cap at 30.
                </Text>
              </Card>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
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
    paddingBottom: 30,
    gap: 12
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 60
  },
  loadingText: {
    marginTop: 12,
    color: colors.textMuted,
    fontSize: 13
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    paddingHorizontal: 20
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
    maxWidth: 260
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 16
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryForeground
  },
  card: {
    padding: 16,
    gap: 12,
    borderRadius: 18
  },
  liveCard: {
    borderColor: colors.primary,
    borderWidth: 1.5
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
    color: colors.textMuted,
    fontWeight: "500"
  },
  matchup: {
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
    fontSize: 15,
    fontWeight: "600",
    color: colors.text
  },
  winnerTeamName: {
    color: colors.primary,
    fontWeight: "700"
  },
  scoreText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    fontVariant: ["tabular-nums"]
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 8
  },
  scheduledTime: {
    fontSize: 11,
    color: colors.textSubtle
  },
  tapToScore: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary
  },

  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text
  },
  modalSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: colors.cardElevated
  },
  modalScroll: {
    padding: 16,
    gap: 16
  },
  scoreOverviewCard: {
    padding: 16,
    borderRadius: 18
  },
  teamNameModal: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    flex: 1
  },
  setsWonModal: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.primary,
    fontVariant: ["tabular-nums"]
  },
  completedSetsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder
  },
  setHistoryPill: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8
  },
  setHistoryPillText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600",
    fontVariant: ["tabular-nums"]
  },
  startMatchSection: {
    marginTop: 8
  },
  liveScoreboardCard: {
    padding: 16,
    borderRadius: 20,
    gap: 16
  },
  scoreboardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  scoringActions: {
    flexDirection: "row",
    gap: 8
  },
  iconActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8
  },
  iconActionBtnText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600"
  },
  padsContainer: {
    flexDirection: "row",
    gap: 10
  },
  padColumn: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 8
  },
  padHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  padTeamName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    flex: 1
  },
  servingPill: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4
  },
  servingPillText: {
    color: colors.primary,
    fontSize: 9,
    fontWeight: "800"
  },
  padScore: {
    color: colors.text,
    fontSize: 38,
    fontWeight: "900",
    textAlign: "center",
    marginVertical: 4,
    fontVariant: ["tabular-nums"]
  },
  primaryPointBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center"
  },
  primaryPointBtnText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "800"
  },
  pointRow: {
    flexDirection: "row",
    gap: 6
  },
  secondaryPointBtn: {
    flex: 1,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center"
  },
  secondaryPointBtnText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700"
  },
  outlinePointBtn: {
    flex: 1,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 8,
    paddingVertical: 6,
    alignItems: "center"
  },
  outlinePointBtnText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700"
  },
  rulesHint: {
    color: colors.textSubtle,
    fontSize: 10,
    textAlign: "center"
  }
});

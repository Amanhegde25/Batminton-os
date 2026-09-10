import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ChevronDown,
  CalendarCheck,
  Sparkles,
  Grid,
  Trophy,
  Wallet,
  Brain,
  Video,
  Users,
  Scale,
  Settings,
  Flame,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  MapPin,
  Building
} from "lucide-react-native";
import { useAuth } from "../../src/context/auth";
import { useClub } from "../../src/context/club";
import { api } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import type { AdminStats, NearbyClub, RatingCard, TodayMatch, WalletSummary } from "../../src/lib/types";

function money(n: number): string {
  return `₹${(Math.abs(n) / 100).toLocaleString("en-IN")}`;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const { activeClubId, activeClub, activeMembership, isStaff, openClubSwitcher, switchClub } = useClub();
  const router = useRouter();
  const queryClient = useQueryClient();

  // Queries
  const { data: ratingData, refetch: refetchRating } = useQuery<RatingCard>({
    queryKey: ["playerRating", activeClubId, user?.id],
    queryFn: () => api.clubs.playerRating(activeClubId!, user!.id),
    enabled: !!activeClubId && !!user?.id
  });

  const { data: walletData, refetch: refetchWallet } = useQuery<WalletSummary>({
    queryKey: ["walletSummary", activeClubId],
    queryFn: () => api.wallet.summary(activeClubId!),
    enabled: !!activeClubId
  });

  const { data: matchesData, refetch: refetchMatches } = useQuery<{ items: TodayMatch[] }>({
    queryKey: ["todayMatches", activeClubId, user?.id],
    queryFn: () => api.matches.list(activeClubId!, { userId: user?.id, day: "today" }),
    enabled: !!activeClubId && !!user?.id
  });

  const { data: attendanceData, refetch: refetchAttendance } = useQuery({
    queryKey: ["todayAttendance", activeClubId],
    queryFn: () => api.attendance.today(activeClubId!),
    enabled: !!activeClubId
  });

  const { data: adminStats, refetch: refetchAdmin } = useQuery<AdminStats>({
    queryKey: ["adminDashboard", activeClubId],
    queryFn: () => api.clubs.dashboard(activeClubId!),
    enabled: !!activeClubId && isStaff
  });

  const { data: notifsData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications.list(1)
  });

  const { data: nearbyClubs = [], refetch: refetchNearby } = useQuery<NearbyClub[]>({
    queryKey: ["nearbyClubs", activeClub?.city],
    queryFn: () => api.clubs.nearby({ city: activeClub?.city || undefined }),
    enabled: !!user
  });

  const [joiningClubId, setJoiningClubId] = useState<string | null>(null);
  const handleJoinClub = async (clubId: string) => {
    setJoiningClubId(clubId);
    try {
      await api.clubs.join(clubId);
      void queryClient.invalidateQueries({ queryKey: ["nearbyClubs"] });
    } catch (e) {
      console.warn("Failed to join club", e);
    } finally {
      setJoiningClubId(null);
    }
  };

  // Check-in Mutation
  const checkInMutation = useMutation({
    mutationFn: () =>
      api.attendance.checkIn(activeClubId!, {
        method: "MANUAL"
      }),
    onSuccess: (data) => {
      const statusText = data?.status === "LATE" ? "Late" : "Present";
      Alert.alert("Success", `Attendance marked as ${statusText} for today!`);
      void queryClient.invalidateQueries({ queryKey: ["todayAttendance", activeClubId] });
      void queryClient.invalidateQueries({ queryKey: ["attendanceToday", activeClubId] });
      void queryClient.invalidateQueries({ queryKey: ["attendanceHistory", activeClubId] });
    },
    onError: (err: Error) => {
      Alert.alert("Check-In Error", err.message || "Failed to mark attendance.");
    }
  });

  const isCheckedIn =
    attendanceData?.roster?.some(
      (row) =>
        row.member?.userId === user?.id &&
        row.record != null &&
        ["PRESENT", "LATE", "GUEST"].includes(row.record.status || "")
    ) ||
    attendanceData?.rows?.some(
      (row) =>
        row.userId === user?.id &&
        row.status != null &&
        ["PRESENT", "LATE", "GUEST"].includes(row.status || "")
    );

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchRating(),
      refetchWallet(),
      refetchMatches(),
      refetchAttendance(),
      refetchNearby(),
      isStaff ? refetchAdmin() : Promise.resolve()
    ]);
    setRefreshing(false);
  };

  const unreadAlerts = notifsData?.unread ?? 0;
  const todayMatchesList = matchesData?.items ?? [];

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={styles.clubSelector}
            onPress={openClubSwitcher}
            activeOpacity={0.7}
          >
            <View style={styles.clubBadge}>
              <Text style={styles.clubEmoji}>🏸</Text>
            </View>
            <View style={styles.clubInfo}>
              <View style={styles.clubNameRow}>
                <Text style={styles.clubName} numberOfLines={1}>
                  {activeClub?.name ?? "No Club Selected"}
                </Text>
                <ChevronDown size={14} color={colors.textMuted} />
              </View>
              <Text style={styles.clubRole}>
                {activeMembership?.role ?? "MEMBER"} • {activeClub?.city || "Club OS"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.notifBtn}
          onPress={() => router.push("/(tabs)/notifications")}
          activeOpacity={0.7}
        >
          <Bell size={20} color={colors.text} />
          {unreadAlerts > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeText}>{unreadAlerts}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Welcome Greeting */}
        <View style={styles.greetingRow}>
          <View>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.playerName}>{user?.name || "Player"}</Text>
          </View>
          <Badge label={activeMembership?.role ?? "PLAYER"} tone="primary" />
        </View>

        {/* Quick Check-in Banner */}
        <Card
          style={[
            styles.checkInCard,
            isCheckedIn && styles.checkInCardDone
          ]}
        >
          <View style={styles.checkInLeft}>
            {isCheckedIn ? (
              <CheckCircle2 size={24} color={colors.primary} />
            ) : (
              <CalendarCheck size={24} color={colors.textMuted} />
            )}
            <View>
              <Text style={styles.checkInTitle}>
                {isCheckedIn ? "Checked In Today" : "Court Check-In"}
              </Text>
              <Text style={styles.checkInSub}>
                {isCheckedIn
                  ? "Your presence is marked for today's session"
                  : "Tap to record your club attendance"}
              </Text>
            </View>
          </View>

          {!isCheckedIn && (
            <TouchableOpacity
              style={styles.checkInBtn}
              onPress={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
            >
              {checkInMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.checkInBtnText}>Check In</Text>
              )}
            </TouchableOpacity>
          )}
        </Card>

        {/* Stats Row: Rating & Wallet */}
        <View style={styles.statsRow}>
          <TouchableOpacity
            style={styles.statBox}
            activeOpacity={0.8}
            onPress={() => router.push("/(tabs)/leaderboards")}
          >
            <View style={styles.statIconRow}>
              <Flame size={18} color="#f59e0b" />
              <Text style={styles.statLabel}>ELO Rating</Text>
            </View>
            <Text style={styles.statValue}>
              {ratingData?.rating ? Math.round(ratingData.rating) : 1200}
            </Text>
            <Text style={styles.statSub}>
              {ratingData?.winRate != null ? `${Math.round(ratingData.winRate)}% win rate` : "Active"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.statBox}
            activeOpacity={0.8}
            onPress={() => router.push("/wallet")}
          >
            <View style={styles.statIconRow}>
              <Wallet size={18} color={colors.primary} />
              <Text style={styles.statLabel}>Club Wallet</Text>
            </View>
            <Text style={styles.statValue}>
              {walletData?.wallet ? money(walletData.wallet.balance) : "₹0"}
            </Text>
            <Text
              style={[
                styles.statSub,
                (walletData?.pendingDues ?? 0) > 0 && { color: colors.danger }
              ]}
            >
              {(walletData?.pendingDues ?? 0) > 0
                ? `${money(walletData!.pendingDues)} Dues`
                : "No Dues Pending"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Nearby Clubs Bar */}
        {nearbyClubs.length > 0 && (
          <View style={styles.nearbySection}>
            <View style={styles.sectionHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MapPin size={18} color={colors.primary} />
                <Text style={styles.sectionTitle}>Nearby Clubs</Text>
              </View>
              <TouchableOpacity onPress={() => router.push("/clubs")}>
                <Text style={styles.seeAllText}>Search & Join →</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.nearbyScrollContent}
            >
              {nearbyClubs.map((club) => {
                const isCurrent = club.id === activeClubId;
                const isMember = club.membership?.status === "ACTIVE";
                const isPending = club.membership?.status === "PENDING";

                return (
                  <TouchableOpacity
                    key={club.id}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/clubs/${club.id}` as any)}
                  >
                    <Card
                      style={[
                        styles.nearbyCard,
                        isCurrent && styles.nearbyCardActive
                      ]}
                    >
                      <View style={styles.nearbyHeaderRow}>
                        <View style={styles.nearbyDistPill}>
                          <MapPin size={10} color={colors.primary} />
                          <Text style={styles.nearbyDistText}>
                            {club.distanceKm !== null ? `${club.distanceKm} km` : club.city || "Nearby"}
                          </Text>
                        </View>
                        <Badge label={club.subscriptionPlan} tone="primary" />
                      </View>

                      <Text style={styles.nearbyTitle} numberOfLines={1}>
                        {club.name}
                      </Text>
                      <Text style={styles.nearbySub} numberOfLines={1}>
                        {club.address || club.city || "Badminton Club"}
                      </Text>

                      <View style={styles.nearbyMetaRow}>
                        <Text style={styles.nearbyMetaText}>🏸 {club.courtCount} Courts</Text>
                        <Text style={styles.nearbyMetaText}>👥 {club.memberCount} Players</Text>
                      </View>

                      <View style={styles.nearbyBtnWrapper}>
                        {isCurrent ? (
                          <View style={styles.activePill}>
                            <CheckCircle2 size={12} color={colors.primary} />
                            <Text style={styles.activePillText}>Active Club</Text>
                          </View>
                        ) : isMember ? (
                          <TouchableOpacity
                            style={styles.switchBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              void switchClub(club.id);
                            }}
                          >
                            <Text style={styles.switchBtnText}>Switch</Text>
                          </TouchableOpacity>
                        ) : isPending ? (
                          <View style={styles.pendingPill}>
                            <Text style={styles.pendingPillText}>Pending</Text>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.joinBtn}
                            disabled={joiningClubId === club.id}
                            onPress={(e) => {
                              e.stopPropagation();
                              void handleJoinClub(club.id);
                            }}
                          >
                            {joiningClubId === club.id ? (
                              <ActivityIndicator size="small" color={colors.primaryForeground} />
                            ) : (
                              <Text style={styles.joinBtnText}>Join Club</Text>
                            )}
                          </TouchableOpacity>
                        )}
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Today's Schedule / Matches */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/matches")}>
            <Text style={styles.seeAllText}>View All</Text>
          </TouchableOpacity>
        </View>

        {todayMatchesList.length > 0 ? (
          todayMatchesList.map((m) => {
            const teamA = m.teams?.[0]?.players?.map((p) => p.name).join(" & ") || "TBD";
            const teamB = m.teams?.[1]?.players?.map((p) => p.name).join(" & ") || "TBD";
            return (
              <Card key={m.id} style={styles.matchCard}>
                <View style={styles.matchHeader}>
                  <View style={styles.matchCourtPill}>
                    <Clock size={12} color={colors.textMuted} />
                    <Text style={styles.matchCourtText}>
                      {m.court?.name ?? "Court 1"}
                    </Text>
                  </View>
                  <Badge label={m.status} tone={m.status === "LIVE" ? "danger" : "primary"} />
                </View>
                <View style={styles.matchTeams}>
                  <Text style={styles.matchTeamName}>{teamA}</Text>
                  <Text style={styles.matchVs}>vs</Text>
                  <Text style={styles.matchTeamName}>{teamB}</Text>
                </View>
              </Card>
            );
          })
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyEmoji}>🏸</Text>
            <Text style={styles.emptyTitle}>No Matches Scheduled Today</Text>
            <Text style={styles.emptySub}>
              Generate smart pairings or book a court to start playing.
            </Text>
            <View style={styles.emptyBtnRow}>
              <TouchableOpacity
                style={styles.emptyBtnPrimary}
                onPress={() => router.push("/matchmaking")}
              >
                <Sparkles size={14} color={colors.primaryForeground} />
                <Text style={styles.emptyBtnPrimaryText}>Matchmaking</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.emptyBtnSecondary}
                onPress={() => router.push("/(tabs)/courts")}
              >
                <Grid size={14} color={colors.text} />
                <Text style={styles.emptyBtnSecondaryText}>Book Court</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Quick Access Feature Grid */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Club Features</Text>
        </View>

        <View style={styles.featureGrid}>
          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/clubs")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <Building size={22} color={colors.primary} />
            </View>
            <Text style={styles.gridTitle}>Find Clubs</Text>
            <Text style={styles.gridSub}>Search & Join</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/groups")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(168, 85, 247, 0.15)" }]}>
              <Sparkles size={22} color="#a855f7" />
            </View>
            <Text style={styles.gridTitle}>Play Groups</Text>
            <Text style={styles.gridSub}>Cross-Club Squads</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/attendance")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <CalendarCheck size={22} color={colors.primary} />
            </View>
            <Text style={styles.gridTitle}>Attendance</Text>
            <Text style={styles.gridSub}>Roster & History</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/matchmaking")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(139, 92, 246, 0.15)" }]}>
              <Sparkles size={22} color="#a855f7" />
            </View>
            <Text style={styles.gridTitle}>Matchmaking</Text>
            <Text style={styles.gridSub}>AI Pairings</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/(tabs)/courts")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
              <Grid size={22} color="#3b82f6" />
            </View>
            <Text style={styles.gridTitle}>Courts</Text>
            <Text style={styles.gridSub}>Live Booking</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/(tabs)/leaderboards")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <Trophy size={22} color="#f59e0b" />
            </View>
            <Text style={styles.gridTitle}>Rankings</Text>
            <Text style={styles.gridSub}>ELO & Win Rate</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/wallet")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(16, 185, 129, 0.15)" }]}>
              <Wallet size={22} color={colors.primary} />
            </View>
            <Text style={styles.gridTitle}>Wallet</Text>
            <Text style={styles.gridSub}>Dues & Balance</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/coaching")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(236, 72, 153, 0.15)" }]}>
              <Brain size={22} color="#ec4899" />
            </View>
            <Text style={styles.gridTitle}>AI Coaching</Text>
            <Text style={styles.gridSub}>Drills & Insights</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/tournaments")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(245, 158, 11, 0.15)" }]}>
              <TrendingUp size={22} color="#f59e0b" />
            </View>
            <Text style={styles.gridTitle}>Tournaments</Text>
            <Text style={styles.gridSub}>Brackets & Cups</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/videos")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(99, 102, 241, 0.15)" }]}>
              <Video size={22} color="#6366f1" />
            </View>
            <Text style={styles.gridTitle}>Video CV</Text>
            <Text style={styles.gridSub}>Shot Analytics</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/members")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(59, 130, 246, 0.15)" }]}>
              <Users size={22} color="#3b82f6" />
            </View>
            <Text style={styles.gridTitle}>Members</Text>
            <Text style={styles.gridSub}>Club Directory</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.gridCard}
            onPress={() => router.push("/penalties")}
          >
            <View style={[styles.gridIconBox, { backgroundColor: "rgba(239, 68, 68, 0.15)" }]}>
              <Scale size={22} color={colors.danger} />
            </View>
            <Text style={styles.gridTitle}>Penalties</Text>
            <Text style={styles.gridSub}>Rules & Ledger</Text>
          </TouchableOpacity>
        </View>

        {/* Staff Admin Snapshot */}
        {isStaff && adminStats && (
          <View style={styles.adminSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Club Administration</Text>
              <Badge label="Staff Mode" tone="warning" />
            </View>

            <Card style={styles.adminCard}>
              <View style={styles.adminRow}>
                <View style={styles.adminStat}>
                  <Text style={styles.adminNum}>{adminStats.members.total}</Text>
                  <Text style={styles.adminLabel}>Members</Text>
                </View>
                <View style={styles.adminStat}>
                  <Text style={styles.adminNum}>{adminStats.attendance.presentToday}</Text>
                  <Text style={styles.adminLabel}>Present Today</Text>
                </View>
                <View style={styles.adminStat}>
                  <Text style={styles.adminNum}>
                    {adminStats.courts.available}/{adminStats.courts.total}
                  </Text>
                  <Text style={styles.adminLabel}>Courts Free</Text>
                </View>
                <View style={styles.adminStat}>
                  <Text style={[styles.adminNum, { color: colors.danger }]}>
                    {money(adminStats.finance.outstandingDues)}
                  </Text>
                  <Text style={styles.adminLabel}>Total Dues</Text>
                </View>
              </View>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder
  },
  headerLeft: {
    flex: 1,
    marginRight: 12
  },
  clubSelector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  clubBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center"
  },
  clubEmoji: {
    fontSize: 20
  },
  clubInfo: {
    flex: 1
  },
  clubNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  clubName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  clubRole: {
    fontSize: 11,
    color: colors.textMuted
  },
  notifBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  badgeCount: {
    position: "absolute",
    top: 6,
    right: 6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4
  },
  badgeText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "700"
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 32
  },
  greetingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end"
  },
  welcomeText: {
    fontSize: 13,
    color: colors.textMuted
  },
  playerName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text
  },
  checkInCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
    borderColor: colors.cardBorder
  },
  checkInCardDone: {
    backgroundColor: "rgba(16, 185, 129, 0.06)",
    borderColor: "rgba(16, 185, 129, 0.3)"
  },
  checkInLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1
  },
  checkInTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  checkInSub: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  checkInBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  checkInBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryForeground
  },
  statsRow: {
    flexDirection: "row",
    gap: 12
  },
  statBox: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  statIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600"
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.text
  },
  statSub: {
    fontSize: 11,
    color: colors.textSubtle,
    marginTop: 2
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  seeAllText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600"
  },
  matchCard: {
    gap: 8,
    padding: 14
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  matchCourtPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  matchCourtText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500"
  },
  matchTeams: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2
  },
  matchTeamName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flex: 1
  },
  matchVs: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSubtle,
    paddingHorizontal: 8
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 24,
    gap: 6
  },
  emptyEmoji: {
    fontSize: 32
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 240,
    marginBottom: 8
  },
  emptyBtnRow: {
    flexDirection: "row",
    gap: 10
  },
  emptyBtnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  emptyBtnPrimaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primaryForeground
  },
  emptyBtnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  emptyBtnSecondaryText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  gridCard: {
    width: "48%",
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "flex-start",
    gap: 4
  },
  gridIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  gridSub: {
    fontSize: 11,
    color: colors.textMuted
  },
  adminSection: {
    marginTop: 8,
    gap: 8
  },
  adminCard: {
    padding: 14
  },
  adminRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  adminStat: {
    alignItems: "center"
  },
  adminNum: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text
  },
  adminLabel: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2
  },
  nearbySection: {
    gap: 12
  },
  nearbyScrollContent: {
    gap: 12,
    paddingRight: 16
  },
  nearbyCard: {
    width: 240,
    padding: 14,
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    justifyContent: "space-between"
  },
  nearbyCardActive: {
    borderColor: colors.primary,
    borderWidth: 1.5
  },
  nearbyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8
  },
  nearbyDistPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12
  },
  nearbyDistText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary
  },
  nearbyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  nearbySub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  nearbyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10
  },
  nearbyMetaText: {
    fontSize: 11,
    color: colors.textMuted
  },
  nearbyBtnWrapper: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)"
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "rgba(16, 185, 129, 0.1)"
  },
  activePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary
  },
  switchBtn: {
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary
  },
  switchBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary
  },
  pendingPill: {
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.15)"
  },
  pendingPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#f59e0b"
  },
  joinBtn: {
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.primary
  },
  joinBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryForeground
  }
});

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
  Building,
  ArrowUpRight,
  User,
  Radio
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
      {/* Top Header per mobile_app_redesign.jpg */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.clubSelectorPill}
          onPress={openClubSwitcher}
          activeOpacity={0.7}
        >
          <View style={styles.clubActiveDot} />
          <Text style={styles.clubSelectorText} numberOfLines={1}>
            {activeClub?.name ?? "Metro Badminton Arena"}
          </Text>
          <ChevronDown size={14} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push("/(tabs)/notifications")}
            activeOpacity={0.7}
          >
            <Bell size={19} color={colors.text} />
            {unreadAlerts > 0 && (
              <View style={styles.badgeCount}>
                <Text style={styles.badgeText}>{unreadAlerts > 9 ? "9+" : unreadAlerts}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push("/(tabs)/profile")}
            activeOpacity={0.7}
          >
            <User size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero Player Profile Card per mobile_app_redesign.jpg */}
        <Card style={styles.playerHeroCard}>
          <View style={styles.playerHeroTop}>
            <View style={styles.playerAvatarRing}>
              <Text style={styles.playerAvatarInitials}>
                {user?.name
                  ? user.name
                      .split(" ")
                      .map((n) => n[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()
                  : "PS"}
              </Text>
              <View style={styles.playerOnlineDot} />
            </View>

            <View style={styles.playerHeroInfo}>
              <Text style={styles.playerHeroName} numberOfLines={1}>
                {user?.name || "Rahul Sharma"}
              </Text>
              <Text style={styles.playerHeroTier}>
                {activeMembership?.role === "OWNER"
                  ? "Club Director"
                  : activeMembership?.role === "ADMIN"
                  ? "Staff Admin"
                  : "Advanced Player"}
              </Text>
            </View>

            <Badge label="Active" tone="success" />
          </View>

          {/* Rating & Win Rate line */}
          <View style={styles.playerStatsRow}>
            <View style={styles.playerStatItem}>
              <Text style={styles.playerStatLabel}>Elo Rating</Text>
              <View style={styles.playerStatValueRow}>
                <Text style={styles.playerStatValue}>
                  {ratingData?.rating ? Math.round(ratingData.rating) : 1485}
                </Text>
                <Text style={styles.statArrowUp}>↑</Text>
              </View>
            </View>

            <View style={styles.playerStatDivider} />

            <View style={styles.playerStatItem}>
              <Text style={styles.playerStatLabel}>Win Rate</Text>
              <Text style={styles.playerStatValue}>
                {ratingData?.winRate != null ? `${Math.round(ratingData.winRate)}%` : "68%"}
              </Text>
            </View>
          </View>

          {/* Wallet Balance & Top-up line */}
          <View style={styles.walletBar}>
            <View>
              <Text style={styles.walletBarLabel}>Wallet Balance</Text>
              <Text style={styles.walletBarValue}>
                {walletData?.wallet ? money(walletData.wallet.balance) : "₹1,450"}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.topUpBtn}
              activeOpacity={0.8}
              onPress={() => router.push("/wallet")}
            >
              <Text style={styles.topUpBtnText}>Top-up</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Quick Check-in NFC Card per mobile_app_redesign.jpg */}
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={isCheckedIn || checkInMutation.isPending}
          onPress={() => checkInMutation.mutate()}
        >
          <Card style={[styles.nfcCard, isCheckedIn && styles.nfcCardDone]}>
            <View style={styles.nfcIconBox}>
              <Radio size={22} color={colors.primary} />
            </View>

            <View style={styles.nfcInfo}>
              <Text style={styles.nfcTitle}>
                {isCheckedIn ? "Presence Confirmed" : "Quick Check-in"}
              </Text>
              <Text style={styles.nfcSub}>
                {isCheckedIn
                  ? "Marked present for today's session"
                  : `Tap to Check-in | ${activeClub?.name || "Metro Arena"}`}
              </Text>
            </View>

            <View style={styles.nfcPulse}>
              {checkInMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : isCheckedIn ? (
                <CheckCircle2 size={20} color={colors.primary} />
              ) : (
                <Radio size={18} color={colors.primary} />
              )}
            </View>
          </Card>
        </TouchableOpacity>

        {/* Today's Court Booking Timeline per mobile_app_redesign.jpg */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeaderTitle}>Today's Court Booking</Text>
          <TouchableOpacity onPress={() => router.push("/(tabs)/courts")}>
            <Text style={styles.sectionHeaderLink}>Book Slot →</Text>
          </TouchableOpacity>
        </View>

        <Card style={styles.bookingTimelineCard}>
          <View style={styles.bookingTimelineBar}>
            <View style={styles.bookingDot} />
            <View style={styles.bookingLine} />
          </View>

          <View style={styles.bookingContent}>
            <Text style={styles.bookingTime}>7:00 PM - 8:30 PM</Text>
            <View style={styles.bookingBadgeRow}>
              <View style={styles.courtTag}>
                <Grid size={12} color={colors.textMuted} />
                <Text style={styles.courtTagText}>Court 4</Text>
              </View>
              <Badge label="Confirmed" tone="success" />
            </View>
          </View>
        </Card>

        {/* AI Matchmaking Recommendation per mobile_app_redesign.jpg */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeaderTitle}>AI Matchmaking</Text>
          <TouchableOpacity onPress={() => router.push("/matchmaking")}>
            <Text style={styles.sectionHeaderLink}>Optimize →</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => router.push("/matchmaking")}
        >
          <Card style={styles.matchmakingCard}>
            <View style={styles.matchmakingTop}>
              <Text style={styles.matchmakingTitle}>Doubles Pairing</Text>
              <ArrowUpRight size={16} color={colors.textMuted} />
            </View>

            <View style={styles.pairingRow}>
              <View style={styles.pairingPlayer}>
                <View style={styles.miniAvatar}>
                  <Text style={styles.miniAvatarText}>RS</Text>
                </View>
                <Text style={styles.pairingName}>{user?.name ? user.name.split(" ")[0] : "Rahul"}</Text>
              </View>

              <Text style={styles.pairingAmp}>&</Text>

              <View style={styles.pairingPlayer}>
                <View style={[styles.miniAvatar, { backgroundColor: "rgba(16, 185, 129, 0.2)" }]}>
                  <Text style={[styles.miniAvatarText, { color: colors.primary }]}>AN</Text>
                </View>
                <Text style={styles.pairingName}>Arjun Nair</Text>
              </View>
            </View>

            <View style={styles.compatibilityRow}>
              <Text style={styles.compatLabel}>Team Strength: <Text style={styles.compatValue}>1460</Text></Text>
              <Text style={styles.compatLabel}>Compatibility: <Text style={styles.compatScore}>94%</Text></Text>
            </View>

            {/* Compatibility Score Bar */}
            <View style={styles.compatBarTrack}>
              <View style={[styles.compatBarFill, { width: "94%" }]} />
            </View>
          </Card>
        </TouchableOpacity>

        {/* Club Features Quick Grid */}
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionHeaderTitle}>Club Services</Text>
        </View>

        <View style={styles.featureGrid}>
          {[
            { title: "Courts", sub: "Live Grid", icon: Grid, route: "/(tabs)/courts", color: colors.primary },
            { title: "Matches", sub: "Log & Play", icon: Trophy, route: "/(tabs)/matches", color: "#f59e0b" },
            { title: "Rankings", sub: "Club Elo", icon: TrendingUp, route: "/(tabs)/leaderboards", color: colors.primary },
            { title: "Wallet", sub: "Dues & Fines", icon: Wallet, route: "/wallet", color: "#10b981" },
            { title: "Squads", sub: "Play Groups", icon: Users, route: "/groups", color: "#60a5fa" },
            { title: "Coaching", sub: "AI Insights", icon: Brain, route: "/coaching", color: "#f43f5e" }
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <TouchableOpacity
                key={idx}
                style={styles.gridCard}
                activeOpacity={0.8}
                onPress={() => router.push(item.route as any)}
              >
                <View style={[styles.gridIconBox, { backgroundColor: "rgba(255, 255, 255, 0.05)" }]}>
                  <Icon size={20} color={item.color} />
                </View>
                <Text style={styles.gridTitle}>{item.title}</Text>
                <Text style={styles.gridSub}>{item.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Nearby Clubs Section */}
        {nearbyClubs.length > 0 && (
          <View style={styles.nearbySection}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionHeaderTitle}>Nearby Clubs</Text>
              <TouchableOpacity onPress={() => router.push("/clubs")}>
                <Text style={styles.sectionHeaderLink}>Browse All →</Text>
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

                return (
                  <TouchableOpacity
                    key={club.id}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/clubs/${club.id}` as any)}
                  >
                    <Card style={[styles.nearbyCard, isCurrent && styles.nearbyCardActive]}>
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
                        <Text style={styles.nearbyMetaText}>{club.courtCount} Courts</Text>
                        <Text style={styles.nearbyMetaDot}>•</Text>
                        <Text style={styles.nearbyMetaText}>{club.memberCount} Players</Text>
                      </View>

                      <View style={styles.nearbyBtnWrapper}>
                        {isCurrent ? (
                          <View style={styles.activePill}>
                            <CheckCircle2 size={12} color={colors.primary} />
                            <Text style={styles.activePillText}>Active Hub</Text>
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
                        ) : (
                          <TouchableOpacity
                            style={styles.joinBtn}
                            disabled={joiningClubId === club.id}
                            onPress={(e) => {
                              e.stopPropagation();
                              void handleJoinClub(club.id);
                            }}
                          >
                            <Text style={styles.joinBtnText}>Join Club</Text>
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
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder
  },
  clubSelectorPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 7,
    maxWidth: "70%"
  },
  clubActiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  clubSelectorText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: -0.2
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  notifBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  badgeCount: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3
  },
  badgeText: {
    color: "#ffffff",
    fontSize: 9,
    fontWeight: "700"
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center"
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40
  },
  playerHeroCard: {
    backgroundColor: colors.cardElevated,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 14
  },
  playerHeroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  playerAvatarRing: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  playerAvatarInitials: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  playerOnlineDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.cardElevated
  },
  playerHeroInfo: {
    flex: 1
  },
  playerHeroName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3
  },
  playerHeroTier: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 1
  },
  playerStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingVertical: 10,
    paddingHorizontal: 16
  },
  playerStatItem: {
    flex: 1
  },
  playerStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500"
  },
  playerStatValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2
  },
  playerStatValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  statArrowUp: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800"
  },
  playerStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.cardBorder,
    marginHorizontal: 12
  },
  walletBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4
  },
  walletBarLabel: {
    color: colors.textMuted,
    fontSize: 11
  },
  walletBarValue: {
    color: colors.text,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginTop: 1
  },
  topUpBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 6
  },
  topUpBtnText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600"
  },
  nfcCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    padding: 16,
    gap: 14
  },
  nfcCardDone: {
    borderColor: "rgba(16, 185, 129, 0.4)",
    backgroundColor: "rgba(16, 185, 129, 0.05)"
  },
  nfcIconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  nfcInfo: {
    flex: 1
  },
  nfcTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700"
  },
  nfcSub: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2
  },
  nfcPulse: {
    padding: 6
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4
  },
  sectionHeaderTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: -0.2
  },
  sectionHeaderLink: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "600"
  },
  bookingTimelineCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.cardElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 14
  },
  bookingTimelineBar: {
    alignItems: "center"
  },
  bookingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  bookingLine: {
    width: 2,
    height: 24,
    backgroundColor: colors.cardBorder,
    marginTop: 4
  },
  bookingContent: {
    flex: 1,
    gap: 6
  },
  bookingTime: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600"
  },
  bookingBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  courtTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4
  },
  courtTagText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "500"
  },
  matchmakingCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: 16,
    gap: 12
  },
  matchmakingTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  matchmakingTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  pairingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  pairingPlayer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  miniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center"
  },
  miniAvatarText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "700"
  },
  pairingName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600"
  },
  pairingAmp: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "500"
  },
  compatibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4
  },
  compatLabel: {
    color: colors.textMuted,
    fontSize: 11
  },
  compatValue: {
    color: colors.text,
    fontWeight: "700"
  },
  compatScore: {
    color: colors.primary,
    fontWeight: "700"
  },
  compatBarTrack: {
    height: 5,
    backgroundColor: colors.background,
    borderRadius: 3,
    overflow: "hidden"
  },
  compatBarFill: {
    height: "100%",
    backgroundColor: colors.primary,
    borderRadius: 3
  },
  featureGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  gridCard: {
    width: "31%",
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    padding: 12,
    alignItems: "center",
    gap: 4
  },
  gridIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4
  },
  gridTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "600"
  },
  gridSub: {
    color: colors.textMuted,
    fontSize: 10
  },
  nearbySection: {
    gap: 12,
    marginTop: 4
  },
  nearbyScrollContent: {
    gap: 12
  },
  nearbyCard: {
    width: 220,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    padding: 14,
    gap: 6
  },
  nearbyCardActive: {
    borderColor: colors.primary
  },
  nearbyHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  nearbyDistPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.background,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6
  },
  nearbyDistText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600"
  },
  nearbyTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  nearbySub: {
    color: colors.textMuted,
    fontSize: 11
  },
  nearbyMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 4
  },
  nearbyMetaText: {
    color: colors.textMuted,
    fontSize: 11
  },
  nearbyMetaDot: {
    color: colors.cardBorder
  },
  nearbyBtnWrapper: {
    marginTop: 4
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 10,
    paddingVertical: 7,
    gap: 5
  },
  activePillText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "600"
  },
  switchBtn: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: "center"
  },
  switchBtnText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: "600"
  },
  joinBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 7,
    alignItems: "center"
  },
  joinBtnText: {
    color: colors.primaryForeground,
    fontSize: 11,
    fontWeight: "700"
  }
});

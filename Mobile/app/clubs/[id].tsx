import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Building,
  MapPin,
  Users,
  Grid,
  Trophy,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  DollarSign,
  AlertCircle,
  Share2
} from "lucide-react-native";
import { api } from "../../src/lib/api";
import { useClub } from "../../src/context/club";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import type { ClubDetail } from "../../src/lib/types";

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeClub, switchClub, refreshClubContext } = useClub();

  const [isJoining, setIsJoining] = useState(false);

  const {
    data: club,
    isLoading,
    isError,
    refetch,
    isRefetching
  } = useQuery<ClubDetail>({
    queryKey: ["clubDetail", id],
    queryFn: () => api.clubs.get(id!),
    enabled: !!id
  });

  const joinMutation = useMutation({
    mutationFn: () => api.clubs.join(id!),
    onMutate: () => setIsJoining(true),
    onSuccess: async () => {
      Alert.alert(
        "Request Submitted",
        "Your request to join this club has been sent to the club administrators for approval."
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clubDetail", id] }),
        queryClient.invalidateQueries({ queryKey: ["clubsSearch"] }),
        queryClient.invalidateQueries({ queryKey: ["nearbyClubs"] }),
        refreshClubContext()
      ]);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to submit join request");
    },
    onSettled: () => setIsJoining(false)
  });

  if (isLoading) {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading club details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !club) {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerLoading}>
          <AlertCircle size={44} color={colors.danger} />
          <Text style={styles.errorTitle}>Club Not Found</Text>
          <Text style={styles.errorSubtitle}>
            Could not load details for this club. It may have been removed or is temporarily unavailable.
          </Text>
          <Button
            title="Go Back"
            variant="outline"
            onPress={() => router.back()}
            style={{ marginTop: 12 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const isMember = club.myMembership?.status === "ACTIVE";
  const isPending = club.myMembership?.status === "PENDING";
  const isCurrentActive = activeClub?.id === club.id;

  const attendanceSettings = club.settings?.attendance;
  const bookingSettings = club.settings?.booking;
  const membershipSettings = club.settings?.membership;

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {club.name}
        </Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {/* Hero Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIconWrap}>
              <Text style={styles.heroEmoji}>🏸</Text>
            </View>
            <View style={styles.heroTitles}>
              <View style={styles.badgeRow}>
                <Badge label="Verified Venue" tone="primary" />
                {isCurrentActive && <Badge label="Active Club" tone="success" />}
                {isMember && !isCurrentActive && <Badge label="Joined" tone="muted" />}
                {isPending && <Badge label="Pending" tone="warning" />}
              </View>
              <Text style={styles.clubTitle}>{club.name}</Text>
              <View style={styles.locationRow}>
                <MapPin size={14} color={colors.textMuted} />
                <Text style={styles.locationText}>
                  {club.address ? `${club.address}, ${club.city || ""}` : club.city || "Venue Location"}
                </Text>
              </View>
            </View>
          </View>

          {club.description ? (
            <Text style={styles.descriptionText}>{club.description}</Text>
          ) : null}
        </Card>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <Card style={styles.statCard}>
            <Grid size={22} color={colors.primary} />
            <Text style={styles.statNumber}>{club.counts.courts}</Text>
            <Text style={styles.statCaption}>Total Courts</Text>
          </Card>
          <Card style={styles.statCard}>
            <Users size={22} color="#3b82f6" />
            <Text style={styles.statNumber}>{club.counts.members}</Text>
            <Text style={styles.statCaption}>Active Players</Text>
          </Card>
          <Card style={styles.statCard}>
            <Trophy size={22} color="#f59e0b" />
            <Text style={styles.statNumber}>{club.counts.matches}</Text>
            <Text style={styles.statCaption}>Matches Played</Text>
          </Card>
        </View>

        {/* Facility & Operations Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Facility & Rules</Text>
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Clock size={18} color={colors.primary} />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Operating Hours</Text>
                <Text style={styles.infoSubtitle}>06:00 AM - 10:00 PM Daily</Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <Calendar size={18} color="#3b82f6" />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Booking Policy</Text>
                <Text style={styles.infoSubtitle}>
                  {bookingSettings?.cancellationWindowMinutes
                    ? `Cancellations permitted up to ${Math.round(
                        bookingSettings.cancellationWindowMinutes / 60
                      )}h prior`
                    : "Flexible slot scheduling & check-in"}
                </Text>
              </View>
            </View>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <View style={styles.infoIconBox}>
                <ShieldCheck size={18} color="#10b981" />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>Attendance & Check-in</Text>
                <Text style={styles.infoSubtitle}>
                  {attendanceSettings?.gpsRequired
                    ? "Geo-fenced GPS check-in required at venue"
                    : "Digital self check-in enabled for all members"}
                </Text>
              </View>
            </View>

            {membershipSettings?.monthlyFee ? (
              <>
                <View style={styles.divider} />
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <DollarSign size={18} color="#f59e0b" />
                  </View>
                  <View style={styles.infoTextWrap}>
                    <Text style={styles.infoTitle}>Monthly Membership</Text>
                    <Text style={styles.infoSubtitle}>
                      ₹{(membershipSettings.monthlyFee / 100).toLocaleString("en-IN")}/month
                    </Text>
                  </View>
                </View>
              </>
            ) : null}
          </Card>
        </View>

        {/* Administration Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Club Administration</Text>
          <Card style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.adminAvatar}>
                <Text style={styles.adminAvatarText}>
                  {club.owner.name ? club.owner.name[0].toUpperCase() : "O"}
                </Text>
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoTitle}>{club.owner.name}</Text>
                <Text style={styles.infoSubtitle}>Club Owner & Managing Director</Text>
              </View>
            </View>
          </Card>
        </View>
      </ScrollView>

      {/* Bottom Sticky Action Bar */}
      <View style={styles.bottomBar}>
        {isCurrentActive ? (
          <View style={styles.activeNotice}>
            <CheckCircle2 size={18} color={colors.primary} />
            <Text style={styles.activeNoticeText}>
              Currently viewing as your Active Club
            </Text>
          </View>
        ) : isMember ? (
          <Button
            title="Switch to this Club"
            variant="primary"
            onPress={async () => {
              await switchClub(club.id);
              Alert.alert("Club Switched", `Switched active club to ${club.name}`);
              router.push("/(tabs)");
            }}
          />
        ) : isPending ? (
          <View style={styles.pendingNotice}>
            <AlertCircle size={18} color={colors.warning} />
            <Text style={styles.pendingNoticeText}>
              Membership request submitted • Pending admin approval
            </Text>
          </View>
        ) : (
          <Button
            title="Request to Join Club"
            variant="primary"
            loading={isJoining}
            onPress={() => joinMutation.mutate()}
          />
        )}
      </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 12
  },
  headerRightPlaceholder: {
    width: 38
  },
  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    marginTop: 8
  },
  errorSubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    lineHeight: 18
  },
  scrollContent: {
    padding: 16,
    gap: 18,
    paddingBottom: 100
  },
  heroCard: {
    padding: 18,
    gap: 14
  },
  heroHeader: {
    flexDirection: "row",
    gap: 14
  },
  heroIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  heroEmoji: {
    fontSize: 30
  },
  heroTitles: {
    flex: 1,
    gap: 6
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  clubTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 24
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  locationText: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1
  },
  descriptionText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 12
  },
  statsGrid: {
    flexDirection: "row",
    gap: 10
  },
  statCard: {
    flex: 1,
    alignItems: "center",
    padding: 14,
    gap: 4
  },
  statNumber: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    marginTop: 4
  },
  statCaption: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600",
    textAlign: "center"
  },
  section: {
    gap: 8
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: 4
  },
  infoCard: {
    padding: 14
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  infoIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    alignItems: "center",
    justifyContent: "center"
  },
  infoTextWrap: {
    flex: 1
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text
  },
  infoSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginVertical: 12
  },
  adminAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  adminAvatarText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.primary
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder
  },
  activeNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12
  },
  activeNoticeText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary
  },
  pendingNotice: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    backgroundColor: colors.warningLight,
    borderRadius: 10
  },
  pendingNoticeText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.warning,
    textAlign: "center"
  }
});

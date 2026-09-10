import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ScrollView
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, Calendar, Clock, AlertCircle } from "lucide-react-native";
import { useAuth } from "../src/context/auth";
import { useClub } from "../src/context/club";
import { api } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import type { AttendanceRecord, AttendanceRosterRow } from "../src/lib/types";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted"> = {
  PRESENT: "success",
  LATE: "warning",
  ABSENT: "danger",
  EXCUSED: "muted"
};

export default function AttendanceScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeClubId, isStaff } = useClub();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"roster" | "history">("roster");

  // Today's Roster Query
  const {
    data: todayData,
    isLoading: todayLoading,
    isRefetching: todayRefetching,
    refetch: refetchToday
  } = useQuery({
    queryKey: ["attendanceToday", activeClubId],
    queryFn: () => api.attendance.today(activeClubId!),
    enabled: !!activeClubId
  });

  // My Attendance History Query
  const {
    data: historyData,
    isLoading: historyLoading,
    isRefetching: historyRefetching,
    refetch: refetchHistory
  } = useQuery<AttendanceRecord[]>({
    queryKey: ["attendanceHistory", activeClubId, user?.id],
    queryFn: () => api.attendance.history(activeClubId!, user!.id),
    enabled: !!activeClubId && !!user?.id && tab === "history"
  });

  // Check-In Mutation
  const checkInMutation = useMutation({
    mutationFn: () =>
      api.attendance.checkIn(activeClubId!, {
        method: "MANUAL"
      }),
    onSuccess: (data) => {
      const statusText = data?.status === "LATE" ? "Late" : "Present";
      Alert.alert("Success", `Attendance marked as ${statusText} for today!`);
      void queryClient.invalidateQueries({ queryKey: ["attendanceToday", activeClubId] });
      void queryClient.invalidateQueries({ queryKey: ["todayAttendance", activeClubId] });
      void queryClient.invalidateQueries({ queryKey: ["attendanceHistory", activeClubId] });
    },
    onError: (err: Error) => {
      Alert.alert("Check-In Error", err.message || "Failed to mark attendance.");
    }
  });

  const roster: AttendanceRosterRow[] =
    todayData?.rows ??
    todayData?.roster?.map((r) => ({
      userId: r.member.userId,
      name: r.member.user.name,
      photoUrl: r.member.user.photoUrl,
      status: r.record?.status ?? null,
      method: r.record?.method ?? null,
      checkInTime: r.record?.createdAt ?? null
    })) ??
    [];

  const myRecord = roster.find((r) => r.userId === user?.id);
  const isCheckedIn =
    myRecord?.status === "PRESENT" || myRecord?.status === "LATE" || myRecord?.status === "GUEST";
  const presentCount = roster.filter((r) => r.status === "PRESENT" || r.status === "LATE").length;

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
        <Text style={styles.topBarTitle}>Attendance</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={tab === "roster" ? todayRefetching : historyRefetching}
            onRefresh={() => (tab === "roster" ? refetchToday() : refetchHistory())}
            tintColor={colors.primary}
          />
        }
      >
        {/* Status Card */}
        <Card
          style={[
            styles.statusCard,
            isCheckedIn && styles.statusCardPresent
          ]}
        >
          <View style={styles.statusRow}>
            {isCheckedIn ? (
              <CheckCircle2 size={32} color={colors.primary} />
            ) : (
              <Calendar size={32} color={colors.textMuted} />
            )}
            <View style={{ flex: 1 }}>
              <Text style={styles.statusHeadline}>
                {isCheckedIn ? "You are Checked In!" : "Not Checked In Yet"}
              </Text>
              <Text style={styles.statusSub}>
                {isCheckedIn
                  ? `Marked as ${myRecord?.status} at ${
                      myRecord?.checkInTime
                        ? new Date(myRecord.checkInTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit"
                          })
                        : "Today"
                    }`
                  : "Tap below to record your presence for today's session"}
              </Text>
            </View>
          </View>

          {!isCheckedIn && (
            <TouchableOpacity
              style={styles.checkInActionBtn}
              onPress={() => checkInMutation.mutate()}
              disabled={checkInMutation.isPending}
            >
              {checkInMutation.isPending ? (
                <ActivityIndicator size="small" color={colors.primaryForeground} />
              ) : (
                <Text style={styles.checkInActionBtnText}>Self Check-In Now</Text>
              )}
            </TouchableOpacity>
          )}
        </Card>

        {/* Tab Switcher */}
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "roster" && styles.tabBtnActive]}
            onPress={() => setTab("roster")}
          >
            <Text style={[styles.tabBtnText, tab === "roster" && styles.tabBtnTextActive]}>
              Today's Roster ({presentCount}/{roster.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "history" && styles.tabBtnActive]}
            onPress={() => setTab("history")}
          >
            <Text style={[styles.tabBtnText, tab === "history" && styles.tabBtnTextActive]}>
              My History
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        {tab === "roster" ? (
          todayLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : roster.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>No roster found</Text>
            </View>
          ) : (
            <View style={styles.rosterList}>
              {roster.map((member) => {
                const status = member.status || "ABSENT";
                return (
                  <Card key={member.userId} style={styles.memberCard}>
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarChar}>
                        {member.name ? member.name[0].toUpperCase() : "U"}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{member.name}</Text>
                      <Text style={styles.checkInTimeText}>
                        {member.checkInTime
                          ? new Date(member.checkInTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit"
                            })
                          : "Not recorded"}
                      </Text>
                    </View>
                    <Badge
                      label={status}
                      tone={STATUS_TONE[status] ?? "muted"}
                    />
                  </Card>
                );
              })}
            </View>
          )
        ) : historyLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (historyData?.length ?? 0) === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No past records found</Text>
          </View>
        ) : (
          <View style={styles.historyList}>
            {historyData?.map((rec, i) => (
              <Card key={i} style={styles.historyCard}>
                <View style={styles.historyLeft}>
                  <Clock size={16} color={colors.primary} />
                  <Text style={styles.historyDay}>{rec.day}</Text>
                </View>
                <Badge
                  label={rec.status}
                  tone={STATUS_TONE[rec.status] ?? "muted"}
                />
              </Card>
            ))}
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
    gap: 16
  },
  statusCard: {
    padding: 18,
    gap: 16
  },
  statusCardPresent: {
    backgroundColor: "rgba(16, 185, 129, 0.05)",
    borderColor: "rgba(16, 185, 129, 0.3)"
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  statusHeadline: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text
  },
  statusSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  checkInActionBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center"
  },
  checkInActionBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryForeground
  },
  tabSwitcher: {
    flexDirection: "row",
    gap: 8
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center"
  },
  tabBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  rosterList: {
    gap: 10
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12
  },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.inputBg,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  avatarChar: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  memberInfo: {
    flex: 1
  },
  memberName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  checkInTimeText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  historyList: {
    gap: 10
  },
  historyCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14
  },
  historyLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  historyDay: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.text
  },
  center: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted
  }
});

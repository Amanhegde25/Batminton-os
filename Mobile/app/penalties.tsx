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
import { ArrowLeft, Scale, ShieldAlert, CheckCircle, Clock } from "lucide-react-native";
import { useClub } from "../src/context/club";
import { api } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import type { PenaltyItem, PenaltyRule } from "../src/lib/types";

function money(n: number): string {
  return `₹${(Math.abs(n) / 100).toLocaleString("en-IN")}`;
}

export default function PenaltiesScreen() {
  const router = useRouter();
  const { activeClubId } = useClub();
  const [tab, setTab] = useState<"ledger" | "rules">("ledger");

  const {
    data: penaltyData,
    isLoading: penaltiesLoading,
    isRefetching: penaltiesRefetching,
    refetch: refetchPenalties
  } = useQuery({
    queryKey: ["penalties", activeClubId],
    queryFn: () => api.penalties.list(activeClubId!),
    enabled: !!activeClubId && tab === "ledger"
  });

  const {
    data: rulesData,
    isLoading: rulesLoading,
    isRefetching: rulesRefetching,
    refetch: refetchRules
  } = useQuery<PenaltyRule[]>({
    queryKey: ["penaltyRules", activeClubId],
    queryFn: () => api.penalties.rules(activeClubId!),
    enabled: !!activeClubId && tab === "rules"
  });

  const penalties = penaltyData?.items ?? [];
  const rules = rulesData ?? [];

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
        <Text style={styles.topBarTitle}>Penalties & Rules</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "ledger" && styles.tabBtnActive]}
          onPress={() => setTab("ledger")}
        >
          <Text style={[styles.tabBtnText, tab === "ledger" && styles.tabBtnTextActive]}>
            Violations Ledger
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === "rules" && styles.tabBtnActive]}
          onPress={() => setTab("rules")}
        >
          <Text style={[styles.tabBtnText, tab === "rules" && styles.tabBtnTextActive]}>
            Club Rules & Fines
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "ledger" ? (
        <FlatList
          data={penalties}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={penaltiesRefetching}
              onRefresh={refetchPenalties}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <Card style={styles.penaltyCard}>
              <View style={styles.cardTop}>
                <View style={styles.userRow}>
                  <ShieldAlert size={16} color={colors.danger} />
                  <Text style={styles.userName}>{item.user?.name || "Member"}</Text>
                </View>
                <Text style={styles.penaltyAmount}>{money(item.amount)}</Text>
              </View>

              <Text style={styles.penaltyReason}>
                {item.reason || item.label || item.eventType.replace(/_/g, " ")}
              </Text>

              <View style={styles.cardBottom}>
                <Text style={styles.penaltyDate}>
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit"
                  })}
                </Text>
                <Badge
                  label={item.status}
                  tone={item.status === "PAID" ? "success" : "danger"}
                />
              </View>
            </Card>
          )}
          ListEmptyComponent={
            penaltiesLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={styles.center}>
                <CheckCircle size={40} color={colors.primary} />
                <Text style={styles.emptyTitle}>No penalties issued</Text>
                <Text style={styles.emptySub}>All members are adhering to club conduct rules.</Text>
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={rules}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={rulesRefetching}
              onRefresh={refetchRules}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }) => (
            <Card style={styles.ruleCard}>
              <View style={styles.ruleInfo}>
                <Text style={styles.ruleTitle}>{item.label}</Text>
                <Text style={styles.ruleEvent}>{item.eventType}</Text>
              </View>
              <View style={styles.ruleRight}>
                <Text style={styles.ruleAmount}>{money(item.amount)}</Text>
                <Badge
                  label={item.enabled ? "Active" : "Disabled"}
                  tone={item.enabled ? "primary" : "muted"}
                />
              </View>
            </Card>
          )}
          ListEmptyComponent={
            rulesLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : (
              <View style={styles.center}>
                <Text style={styles.emptyTitle}>No custom penalty rules defined</Text>
              </View>
            )
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
  tabSwitcher: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
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
  listContent: {
    padding: 16,
    gap: 10
  },
  penaltyCard: {
    padding: 14,
    gap: 8
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  userName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  penaltyAmount: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.danger
  },
  penaltyReason: {
    fontSize: 13,
    color: colors.textMuted
  },
  cardBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 8,
    marginTop: 4
  },
  penaltyDate: {
    fontSize: 11,
    color: colors.textSubtle
  },
  ruleCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14
  },
  ruleInfo: {
    flex: 1,
    gap: 2
  },
  ruleTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  ruleEvent: {
    fontSize: 11,
    color: colors.textMuted
  },
  ruleRight: {
    alignItems: "flex-end",
    gap: 4
  },
  ruleAmount: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text
  },
  center: {
    padding: 40,
    alignItems: "center",
    gap: 8
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  emptySub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center"
  }
});

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
import { ArrowLeft, Wallet, ArrowDownLeft, ArrowUpRight, AlertTriangle } from "lucide-react-native";
import { useClub } from "../src/context/club";
import { api } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import type { WalletSummary, WalletTxn } from "../src/lib/types";

function money(n: number): string {
  return `₹${(Math.abs(n) / 100).toLocaleString("en-IN")}`;
}

const TYPE_TONE: Record<string, "danger" | "warning" | "success" | "muted"> = {
  PENALTY: "danger",
  BOOKING_FEE: "warning",
  TOURNAMENT_FEE: "warning",
  REFUND: "success",
  MANUAL_CREDIT: "success",
  OPENING_CREDIT: "success"
};

export default function WalletScreen() {
  const router = useRouter();
  const { activeClubId } = useClub();
  const [page, setPage] = useState(1);

  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary
  } = useQuery<WalletSummary>({
    queryKey: ["walletSummary", activeClubId],
    queryFn: () => api.wallet.summary(activeClubId!),
    enabled: !!activeClubId
  });

  const {
    data: txnsData,
    isLoading: txnsLoading,
    isRefetching: txnsRefetching,
    refetch: refetchTxns
  } = useQuery({
    queryKey: ["walletTxns", activeClubId, page],
    queryFn: () => api.wallet.transactions(activeClubId!, page),
    enabled: !!activeClubId
  });

  const balance = summary?.wallet?.balance ?? 0;
  const pendingDues = summary?.pendingDues ?? 0;
  const txns = txnsData?.items ?? [];

  const onRefresh = async () => {
    await Promise.all([refetchSummary(), refetchTxns()]);
  };

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
        <Text style={styles.topBarTitle}>Club Wallet</Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={txns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={txnsRefetching}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.headerGroup}>
            {/* Main Balance Card */}
            <Card style={styles.heroCard}>
              <View style={styles.balanceHeader}>
                <View style={styles.walletIconBox}>
                  <Wallet size={20} color={colors.primary} />
                </View>
                <Text style={styles.balanceLabel}>Available Balance</Text>
              </View>

              <Text style={styles.balanceAmount}>{money(balance)}</Text>

              {pendingDues > 0 && (
                <View style={styles.duesWarning}>
                  <AlertTriangle size={14} color={colors.danger} />
                  <Text style={styles.duesText}>
                    Outstanding Dues: {money(pendingDues)}
                  </Text>
                </View>
              )}

              <View style={styles.flowRow}>
                <View style={styles.flowStat}>
                  <View style={styles.flowIconRow}>
                    <ArrowDownLeft size={14} color={colors.primary} />
                    <Text style={styles.flowLabel}>Month Credit</Text>
                  </View>
                  <Text style={[styles.flowVal, { color: colors.primary }]}>
                    +{money(summary?.monthCredit ?? 0)}
                  </Text>
                </View>

                <View style={styles.flowDivider} />

                <View style={styles.flowStat}>
                  <View style={styles.flowIconRow}>
                    <ArrowUpRight size={14} color={colors.danger} />
                    <Text style={styles.flowLabel}>Month Debit</Text>
                  </View>
                  <Text style={[styles.flowVal, { color: colors.danger }]}>
                    -{money(summary?.monthDebit ?? 0)}
                  </Text>
                </View>
              </View>
            </Card>

            <View style={styles.historyTitleRow}>
              <Text style={styles.historyTitle}>Transaction Ledger</Text>
              <Text style={styles.historySub}>All club payments and refunds</Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          const isDebit =
            item.type === "BOOKING_FEE" ||
            item.type === "PENALTY" ||
            item.type === "TOURNAMENT_FEE" ||
            item.amount < 0;

          return (
            <Card style={styles.txnCard}>
              <View style={styles.txnLeft}>
                <View
                  style={[
                    styles.txnIconBox,
                    {
                      backgroundColor: isDebit
                        ? "rgba(239, 68, 68, 0.12)"
                        : "rgba(16, 185, 129, 0.12)"
                    }
                  ]}
                >
                  {isDebit ? (
                    <ArrowUpRight size={16} color={colors.danger} />
                  ) : (
                    <ArrowDownLeft size={16} color={colors.primary} />
                  )}
                </View>

                <View style={styles.txnDetails}>
                  <Text style={styles.txnDesc}>
                    {item.description || item.type.replace(/_/g, " ")}
                  </Text>
                  <Text style={styles.txnDate}>
                    {new Date(item.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </Text>
                </View>
              </View>

              <View style={styles.txnRight}>
                <Text
                  style={[
                    styles.txnAmount,
                    { color: isDebit ? colors.danger : colors.primary }
                  ]}
                >
                  {isDebit ? "-" : "+"}
                  {money(item.amount)}
                </Text>
                <Badge
                  label={item.type.replace(/_/g, " ")}
                  tone={TYPE_TONE[item.type] ?? "muted"}
                />
              </View>
            </Card>
          );
        }}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyText}>No transactions yet</Text>
          </View>
        }
      />
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
  listContent: {
    padding: 16,
    gap: 10,
    paddingBottom: 32
  },
  headerGroup: {
    gap: 16,
    marginBottom: 6
  },
  heroCard: {
    padding: 20,
    gap: 12,
    backgroundColor: "rgba(16, 185, 129, 0.04)",
    borderColor: "rgba(16, 185, 129, 0.3)"
  },
  balanceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  walletIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  balanceLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600"
  },
  balanceAmount: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.text
  },
  duesWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.dangerLight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: "flex-start"
  },
  duesText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.danger
  },
  flowRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 12,
    marginTop: 4
  },
  flowStat: {
    flex: 1
  },
  flowIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  flowLabel: {
    fontSize: 11,
    color: colors.textMuted
  },
  flowVal: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2
  },
  flowDivider: {
    width: 1,
    backgroundColor: colors.cardBorder,
    marginHorizontal: 12
  },
  historyTitleRow: {
    marginTop: 4
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  historySub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  txnCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14
  },
  txnLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1
  },
  txnIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  txnDetails: {
    flex: 1
  },
  txnDesc: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text
  },
  txnDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  txnRight: {
    alignItems: "flex-end",
    gap: 4
  },
  txnAmount: {
    fontSize: 15,
    fontWeight: "800"
  },
  center: {
    padding: 40,
    alignItems: "center"
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted
  }
});

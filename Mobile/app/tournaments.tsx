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
  TextInput,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Trophy, Users, Plus, Calendar } from "lucide-react-native";
import { useClub } from "../src/context/club";
import { api } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import type { TournamentItem } from "../src/lib/types";

function money(n: number): string {
  if (n === 0) return "Free Entry";
  return `₹${(Math.abs(n) / 100).toLocaleString("en-IN")}`;
}

const STATUS_TONE: Record<string, "success" | "warning" | "primary" | "muted"> = {
  REGISTRATION: "primary",
  IN_PROGRESS: "warning",
  COMPLETED: "success"
};

export default function TournamentsScreen() {
  const router = useRouter();
  const { activeClubId, isStaff } = useClub();
  const queryClient = useQueryClient();

  const [createModal, setCreateModal] = useState(false);
  const [name, setName] = useState("");
  const [size, setSize] = useState(16);
  const [fee, setFee] = useState("500");

  const {
    data: tournaments,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<TournamentItem[]>({
    queryKey: ["tournaments", activeClubId],
    queryFn: () => api.tournaments.list(activeClubId!),
    enabled: !!activeClubId
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.tournaments.create(activeClubId!, {
        name,
        size: Number(size),
        fee: Math.round(Number(fee) * 100)
      }),
    onSuccess: () => {
      setCreateModal(false);
      setName("");
      Alert.alert("Success", "Tournament created successfully!");
      void queryClient.invalidateQueries({ queryKey: ["tournaments", activeClubId] });
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message || "Failed to create tournament.");
    }
  });

  const list = tournaments ?? [];

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
        <Text style={styles.topBarTitle}>Tournaments</Text>
        {isStaff ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setCreateModal(true)}
          >
            <Plus size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <FlatList
        data={list}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.tournamentCard}>
            <View style={styles.cardHeader}>
              <View style={styles.trophyIconBox}>
                <Trophy size={20} color="#f59e0b" />
              </View>
              <View style={styles.headerInfo}>
                <Text style={styles.tournamentName}>{item.name}</Text>
                <Text style={styles.tournamentMeta}>
                  {item.size} Draw Bracket • {money(item.fee)}
                </Text>
              </View>
              <Badge
                label={item.status.replace(/_/g, " ")}
                tone={STATUS_TONE[item.status] ?? "muted"}
              />
            </View>

            <View style={styles.cardFooter}>
              <View style={styles.participantRow}>
                <Users size={14} color={colors.textMuted} />
                <Text style={styles.participantText}>
                  {item._count?.participants ?? 0} / {item.size} Participants
                </Text>
              </View>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.center}>
              <Trophy size={42} color={colors.textSubtle} />
              <Text style={styles.emptyTitle}>No tournaments currently</Text>
              <Text style={styles.emptySub}>
                Club cups, seasonal leagues and knockout tournaments will be posted here.
              </Text>
            </View>
          )
        }
      />

      {/* Create Modal */}
      <Modal
        visible={createModal}
        transparent
        animationType="slide"
        onRequestClose={() => setCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Create Tournament</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Tournament Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Monsoon Doubles Cup"
                placeholderTextColor={colors.textSubtle}
                style={styles.modalInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Draw Size</Text>
              <View style={styles.sizeRow}>
                {[8, 16, 32].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.sizeBtn, size === s && styles.sizeBtnActive]}
                    onPress={() => setSize(s)}
                  >
                    <Text style={[styles.sizeBtnText, size === s && styles.sizeBtnTextActive]}>
                      {s} Players
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Entry Fee (₹)</Text>
              <TextInput
                value={fee}
                onChangeText={setFee}
                keyboardType="numeric"
                placeholder="500"
                placeholderTextColor={colors.textSubtle}
                style={styles.modalInput}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCreateModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => createMutation.mutate()}
                disabled={!name || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Create Tournament</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text
  },
  listContent: {
    padding: 16,
    gap: 12
  },
  tournamentCard: {
    padding: 16,
    gap: 12
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  trophyIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  headerInfo: {
    flex: 1
  },
  tournamentName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  tournamentMeta: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  participantText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600"
  },
  center: {
    padding: 40,
    alignItems: "center",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    borderTopWidth: 1,
    borderColor: colors.cardBorder,
    gap: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text
  },
  formGroup: {
    gap: 8
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text
  },
  modalInput: {
    backgroundColor: colors.inputBg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14
  },
  sizeRow: {
    flexDirection: "row",
    gap: 10
  },
  sizeBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  sizeBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  sizeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  sizeBtnTextActive: {
    color: colors.primary
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center"
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textMuted
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center"
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primaryForeground
  }
});

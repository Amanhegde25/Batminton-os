import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Users, Search, Plus, Mail } from "lucide-react-native";
import { useClub } from "../src/context/club";
import { api } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import type { MemberItem } from "../src/lib/types";

const ROLE_TONE: Record<string, "primary" | "warning" | "danger" | "muted"> = {
  OWNER: "danger",
  ADMIN: "warning",
  COACH: "primary",
  PLAYER: "muted"
};

const ROLES = ["PLAYER", "COACH", "ADMIN"];

export default function MembersScreen() {
  const router = useRouter();
  const { activeClubId, isStaff } = useClub();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("PLAYER");

  const {
    data: members,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<MemberItem[]>({
    queryKey: ["clubMembers", activeClubId, search],
    queryFn: () => api.members.list(activeClubId!, { q: search || undefined }),
    enabled: !!activeClubId
  });

  const addMutation = useMutation({
    mutationFn: () =>
      api.members.create(activeClubId!, {
        name: newName,
        email: newEmail,
        role: newRole
      }),
    onSuccess: () => {
      setAddModal(false);
      setNewName("");
      setNewEmail("");
      Alert.alert("Success", "Member added to club!");
      void queryClient.invalidateQueries({ queryKey: ["clubMembers", activeClubId] });
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message || "Failed to add member.");
    }
  });

  const list = members ?? [];

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
        <Text style={styles.topBarTitle}>Club Members</Text>
        {isStaff ? (
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => setAddModal(true)}
          >
            <Plus size={18} color={colors.primaryForeground} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Search size={16} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or email..."
          placeholderTextColor={colors.textSubtle}
          style={styles.searchInput}
        />
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
          <Card style={styles.memberCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarChar}>
                {item.name ? item.name[0].toUpperCase() : "U"}
              </Text>
            </View>

            <View style={styles.infoCol}>
              <Text style={styles.nameText}>{item.name}</Text>
              <View style={styles.emailRow}>
                <Mail size={12} color={colors.textMuted} />
                <Text style={styles.emailText} numberOfLines={1}>
                  {item.email}
                </Text>
              </View>
            </View>

            <Badge
              label={item.role}
              tone={ROLE_TONE[item.role] ?? "muted"}
            />
          </Card>
        )}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.center}>
              <Users size={40} color={colors.textSubtle} />
              <Text style={styles.emptyTitle}>No members found</Text>
            </View>
          )
        }
      />

      {/* Add Member Modal */}
      <Modal
        visible={addModal}
        transparent
        animationType="slide"
        onRequestClose={() => setAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Add New Member</Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Full Name</Text>
              <TextInput
                value={newName}
                onChangeText={setNewName}
                placeholder="Rohan Sharma"
                placeholderTextColor={colors.textSubtle}
                style={styles.modalInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Email Address</Text>
              <TextInput
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="rohan@example.com"
                placeholderTextColor={colors.textSubtle}
                style={styles.modalInput}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Club Role</Text>
              <View style={styles.roleRow}>
                {ROLES.map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleBtn, newRole === r && styles.roleBtnActive]}
                    onPress={() => setNewRole(r)}
                  >
                    <Text style={[styles.roleBtnText, newRole === r && styles.roleBtnTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setAddModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => addMutation.mutate()}
                disabled={!newName || !newEmail || addMutation.isPending}
              >
                {addMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Add Member</Text>
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
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.inputBg,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14
  },
  listContent: {
    padding: 16,
    gap: 10
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12
  },
  avatarCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarChar: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.primary
  },
  infoCol: {
    flex: 1,
    gap: 2
  },
  nameText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  emailText: {
    fontSize: 12,
    color: colors.textMuted
  },
  center: {
    padding: 40,
    alignItems: "center",
    gap: 8
  },
  emptyTitle: {
    fontSize: 14,
    color: colors.textMuted
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
  roleRow: {
    flexDirection: "row",
    gap: 10
  },
  roleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  roleBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  roleBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  roleBtnTextActive: {
    color: colors.primary,
    fontWeight: "700"
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

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Search,
  Users,
  Plus,
  Calendar,
  MapPin,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  X,
  Clock,
  Shield
} from "lucide-react-native";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/context/auth";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import type { PlayGroup } from "../../src/lib/types";

const SKILL_LEVELS = [
  { id: "ALL", label: "All Levels" },
  { id: "BEGINNER", label: "Beginner" },
  { id: "INTERMEDIATE", label: "Intermediate" },
  { id: "ADVANCED", label: "Advanced" }
];

export default function GroupsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"discover" | "my">("discover");
  const [searchQuery, setSearchQuery] = useState("");
  const [skillFilter, setSkillFilter] = useState("ALL");
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);

  // New Group Form State
  const [newName, setNewName] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newSkillLevel, setNewSkillLevel] = useState("ALL");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    data: groups = [],
    isLoading,
    isRefetching,
    refetch
  } = useQuery<PlayGroup[]>({
    queryKey: ["groupsList", activeTab, searchQuery],
    queryFn: () =>
      api.groups.list({
        myOnly: activeTab === "my",
        q: searchQuery.trim() || undefined
      })
  });

  const joinMutation = useMutation({
    mutationFn: (groupId: string) => api.groups.join(groupId),
    onMutate: (id) => setJoiningGroupId(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["groupsList"] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to join group");
    },
    onSettled: () => setJoiningGroupId(null)
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      name: string;
      city?: string;
      description?: string;
      skillLevel: string;
      isPublic: boolean;
    }) => api.groups.create(data),
    onMutate: () => setIsSubmitting(true),
    onSuccess: async (newGroup) => {
      setCreateModalVisible(false);
      setNewName("");
      setNewCity("");
      setNewDescription("");
      await queryClient.invalidateQueries({ queryKey: ["groupsList"] });
      router.push(`/groups/${newGroup.id}` as any);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to create group");
    },
    onSettled: () => setIsSubmitting(false)
  });

  const handleCreateGroup = () => {
    if (!newName.trim()) {
      Alert.alert("Required", "Please provide a name for your squad.");
      return;
    }
    createMutation.mutate({
      name: newName.trim(),
      city: newCity.trim() || undefined,
      description: newDescription.trim() || undefined,
      skillLevel: newSkillLevel,
      isPublic: true
    });
  };

  const filteredGroups = groups.filter((g) => {
    if (skillFilter === "ALL") return true;
    return g.skillLevel === skillFilter;
  });

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* Top Navigation */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Play Groups & Squads</Text>
          <Text style={styles.headerSubtitle}>
            Cross-club player communities & session meetups
          </Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => setCreateModalVisible(true)}
          activeOpacity={0.7}
        >
          <Plus size={18} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      {/* Tabs Switcher: Discover vs My Squads */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "discover" && styles.tabBtnActive]}
          onPress={() => setActiveTab("discover")}
          activeOpacity={0.7}
        >
          <Sparkles
            size={14}
            color={activeTab === "discover" ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "discover" && styles.tabBtnTextActive
            ]}
          >
            Discover Squads
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "my" && styles.tabBtnActive]}
          onPress={() => setActiveTab("my")}
          activeOpacity={0.7}
        >
          <Users
            size={14}
            color={activeTab === "my" ? colors.primary : colors.textMuted}
          />
          <Text
            style={[
              styles.tabBtnText,
              activeTab === "my" && styles.tabBtnTextActive
            ]}
          >
            My Squads
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search & Skill Level Filters */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Search size={16} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search squad name or city..."
            placeholderTextColor={colors.textSubtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.skillFilterRow}
        >
          {SKILL_LEVELS.map((lvl) => {
            const isSelected = skillFilter === lvl.id;
            return (
              <TouchableOpacity
                key={lvl.id}
                style={[
                  styles.skillPill,
                  isSelected && styles.skillPillActive
                ]}
                onPress={() => setSkillFilter(lvl.id)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.skillPillText,
                    isSelected && styles.skillPillTextActive
                  ]}
                >
                  {lvl.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Squads List */}
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Loading squads...</Text>
          </View>
        ) : filteredGroups.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Users size={36} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>
              {activeTab === "my" ? "You Haven't Joined Any Squads" : "No Squads Found"}
            </Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === "my"
                ? "Explore public squads in Discover, or tap '+' to create your own player group."
                : searchQuery
                ? `No squads match "${searchQuery}". Try a different search term.`
                : "Be the first to create a play group in your area!"}
            </Text>
            <Button
              title="Create a Squad"
              variant="primary"
              onPress={() => setCreateModalVisible(true)}
              style={{ marginTop: 12 }}
            />
          </Card>
        ) : (
          filteredGroups.map((group) => {
            const isMember = !!group.myMembership;
            const isLeader = group.myMembership?.role === "LEADER";
            const isJoining = joiningGroupId === group.id;

            return (
              <TouchableOpacity
                key={group.id}
                activeOpacity={0.8}
                onPress={() => router.push(`/groups/${group.id}` as any)}
              >
                <Card style={styles.groupCard}>
                  {/* Group Header */}
                  <View style={styles.groupCardTop}>
                    <View style={styles.groupIconBox}>
                      <Text style={styles.groupEmoji}>⚡</Text>
                    </View>
                    <View style={styles.groupMainInfo}>
                      <View style={styles.groupNameRow}>
                        <Text style={styles.groupName} numberOfLines={1}>
                          {group.name}
                        </Text>
                        {isLeader ? (
                          <Badge label="Leader" tone="primary" />
                        ) : isMember ? (
                          <Badge label="Member" tone="success" />
                        ) : null}
                      </View>
                      <View style={styles.groupMetaRow}>
                        {group.city && (
                          <View style={styles.metaItem}>
                            <MapPin size={12} color={colors.textMuted} />
                            <Text style={styles.metaText}>{group.city}</Text>
                          </View>
                        )}
                        <Badge
                          label={group.skillLevel}
                          tone={
                            group.skillLevel === "ADVANCED"
                              ? "danger"
                              : group.skillLevel === "INTERMEDIATE"
                              ? "warning"
                              : "muted"
                          }
                        />
                      </View>
                    </View>
                  </View>

                  {/* Description if present */}
                  {group.description && (
                    <Text style={styles.description} numberOfLines={2}>
                      {group.description}
                    </Text>
                  )}

                  {/* Upcoming session preview */}
                  {group.nextSession ? (
                    <View style={styles.nextSessionBox}>
                      <View style={styles.sessionHeaderRow}>
                        <Calendar size={13} color={colors.primary} />
                        <Text style={styles.sessionHeaderTitle}>
                          Next Session: {group.nextSession.title}
                        </Text>
                      </View>
                      <Text style={styles.sessionDetailText}>
                        📍 {group.nextSession.clubName} •{" "}
                        {new Date(group.nextSession.scheduledDate).toLocaleDateString(
                          undefined,
                          { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
                        )}{" "}
                        • {group.nextSession.confirmedRsvps}/{group.nextSession.maxPlayers} RSVP'd
                      </Text>
                    </View>
                  ) : null}

                  {/* Footer Stats & Actions */}
                  <View style={styles.cardFooter}>
                    <View style={styles.countsRow}>
                      <View style={styles.countItem}>
                        <Users size={13} color={colors.textMuted} />
                        <Text style={styles.countText}>
                          {group.memberCount} {group.memberCount === 1 ? "player" : "players"}
                        </Text>
                      </View>
                      <View style={styles.statDot} />
                      <View style={styles.countItem}>
                        <Clock size={13} color={colors.textMuted} />
                        <Text style={styles.countText}>
                          {group.totalSessions} {group.totalSessions === 1 ? "session" : "sessions"}
                        </Text>
                      </View>
                    </View>

                    {isMember ? (
                      <View style={styles.viewRow}>
                        <Text style={styles.viewText}>View Squad</Text>
                        <ChevronRight size={14} color={colors.textMuted} />
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.joinBtn}
                        disabled={isJoining}
                        onPress={(e) => {
                          e.stopPropagation();
                          joinMutation.mutate(group.id);
                        }}
                      >
                        {isJoining ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.joinBtnText}>Join Squad</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Create Squad Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create a Play Squad</Text>
              <TouchableOpacity
                onPress={() => setCreateModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Squad Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Bangalore Smashers, Weekend Warriors"
                  placeholderTextColor={colors.textSubtle}
                  value={newName}
                  onChangeText={setNewName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>City / Location</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Bangalore, Indiranagar"
                  placeholderTextColor={colors.textSubtle}
                  value={newCity}
                  onChangeText={setNewCity}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Skill Level</Text>
                <View style={styles.levelSelector}>
                  {SKILL_LEVELS.map((lvl) => {
                    const isSelected = newSkillLevel === lvl.id;
                    return (
                      <TouchableOpacity
                        key={lvl.id}
                        style={[
                          styles.levelPill,
                          isSelected && styles.levelPillActive
                        ]}
                        onPress={() => setNewSkillLevel(lvl.id)}
                      >
                        <Text
                          style={[
                            styles.levelPillText,
                            isSelected && styles.levelPillTextActive
                          ]}
                        >
                          {lvl.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Description</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="What is this squad about? When and where do you play?"
                  placeholderTextColor={colors.textSubtle}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <Button
                title="Create Squad"
                variant="primary"
                loading={isSubmitting}
                onPress={handleCreateGroup}
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
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
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
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
  headerTextWrap: {
    flex: 1
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  createBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center"
  },
  tabSwitcher: {
    flexDirection: "row",
    backgroundColor: colors.card,
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 4
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6
  },
  tabBtnActive: {
    backgroundColor: colors.primaryLight
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted
  },
  tabBtnTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  filterSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 13
  },
  skillFilterRow: {
    gap: 8,
    paddingVertical: 2
  },
  skillPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  skillPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  skillPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  skillPillTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  listContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40
  },
  centerLoading: {
    paddingVertical: 48,
    alignItems: "center",
    gap: 12
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted
  },
  emptyCard: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    textAlign: "center"
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: 6
  },
  emptySubtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 18
  },
  groupCard: {
    padding: 16,
    gap: 12
  },
  groupCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  groupIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  groupEmoji: {
    fontSize: 20
  },
  groupMainInfo: {
    flex: 1,
    gap: 4
  },
  groupNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  groupName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    flex: 1
  },
  groupMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted
  },
  description: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18
  },
  nextSessionBox: {
    backgroundColor: "rgba(16, 185, 129, 0.06)",
    borderColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    gap: 4
  },
  sessionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  sessionHeaderTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary
  },
  sessionDetailText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder
  },
  countsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  countItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  countText: {
    fontSize: 12,
    color: colors.textMuted
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textSubtle
  },
  viewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  viewText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600"
  },
  joinBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
    justifyContent: "center"
  },
  joinBtnText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: "700"
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center"
  },
  modalForm: {
    gap: 14,
    paddingBottom: 20
  },
  formGroup: {
    gap: 6
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted
  },
  formInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top"
  },
  levelSelector: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  levelPill: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  levelPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  levelPillText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600"
  },
  levelPillTextActive: {
    color: colors.primary,
    fontWeight: "700"
  }
});

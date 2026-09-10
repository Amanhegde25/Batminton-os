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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Users,
  Calendar,
  MessageSquare,
  Plus,
  MapPin,
  Clock,
  DollarSign,
  CheckCircle2,
  HelpCircle,
  XCircle,
  Send,
  X,
  Shield,
  LogOut,
  Sparkles
} from "lucide-react-native";
import { api } from "../../src/lib/api";
import { useAuth } from "../../src/context/auth";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import type { PlayGroupDetail } from "../../src/lib/types";

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeSection, setActiveSection] = useState<"sessions" | "wall" | "members">("sessions");
  const [sessionModalVisible, setSessionModalVisible] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // New Session form state
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionClubName, setSessionClubName] = useState("");
  const [sessionClubAddress, setSessionClubAddress] = useState("");
  const [sessionDate, setSessionDate] = useState("");
  const [sessionMaxPlayers, setSessionMaxPlayers] = useState("4");
  const [sessionCost, setSessionCost] = useState("");
  const [sessionNotes, setSessionNotes] = useState("");
  const [isSubmittingSession, setIsSubmittingSession] = useState(false);

  const {
    data: group,
    isLoading,
    isRefetching,
    refetch
  } = useQuery<PlayGroupDetail>({
    queryKey: ["groupDetail", id],
    queryFn: () => api.groups.get(id!),
    enabled: !!id
  });

  const joinMutation = useMutation({
    mutationFn: () => api.groups.join(id!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["groupDetail", id] }),
        queryClient.invalidateQueries({ queryKey: ["groupsList"] })
      ]);
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to join squad");
    }
  });

  const leaveMutation = useMutation({
    mutationFn: () => api.groups.leave(id!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["groupDetail", id] }),
        queryClient.invalidateQueries({ queryKey: ["groupsList"] })
      ]);
      router.back();
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to leave squad");
    }
  });

  const rsvpMutation = useMutation({
    mutationFn: ({ sessionId, status }: { sessionId: string; status: "YES" | "MAYBE" | "NO" }) =>
      api.groups.rsvp(id!, sessionId, status),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["groupDetail", id] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to update RSVP");
    }
  });

  const createSessionMutation = useMutation({
    mutationFn: (data: any) => api.groups.createSession(id!, data),
    onMutate: () => setIsSubmittingSession(true),
    onSuccess: async () => {
      setSessionModalVisible(false);
      setSessionTitle("");
      setSessionClubName("");
      setSessionClubAddress("");
      setSessionDate("");
      setSessionCost("");
      setSessionNotes("");
      await queryClient.invalidateQueries({ queryKey: ["groupDetail", id] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to create session");
    },
    onSettled: () => setIsSubmittingSession(false)
  });

  const postMutation = useMutation({
    mutationFn: (content: string) => api.groups.createPost(id!, content),
    onMutate: () => setIsPosting(true),
    onSuccess: async () => {
      setNewPostContent("");
      await queryClient.invalidateQueries({ queryKey: ["groupDetail", id] });
    },
    onError: (err: any) => {
      Alert.alert("Error", err.message || "Failed to post message");
    },
    onSettled: () => setIsPosting(false)
  });

  const handleScheduleSession = () => {
    if (!sessionTitle.trim() || !sessionClubName.trim()) {
      Alert.alert("Required", "Please provide a session title and venue / club name.");
      return;
    }
    const scheduled = sessionDate ? new Date(sessionDate) : new Date(Date.now() + 86400000);
    createSessionMutation.mutate({
      title: sessionTitle.trim(),
      clubName: sessionClubName.trim(),
      clubAddress: sessionClubAddress.trim() || undefined,
      scheduledDate: scheduled.toISOString(),
      maxPlayers: parseInt(sessionMaxPlayers, 10) || 4,
      costPerPlayer: sessionCost ? parseInt(sessionCost, 10) * 100 : undefined,
      notes: sessionNotes.trim() || undefined
    });
  };

  if (isLoading || !group) {
    return (
      <SafeAreaView edges={["top"]} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft size={20} color={colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading squad details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isMember = !!group.myMembership;
  const isLeader = group.myMembership?.role === "LEADER";

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {group.name}
        </Text>
        {isMember && !isLeader ? (
          <TouchableOpacity
            style={styles.leaveBtn}
            onPress={() => {
              Alert.alert("Leave Squad", "Are you sure you want to leave this squad?", [
                { text: "Cancel", style: "cancel" },
                { text: "Leave", style: "destructive", onPress: () => leaveMutation.mutate() }
              ]);
            }}
          >
            <LogOut size={16} color={colors.danger} />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 38 }} />
        )}
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
        {/* Squad Hero Banner */}
        <Card style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroIconBox}>
              <Text style={styles.heroEmoji}>⚡</Text>
            </View>
            <View style={styles.heroInfo}>
              <View style={styles.badgeRow}>
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
                {isLeader ? (
                  <Badge label="Leader" tone="primary" />
                ) : isMember ? (
                  <Badge label="Member" tone="success" />
                ) : null}
              </View>
              <Text style={styles.heroTitle}>{group.name}</Text>
              {group.city && (
                <View style={styles.locationRow}>
                  <MapPin size={12} color={colors.textMuted} />
                  <Text style={styles.locationText}>{group.city}</Text>
                </View>
              )}
            </View>
          </View>

          {group.description ? (
            <Text style={styles.heroDescription}>{group.description}</Text>
          ) : null}

          {/* Quick stats & join action */}
          <View style={styles.heroFooter}>
            <View style={styles.statChip}>
              <Users size={14} color={colors.primary} />
              <Text style={styles.statChipText}>
                {group.members.length} {group.members.length === 1 ? "Member" : "Members"}
              </Text>
            </View>
            <View style={styles.statChip}>
              <Calendar size={14} color="#3b82f6" />
              <Text style={styles.statChipText}>
                {group.sessions.length} {group.sessions.length === 1 ? "Session" : "Sessions"}
              </Text>
            </View>

            {!isMember && (
              <TouchableOpacity
                style={styles.heroJoinBtn}
                onPress={() => joinMutation.mutate()}
              >
                <Text style={styles.heroJoinBtnText}>Join Squad</Text>
              </TouchableOpacity>
            )}
          </View>
        </Card>

        {/* Segmented Section Navigation */}
        <View style={styles.sectionNav}>
          <TouchableOpacity
            style={[
              styles.sectionNavBtn,
              activeSection === "sessions" && styles.sectionNavBtnActive
            ]}
            onPress={() => setActiveSection("sessions")}
          >
            <Calendar
              size={15}
              color={activeSection === "sessions" ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.sectionNavText,
                activeSection === "sessions" && styles.sectionNavTextActive
              ]}
            >
              Sessions ({group.sessions.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sectionNavBtn,
              activeSection === "wall" && styles.sectionNavBtnActive
            ]}
            onPress={() => setActiveSection("wall")}
          >
            <MessageSquare
              size={15}
              color={activeSection === "wall" ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.sectionNavText,
                activeSection === "wall" && styles.sectionNavTextActive
              ]}
            >
              Squad Wall ({group.posts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.sectionNavBtn,
              activeSection === "members" && styles.sectionNavBtnActive
            ]}
            onPress={() => setActiveSection("members")}
          >
            <Users
              size={15}
              color={activeSection === "members" ? colors.primary : colors.textMuted}
            />
            <Text
              style={[
                styles.sectionNavText,
                activeSection === "members" && styles.sectionNavTextActive
              ]}
            >
              Players ({group.members.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* SECTION 1: SESSIONS */}
        {activeSection === "sessions" && (
          <View style={styles.sectionContainer}>
            {isMember && (
              <TouchableOpacity
                style={styles.scheduleSessionBanner}
                onPress={() => setSessionModalVisible(true)}
              >
                <Plus size={16} color={colors.primary} />
                <Text style={styles.scheduleBannerText}>Schedule a New Meetup Session</Text>
              </TouchableOpacity>
            )}

            {group.sessions.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Calendar size={32} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Sessions Scheduled</Text>
                <Text style={styles.emptySubtitle}>
                  Plan a session at any nearby badminton club and invite squad members to RSVP!
                </Text>
                {isMember && (
                  <Button
                    title="Schedule First Session"
                    variant="primary"
                    onPress={() => setSessionModalVisible(true)}
                    style={{ marginTop: 10 }}
                  />
                )}
              </Card>
            ) : (
              group.sessions.map((sess) => {
                const confirmedRsvps = sess.rsvps.filter((r) => r.status === "YES");
                const myRsvp = sess.rsvps.find((r) => r.userId === user?.id);
                const sessionDate = new Date(sess.scheduledDate);

                return (
                  <Card key={sess.id} style={styles.sessionCard}>
                    <View style={styles.sessionTopRow}>
                      <View style={styles.sessionDateBadge}>
                        <Text style={styles.sessionDateMonth}>
                          {sessionDate.toLocaleDateString(undefined, { month: "short" })}
                        </Text>
                        <Text style={styles.sessionDateDay}>
                          {sessionDate.getDate()}
                        </Text>
                      </View>
                      <View style={styles.sessionTitleWrap}>
                        <Text style={styles.sessionTitle}>{sess.title}</Text>
                        <View style={styles.sessionClubRow}>
                          <MapPin size={12} color={colors.primary} />
                          <Text style={styles.sessionClubName}>{sess.clubName}</Text>
                        </View>
                      </View>
                    </View>

                    {sess.notes ? (
                      <Text style={styles.sessionNotes}>{sess.notes}</Text>
                    ) : null}

                    {/* Session Specs Bar */}
                    <View style={styles.sessionSpecsBar}>
                      <View style={styles.specItem}>
                        <Clock size={12} color={colors.textMuted} />
                        <Text style={styles.specText}>
                          {sessionDate.toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit"
                          })}{" "}
                          ({sess.durationMinutes}m)
                        </Text>
                      </View>
                      <View style={styles.statDot} />
                      <View style={styles.specItem}>
                        <Users size={12} color={colors.textMuted} />
                        <Text style={styles.specText}>
                          {confirmedRsvps.length}/{sess.maxPlayers} Confirmed
                        </Text>
                      </View>
                      {sess.costPerPlayer ? (
                        <>
                          <View style={styles.statDot} />
                          <View style={styles.specItem}>
                            <DollarSign size={12} color={colors.textMuted} />
                            <Text style={styles.specText}>
                              ₹{(sess.costPerPlayer / 100).toLocaleString("en-IN")}
                            </Text>
                          </View>
                        </>
                      ) : null}
                    </View>

                    {/* RSVP Action Buttons (for squad members) */}
                    {isMember ? (
                      <View style={styles.rsvpSection}>
                        <Text style={styles.rsvpHeader}>Your RSVP:</Text>
                        <View style={styles.rsvpButtonsRow}>
                          <TouchableOpacity
                            style={[
                              styles.rsvpPill,
                              myRsvp?.status === "YES" && styles.rsvpPillYes
                            ]}
                            onPress={() =>
                              rsvpMutation.mutate({ sessionId: sess.id, status: "YES" })
                            }
                          >
                            <CheckCircle2
                              size={14}
                              color={myRsvp?.status === "YES" ? colors.primary : colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.rsvpPillText,
                                myRsvp?.status === "YES" && styles.rsvpPillTextYes
                              ]}
                            >
                              Going
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.rsvpPill,
                              myRsvp?.status === "MAYBE" && styles.rsvpPillMaybe
                            ]}
                            onPress={() =>
                              rsvpMutation.mutate({ sessionId: sess.id, status: "MAYBE" })
                            }
                          >
                            <HelpCircle
                              size={14}
                              color={myRsvp?.status === "MAYBE" ? "#f59e0b" : colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.rsvpPillText,
                                myRsvp?.status === "MAYBE" && styles.rsvpPillTextMaybe
                              ]}
                            >
                              Maybe
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.rsvpPill,
                              myRsvp?.status === "NO" && styles.rsvpPillNo
                            ]}
                            onPress={() =>
                              rsvpMutation.mutate({ sessionId: sess.id, status: "NO" })
                            }
                          >
                            <XCircle
                              size={14}
                              color={myRsvp?.status === "NO" ? colors.danger : colors.textMuted}
                            />
                            <Text
                              style={[
                                styles.rsvpPillText,
                                myRsvp?.status === "NO" && styles.rsvpPillTextNo
                              ]}
                            >
                              Can't Go
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* SECTION 2: SQUAD WALL / CHAT */}
        {activeSection === "wall" && (
          <View style={styles.sectionContainer}>
            {/* New Post Input */}
            {isMember ? (
              <Card style={styles.postComposerCard}>
                <TextInput
                  style={styles.postInput}
                  placeholder="Share a message or update with the squad..."
                  placeholderTextColor={colors.textSubtle}
                  value={newPostContent}
                  onChangeText={setNewPostContent}
                  multiline
                />
                <View style={styles.postActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.sendPostBtn,
                      !newPostContent.trim() && styles.sendPostBtnDisabled
                    ]}
                    disabled={!newPostContent.trim() || isPosting}
                    onPress={() => postMutation.mutate(newPostContent.trim())}
                  >
                    {isPosting ? (
                      <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                      <>
                        <Send size={13} color="#ffffff" />
                        <Text style={styles.sendPostText}>Post</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </Card>
            ) : null}

            {group.posts.length === 0 ? (
              <Card style={styles.emptyCard}>
                <MessageSquare size={32} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No Posts Yet</Text>
                <Text style={styles.emptySubtitle}>
                  Say hello and introduce yourself to the squad!
                </Text>
              </Card>
            ) : (
              group.posts.map((p) => {
                const postDate = new Date(p.createdAt);
                return (
                  <Card key={p.id} style={styles.postCard}>
                    <View style={styles.postHeader}>
                      <View style={styles.userAvatar}>
                        <Text style={styles.userAvatarText}>
                          {p.user.name ? p.user.name[0].toUpperCase() : "U"}
                        </Text>
                      </View>
                      <View style={styles.postUserInfo}>
                        <Text style={styles.postUserName}>{p.user.name}</Text>
                        <Text style={styles.postTime}>
                          {postDate.toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit"
                          })}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.postBody}>{p.content}</Text>
                  </Card>
                );
              })
            )}
          </View>
        )}

        {/* SECTION 3: MEMBERS */}
        {activeSection === "members" && (
          <View style={styles.sectionContainer}>
            {group.members.map((m) => (
              <Card key={m.id} style={styles.memberCard}>
                <View style={styles.memberAvatar}>
                  <Text style={styles.memberAvatarText}>
                    {m.user.name ? m.user.name[0].toUpperCase() : "U"}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName}>{m.user.name}</Text>
                    {m.role === "LEADER" ? (
                      <Badge label="Leader" tone="primary" />
                    ) : (
                      <Badge label="Member" tone="muted" />
                    )}
                  </View>
                  <Text style={styles.memberSkill}>
                    Skill: {m.user.skillLevel || "Intermediate"} • Joined{" "}
                    {new Date(m.joinedAt).toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric"
                    })}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Schedule Session Modal */}
      <Modal
        visible={sessionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSessionModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Squad Session</Text>
              <TouchableOpacity
                onPress={() => setSessionModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <X size={20} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalForm}>
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Session Title *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Saturday Evening Doubles"
                  placeholderTextColor={colors.textSubtle}
                  value={sessionTitle}
                  onChangeText={setSessionTitle}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Venue / Badminton Club Name *</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. Whitefield Badminton Academy"
                  placeholderTextColor={colors.textSubtle}
                  value={sessionClubName}
                  onChangeText={setSessionClubName}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Club Address</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="e.g. 100ft Road, Indiranagar"
                  placeholderTextColor={colors.textSubtle}
                  value={sessionClubAddress}
                  onChangeText={setSessionClubAddress}
                />
              </View>

              <View style={styles.formRow}>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Max Players</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="4"
                    placeholderTextColor={colors.textSubtle}
                    keyboardType="number-pad"
                    value={sessionMaxPlayers}
                    onChangeText={setSessionMaxPlayers}
                  />
                </View>
                <View style={[styles.formGroup, { flex: 1 }]}>
                  <Text style={styles.formLabel}>Cost / Player (₹)</Text>
                  <TextInput
                    style={styles.formInput}
                    placeholder="200"
                    placeholderTextColor={colors.textSubtle}
                    keyboardType="number-pad"
                    value={sessionCost}
                    onChangeText={setSessionCost}
                  />
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Notes or Guidelines</Text>
                <TextInput
                  style={[styles.formInput, styles.textArea]}
                  placeholder="Bring your own Yonex Mavis 350 shuttles..."
                  placeholderTextColor={colors.textSubtle}
                  value={sessionNotes}
                  onChangeText={setSessionNotes}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <Button
                title="Publish Session"
                variant="primary"
                loading={isSubmittingSession}
                onPress={handleScheduleSession}
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
  leaveBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center"
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    flex: 1,
    textAlign: "center",
    marginHorizontal: 10
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
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40
  },
  heroCard: {
    padding: 16,
    gap: 12
  },
  heroHeader: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  heroIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  heroEmoji: {
    fontSize: 22
  },
  heroInfo: {
    flex: 1,
    gap: 4
  },
  badgeRow: {
    flexDirection: "row",
    gap: 6
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  locationText: {
    fontSize: 12,
    color: colors.textMuted
  },
  heroDescription: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18
  },
  heroFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 10,
    gap: 8
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  statChipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500"
  },
  heroJoinBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8
  },
  heroJoinBtnText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: "700"
  },
  sectionNav: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 4
  },
  sectionNavBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6
  },
  sectionNavBtnActive: {
    backgroundColor: colors.primaryLight
  },
  sectionNavText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600"
  },
  sectionNavTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  sectionContainer: {
    gap: 12
  },
  scheduleSessionBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.2)",
    gap: 6
  },
  scheduleBannerText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700"
  },
  emptyCard: {
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    marginTop: 6
  },
  emptySubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: "center",
    paddingHorizontal: 24,
    lineHeight: 18
  },
  sessionCard: {
    padding: 14,
    gap: 10
  },
  sessionTopRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center"
  },
  sessionDateBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  sessionDateMonth: {
    fontSize: 9,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase"
  },
  sessionDateDay: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text
  },
  sessionTitleWrap: {
    flex: 1,
    gap: 2
  },
  sessionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  sessionClubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  sessionClubName: {
    fontSize: 12,
    color: colors.textMuted
  },
  sessionNotes: {
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: "rgba(255,255,255,0.02)",
    padding: 8,
    borderRadius: 6
  },
  sessionSpecsBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    gap: 8
  },
  specItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  specText: {
    fontSize: 11,
    color: colors.textMuted
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textSubtle
  },
  rsvpSection: {
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 8,
    gap: 6
  },
  rsvpHeader: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600"
  },
  rsvpButtonsRow: {
    flexDirection: "row",
    gap: 8
  },
  rsvpPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    gap: 4
  },
  rsvpPillYes: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  rsvpPillMaybe: {
    backgroundColor: colors.warningLight,
    borderColor: colors.warning
  },
  rsvpPillNo: {
    backgroundColor: colors.dangerLight,
    borderColor: colors.danger
  },
  rsvpPillText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: "600"
  },
  rsvpPillTextYes: {
    color: colors.primary,
    fontWeight: "700"
  },
  rsvpPillTextMaybe: {
    color: colors.warning,
    fontWeight: "700"
  },
  rsvpPillTextNo: {
    color: colors.danger,
    fontWeight: "700"
  },
  postComposerCard: {
    padding: 12,
    gap: 8
  },
  postInput: {
    color: colors.text,
    fontSize: 13,
    minHeight: 50,
    textAlignVertical: "top"
  },
  postActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  sendPostBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6
  },
  sendPostBtnDisabled: {
    opacity: 0.4
  },
  sendPostText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: "700"
  },
  postCard: {
    padding: 14,
    gap: 8
  },
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center"
  },
  userAvatarText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary
  },
  postUserInfo: {
    flex: 1
  },
  postUserName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text
  },
  postTime: {
    fontSize: 10,
    color: colors.textMuted
  },
  postBody: {
    fontSize: 13,
    color: colors.text,
    lineHeight: 18
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  memberAvatarText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  memberInfo: {
    flex: 1,
    gap: 2
  },
  memberNameRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  memberName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  memberSkill: {
    fontSize: 11,
    color: colors.textMuted
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
    gap: 12,
    paddingBottom: 20
  },
  formGroup: {
    gap: 6
  },
  formRow: {
    flexDirection: "row",
    gap: 12
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  formInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: colors.text,
    fontSize: 13
  },
  textArea: {
    minHeight: 50,
    textAlignVertical: "top"
  }
});

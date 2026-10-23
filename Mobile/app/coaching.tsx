import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
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
import {
  ArrowLeft,
  Award,
  Brain,
  Calendar,
  Clock,
  CheckCircle2,
  X,
  Target,
  Dumbbell,
  RefreshCw,
  Sparkles
} from "lucide-react-native";
import { useClub } from "../src/context/club";
import { api } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import {
  COACHING_LEVELS,
  COACHING_LEVEL_LABELS,
  COACHING_LEVEL_DESCRIPTIONS,
  type CoachingLevel
} from "../src/lib/constants";
import type { CoachItem, CoachingBookingItem, CoachingInsight } from "../src/lib/types";

function getUpcomingDays(count = 7) {
  const days: { dateStr: string; dayOfWeek: string; label: string }[] = [];
  const map = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  for (let i = 1; i <= count; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const dayOfWeek = map[d.getDay()];
    const label =
      i === 1
        ? "Tomorrow"
        : `${d.toLocaleDateString("en-US", { weekday: "short" })}, ${d.getDate()} ${d.toLocaleDateString("en-US", { month: "short" })}`;
    days.push({ dateStr, dayOfWeek, label });
  }
  return days;
}

export default function CoachingScreen() {
  const router = useRouter();
  const { activeClubId, isStaff } = useClub();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"coaches" | "sessions" | "ai">("coaches");

  // Global coaching level filter
  const [selectedGlobalLevel, setSelectedGlobalLevel] = useState<CoachingLevel>("BEGINNER");
  // Per-coach selected level state on cards
  const [coachSelectedLevels, setCoachSelectedLevels] = useState<Record<string, CoachingLevel>>({});

  // Booking Modal State
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState<CoachItem | null>(null);
  const [modalLevel, setModalLevel] = useState<CoachingLevel>("BEGINNER");
  const [modalDate, setModalDate] = useState("");
  const [modalSlot, setModalSlot] = useState("");
  const [modalNotes, setModalNotes] = useState("");

  const upcomingDays = getUpcomingDays(7);

  // 1. Fetch Coaches
  const {
    data: coachesData,
    isLoading: coachesLoading,
    isRefetching: coachesRefetching,
    refetch: refetchCoaches
  } = useQuery<{ items: CoachItem[] }>({
    queryKey: ["coachesList", activeClubId],
    queryFn: () => api.coaches.list(activeClubId!, true),
    enabled: !!activeClubId
  });

  // 2. Fetch Session Bookings
  const {
    data: bookingsData,
    isLoading: bookingsLoading,
    isRefetching: bookingsRefetching,
    refetch: refetchBookings
  } = useQuery<{ items: CoachingBookingItem[] }>({
    queryKey: ["coachesBookings", activeClubId],
    queryFn: () => api.coaches.bookings(activeClubId!, { myOnly: !isStaff }),
    enabled: !!activeClubId
  });

  // 3. Fetch AI Coaching Insights
  const {
    data: aiCoaching,
    isLoading: aiLoading,
    isRefetching: aiRefetching,
    refetch: refetchAi
  } = useQuery<CoachingInsight>({
    queryKey: ["coachingInsight", activeClubId],
    queryFn: () => api.coaching.get(activeClubId!),
    enabled: !!activeClubId && activeTab === "ai"
  });

  // Book session mutation
  const bookMutation = useMutation({
    mutationFn: (data: { coachId: string; sessionDate: string; timeSlot: string; level: CoachingLevel; notes?: string }) =>
      api.coaches.book(activeClubId!, data),
    onSuccess: () => {
      setBookingModalOpen(false);
      Alert.alert(
        "Session Booked! 🏸",
        `Your ${COACHING_LEVEL_LABELS[modalLevel]} coaching session has been confirmed.`
      );
      void queryClient.invalidateQueries({ queryKey: ["coachesBookings", activeClubId] });
      setActiveTab("sessions");
    },
    onError: (err: Error) => {
      Alert.alert("Booking Failed", err.message || "Failed to book coaching session.");
    }
  });

  // Cancel session mutation
  const cancelMutation = useMutation({
    mutationFn: (bookingId: string) => api.coaches.cancelBooking(activeClubId!, bookingId),
    onSuccess: () => {
      Alert.alert("Session Cancelled", "Your coaching booking was successfully cancelled.");
      void queryClient.invalidateQueries({ queryKey: ["coachesBookings", activeClubId] });
    },
    onError: (err: Error) => {
      Alert.alert("Error", err.message || "Failed to cancel booking.");
    }
  });

  const coachesList = coachesData?.items || [];
  const bookingsList = bookingsData?.items || [];

  function openBookingModal(coach: CoachItem) {
    setSelectedCoach(coach);
    const preferredLevel =
      coachSelectedLevels[coach.id] ||
      (coach.levels?.includes(selectedGlobalLevel) ? selectedGlobalLevel : coach.levels?.[0]) ||
      "BEGINNER";
    setModalLevel(preferredLevel);

    const defaultDay = upcomingDays.find((d) => coach.availableDays?.includes(d.dayOfWeek)) || upcomingDays[0];
    setModalDate(defaultDay.dateStr);
    setModalSlot(coach.availableTimeSlots?.[0] || "");
    setModalNotes("");
    setBookingModalOpen(true);
  }

  function handleConfirmBooking() {
    if (!selectedCoach || !activeClubId) return;
    if (!modalDate) {
      Alert.alert("Missing Date", "Please pick a session date.");
      return;
    }
    if (!modalSlot) {
      Alert.alert("Missing Slot", "Please select an available time slot.");
      return;
    }
    const chosenDayObj = upcomingDays.find((d) => d.dateStr === modalDate);
    if (chosenDayObj && !selectedCoach.availableDays?.includes(chosenDayObj.dayOfWeek)) {
      Alert.alert(
        "Coach Unavailable",
        `${selectedCoach.name} is not available on ${chosenDayObj.dayOfWeek}s. Working days: ${selectedCoach.availableDays?.join(", ")}`
      );
      return;
    }

    bookMutation.mutate({
      coachId: selectedCoach.id,
      sessionDate: modalDate,
      timeSlot: modalSlot,
      level: modalLevel,
      notes: modalNotes.trim() || undefined
    });
  }

  const isRefreshing = coachesRefetching || bookingsRefetching || aiRefetching;
  const onRefresh = () => {
    void refetchCoaches();
    void refetchBookings();
    if (activeTab === "ai") void refetchAi();
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
        <Text style={styles.topBarTitle}>Coaching & Training</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={onRefresh}
          activeOpacity={0.7}
        >
          <RefreshCw size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "coaches" && styles.tabBtnActive]}
          onPress={() => setActiveTab("coaches")}
        >
          <Award size={15} color={activeTab === "coaches" ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === "coaches" && styles.tabTextActive]}>
            Book Coach ({coachesList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "sessions" && styles.tabBtnActive]}
          onPress={() => setActiveTab("sessions")}
        >
          <Calendar size={15} color={activeTab === "sessions" ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === "sessions" && styles.tabTextActive]}>
            Sessions ({bookingsList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "ai" && styles.tabBtnActive]}
          onPress={() => setActiveTab("ai")}
        >
          <Brain size={15} color={activeTab === "ai" ? "#ec4899" : colors.textMuted} />
          <Text style={[styles.tabText, activeTab === "ai" && styles.tabTextActive]}>
            AI Lab
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* ================= TAB 1: BOOK A COACH ================= */}
        {activeTab === "coaches" && (
          <View style={styles.section}>
            {/* Global Coaching Level Selector Banner */}
            <Card style={styles.levelFilterCard}>
              <View style={styles.levelFilterHeader}>
                <Award size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.levelFilterTitle}>Select Coaching Level to View Fee</Text>
                  <Text style={styles.levelFilterSub}>
                    Hourly fee is set per level by club admin. You will see the price of only your chosen level.
                  </Text>
                </View>
              </View>

              <View style={styles.levelPillsRow}>
                {COACHING_LEVELS.map((lvl) => {
                  const isSelected = selectedGlobalLevel === lvl;
                  return (
                    <TouchableOpacity
                      key={lvl}
                      style={[styles.levelPill, isSelected && styles.levelPillActive]}
                      onPress={() => {
                        setSelectedGlobalLevel(lvl);
                        const updated: Record<string, CoachingLevel> = {};
                        coachesList.forEach((c) => {
                          if (c.levels?.includes(lvl)) updated[c.id] = lvl;
                        });
                        setCoachSelectedLevels(updated);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.levelPillText, isSelected && styles.levelPillTextActive]}>
                        {COACHING_LEVEL_LABELS[lvl]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </Card>

            {coachesLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading coaches roster...</Text>
              </View>
            ) : coachesList.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Award size={40} color={colors.textSubtle} />
                <Text style={styles.emptyTitle}>No Coaches Available Yet</Text>
                <Text style={styles.emptySub}>
                  Club administration hasn't added certified coaches or training schedules to the club roster yet.
                </Text>
              </Card>
            ) : (
              <View style={styles.coachesList}>
                {coachesList.map((coach) => {
                  const activeLevel =
                    coachSelectedLevels[coach.id] ||
                    (coach.levels?.includes(selectedGlobalLevel) ? selectedGlobalLevel : coach.levels?.[0]) ||
                    "BEGINNER";
                  const isOffered = coach.levels?.includes(activeLevel) ?? true;
                  const feePaise = isOffered
                    ? coach.pricing?.[activeLevel] !== undefined
                      ? coach.pricing[activeLevel]
                      : coach.hourlyFee
                    : null;
                  const feeRupees = feePaise !== null ? Math.round(feePaise / 100) : null;

                  return (
                    <Card key={coach.id} style={styles.coachCard}>
                      <View style={styles.coachHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.coachName}>{coach.name}</Text>
                          {coach.title && <Text style={styles.coachTitle}>{coach.title}</Text>}
                        </View>
                        {feeRupees !== null ? (
                          <View style={styles.priceBadgeBox}>
                            <Badge label={`₹${feeRupees} / hr`} tone="primary" />
                            <Text style={styles.priceSubText}>{COACHING_LEVEL_LABELS[activeLevel]}</Text>
                          </View>
                        ) : (
                          <Badge label="Not offered at this level" tone="muted" />
                        )}
                      </View>

                      {coach.bio && <Text style={styles.coachBio}>{coach.bio}</Text>}

                      {/* Level Selector on the Coach Card */}
                      <View style={styles.cardLevelSelector}>
                        <View style={styles.cardLevelHeader}>
                          <Text style={styles.cardLevelLabel}>Choose Coaching Level:</Text>
                          {feeRupees !== null && (
                            <Text style={styles.cardLevelFeeText}>
                              ₹{feeRupees} / session
                            </Text>
                          )}
                        </View>

                        <View style={styles.cardLevelGrid}>
                          {COACHING_LEVELS.map((lvl) => {
                            const offered = coach.levels?.includes(lvl) ?? true;
                            const isSelected = activeLevel === lvl;
                            return (
                              <TouchableOpacity
                                key={lvl}
                                disabled={!offered}
                                style={[
                                  styles.cardLevelBtn,
                                  isSelected && styles.cardLevelBtnActive,
                                  !offered && styles.cardLevelBtnDisabled
                                ]}
                                onPress={() => setCoachSelectedLevels((prev) => ({ ...prev, [coach.id]: lvl }))}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.cardLevelBtnText,
                                    isSelected && styles.cardLevelBtnTextActive,
                                    !offered && styles.cardLevelBtnTextDisabled
                                  ]}
                                >
                                  {COACHING_LEVEL_LABELS[lvl]}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        <Text style={styles.cardLevelDesc}>
                          {COACHING_LEVEL_DESCRIPTIONS[activeLevel]}
                        </Text>
                      </View>

                      {/* Timings & Days */}
                      <View style={styles.timingCard}>
                        <View style={styles.timingRow}>
                          <Calendar size={13} color={colors.primary} />
                          <Text style={styles.timingLabel}>Days:</Text>
                          <Text style={styles.timingVal}>
                            {coach.availableDays?.map((d) => d.slice(0, 3)).join(" • ") || "All days"}
                          </Text>
                        </View>
                        <View style={styles.timingRow}>
                          <Clock size={13} color={colors.primary} />
                          <Text style={styles.timingLabel}>Slots:</Text>
                          <Text style={styles.timingVal} numberOfLines={1}>
                            {coach.availableTimeSlots?.slice(0, 3).join(", ") || "Standard hours"}
                            {(coach.availableTimeSlots?.length || 0) > 3 ? "..." : ""}
                          </Text>
                        </View>
                      </View>

                      {/* Action */}
                      <TouchableOpacity
                        style={[styles.bookBtn, !isOffered && styles.bookBtnDisabled]}
                        disabled={!isOffered}
                        onPress={() => openBookingModal(coach)}
                        activeOpacity={0.8}
                      >
                        <Calendar size={15} color={colors.primaryForeground} />
                        <Text style={styles.bookBtnText}>
                          Book {COACHING_LEVEL_LABELS[activeLevel]} Session
                        </Text>
                      </TouchableOpacity>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ================= TAB 2: MY SESSIONS ================= */}
        {activeTab === "sessions" && (
          <View style={styles.section}>
            {bookingsLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={styles.loadingText}>Loading coaching sessions...</Text>
              </View>
            ) : bookingsList.length === 0 ? (
              <Card style={styles.emptyCard}>
                <Calendar size={40} color={colors.textSubtle} />
                <Text style={styles.emptyTitle}>No Sessions Booked</Text>
                <Text style={styles.emptySub}>
                  You haven't scheduled any 1-on-1 or group coaching sessions yet. Pick a coach to schedule training!
                </Text>
                <TouchableOpacity
                  style={[styles.bookBtn, { marginTop: 12 }]}
                  onPress={() => setActiveTab("coaches")}
                >
                  <Text style={styles.bookBtnText}>Discover Coaches</Text>
                </TouchableOpacity>
              </Card>
            ) : (
              <View style={styles.sessionsList}>
                {bookingsList.map((booking) => (
                  <Card key={booking.id} style={styles.sessionCard}>
                    <View style={styles.sessionHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.sessionCoach}>{booking.coachName}</Text>
                        <View style={styles.sessionLevelBadgeRow}>
                          <Badge
                            label={`${COACHING_LEVEL_LABELS[booking.level] || booking.level} Level`}
                            tone={
                              booking.level === "BEGINNER"
                                ? "primary"
                                : booking.level === "INTERMEDIATE"
                                ? "warning"
                                : "primary"
                            }
                          />
                        </View>
                      </View>
                      <Badge
                        label={booking.status}
                        tone={
                          booking.status === "CONFIRMED"
                            ? "primary"
                            : booking.status === "COMPLETED"
                            ? "success"
                            : "danger"
                        }
                      />
                    </View>

                    <View style={styles.sessionMetaGrid}>
                      <View style={styles.sessionMetaItem}>
                        <Calendar size={13} color={colors.textMuted} />
                        <Text style={styles.sessionMetaText}>{booking.sessionDate}</Text>
                      </View>
                      <View style={styles.sessionMetaItem}>
                        <Clock size={13} color={colors.textMuted} />
                        <Text style={styles.sessionMetaText}>{booking.timeSlot}</Text>
                      </View>
                      <View style={styles.sessionMetaItem}>
                        <Award size={13} color={colors.primary} />
                        <Text style={[styles.sessionMetaText, { color: colors.primary, fontWeight: "700" }]}>
                          ₹{Math.round(booking.fee / 100)}
                        </Text>
                      </View>
                    </View>

                    {booking.notes && (
                      <Text style={styles.sessionNotes}>"{booking.notes}"</Text>
                    )}

                    {booking.status === "CONFIRMED" && (
                      <View style={styles.sessionActionRow}>
                        <TouchableOpacity
                          style={styles.cancelBtn}
                          onPress={() => {
                            Alert.alert("Cancel Session", "Are you sure you want to cancel this coaching session?", [
                              { text: "No", style: "cancel" },
                              { text: "Yes, Cancel", style: "destructive", onPress: () => cancelMutation.mutate(booking.id) }
                            ]);
                          }}
                        >
                          <Text style={styles.cancelBtnText}>Cancel Session</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ================= TAB 3: AI LAB ================= */}
        {activeTab === "ai" && (
          <View style={styles.section}>
            {aiLoading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#ec4899" />
                <Text style={styles.loadingText}>Synthesizing match analytics...</Text>
              </View>
            ) : !aiCoaching ? (
              <Card style={styles.emptyCard}>
                <Brain size={44} color="#ec4899" />
                <Text style={styles.emptyTitle}>AI Coach Unavailable</Text>
                <Text style={styles.emptySub}>
                  Play more matches to generate personalized algorithmic coaching insights and training drills.
                </Text>
              </Card>
            ) : (
              <>
                <Card style={styles.heroCard}>
                  <View style={styles.heroHeader}>
                    <View style={styles.brainIconBox}>
                      <Brain size={24} color="#ec4899" />
                    </View>
                    <View style={styles.heroHeaderRight}>
                      <Badge
                        label={`${Math.round(aiCoaching.confidence * 100)}% Confidence`}
                        tone="primary"
                      />
                      <Text style={styles.providerText}>Engine: {aiCoaching.provider}</Text>
                    </View>
                  </View>

                  <Text style={styles.headline}>{aiCoaching.headline}</Text>
                  <Text style={styles.summaryText}>{aiCoaching.summary}</Text>
                </Card>

                {aiCoaching.focusAreas && aiCoaching.focusAreas.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <Target size={18} color={colors.primary} />
                      <Text style={styles.sectionTitle}>Key Focus Areas</Text>
                    </View>
                    <View style={styles.focusGrid}>
                      {aiCoaching.focusAreas.map((area, idx) => (
                        <View key={idx} style={styles.focusPill}>
                          <Text style={styles.focusPillDot}>•</Text>
                          <Text style={styles.focusPillText}>{area}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                {aiCoaching.drills && aiCoaching.drills.length > 0 && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeaderRow}>
                      <Dumbbell size={18} color="#f59e0b" />
                      <Text style={styles.sectionTitle}>Recommended Drills</Text>
                    </View>
                    <View style={styles.drillsList}>
                      {aiCoaching.drills.map((drill, idx) => (
                        <Card key={idx} style={styles.drillCard}>
                          <View style={styles.drillNumBox}>
                            <Text style={styles.drillNumText}>{idx + 1}</Text>
                          </View>
                          <Text style={styles.drillText}>{drill}</Text>
                        </Card>
                      ))}
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      {/* ================= BOOKING MODAL ================= */}
      {selectedCoach && (() => {
        const modalCoachFee = Math.round(
          ((selectedCoach.pricing?.[modalLevel] !== undefined
            ? selectedCoach.pricing[modalLevel]
            : selectedCoach.hourlyFee) || 0) / 100
        );
        const isLevelOffered = selectedCoach.levels?.includes(modalLevel) ?? true;
        const chosenDayObj = upcomingDays.find((d) => d.dateStr === modalDate);
        const isDayAvailable = chosenDayObj
          ? selectedCoach.availableDays?.includes(chosenDayObj.dayOfWeek)
          : false;

        return (
          <Modal
            visible={bookingModalOpen}
            animationType="slide"
            transparent
            onRequestClose={() => setBookingModalOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                {/* Modal Header */}
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>Book Coaching Session</Text>
                    <Text style={styles.modalCoachSub}>{selectedCoach.name}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.modalCloseBtn}
                    onPress={() => setBookingModalOpen(false)}
                  >
                    <X size={18} color={colors.text} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalBody} contentContainerStyle={{ gap: 16, paddingBottom: 30 }}>
                  {/* Fee Banner: Strictly shows ONLY the selected level's price */}
                  <View style={styles.modalFeeBanner}>
                    <View>
                      <Text style={styles.modalFeeLevelTitle}>
                        {COACHING_LEVEL_LABELS[modalLevel]} Coaching
                      </Text>
                      <Text style={styles.modalFeeSubText}>
                        Session fee for chosen level
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.modalFeeAmount}>₹{modalCoachFee}</Text>
                      <Text style={styles.modalFeePerHour}>per session</Text>
                    </View>
                  </View>

                  {/* 1. Coaching Level Selection (Required) */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>1. Select Coaching Level (Required)</Text>
                    <Text style={styles.modalSectionHelper}>
                      Pick your skill tier. Only the rate for the selected tier is charged.
                    </Text>

                    <View style={styles.modalLevelCardsGrid}>
                      {COACHING_LEVELS.map((lvl) => {
                        const offered = selectedCoach.levels?.includes(lvl) ?? true;
                        const isSelected = modalLevel === lvl;
                        return (
                          <TouchableOpacity
                            key={lvl}
                            disabled={!offered}
                            style={[
                              styles.modalLevelCard,
                              isSelected && styles.modalLevelCardActive,
                              !offered && styles.modalLevelCardDisabled
                            ]}
                            onPress={() => setModalLevel(lvl)}
                            activeOpacity={0.7}
                          >
                            <View style={styles.modalLevelCardTop}>
                              <Text
                                style={[
                                  styles.modalLevelCardName,
                                  isSelected && styles.modalLevelCardNameActive,
                                  !offered && styles.modalLevelCardNameDisabled
                                ]}
                              >
                                {COACHING_LEVEL_LABELS[lvl]}
                              </Text>
                              {isSelected && <CheckCircle2 size={14} color={colors.primary} />}
                            </View>
                            <Text style={styles.modalLevelCardDesc}>
                              {COACHING_LEVEL_DESCRIPTIONS[lvl]}
                            </Text>
                            {/* When selected, show its level price */}
                            {isSelected && (
                              <View style={styles.modalLevelPriceRow}>
                                <Text style={styles.modalLevelPriceLabel}>Fee:</Text>
                                <Text style={styles.modalLevelPriceVal}>₹{modalCoachFee} / hr</Text>
                              </View>
                            )}
                            {!offered && (
                              <Text style={styles.modalLevelNotOffered}>Not offered</Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 2. Choose Session Date */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>2. Choose Session Date</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                      {upcomingDays.map((day) => {
                        const isAvailable = selectedCoach.availableDays?.includes(day.dayOfWeek);
                        const isSelected = modalDate === day.dateStr;
                        return (
                          <TouchableOpacity
                            key={day.dateStr}
                            style={[
                              styles.dateChip,
                              isSelected && styles.dateChipActive,
                              !isAvailable && styles.dateChipDisabled
                            ]}
                            onPress={() => setModalDate(day.dateStr)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.dateChipDay, isSelected && styles.dateChipDayActive]}>
                              {day.dayOfWeek.slice(0, 3)}
                            </Text>
                            <Text style={[styles.dateChipDate, isSelected && styles.dateChipDateActive]}>
                              {day.label}
                            </Text>
                            {!isAvailable && (
                              <Text style={styles.dateChipUnavailable}>Off</Text>
                            )}
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                    {chosenDayObj && !isDayAvailable && (
                      <Text style={styles.dayWarningText}>
                        ⚠️ {selectedCoach.name} is not available on {chosenDayObj.dayOfWeek}s.
                      </Text>
                    )}
                  </View>

                  {/* 3. Choose Time Slot */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>3. Choose Time Slot</Text>
                    <View style={styles.slotGrid}>
                      {selectedCoach.availableTimeSlots?.map((slot) => {
                        const isSelected = modalSlot === slot;
                        return (
                          <TouchableOpacity
                            key={slot}
                            style={[styles.slotChip, isSelected && styles.slotChipActive]}
                            onPress={() => setModalSlot(slot)}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.slotChipText, isSelected && styles.slotChipTextActive]}>
                              {slot}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  {/* 4. Training Notes */}
                  <View style={styles.modalSection}>
                    <Text style={styles.modalSectionLabel}>4. Training Focus / Notes (Optional)</Text>
                    <TextInput
                      value={modalNotes}
                      onChangeText={setModalNotes}
                      placeholder="e.g. Footwork drills, backhand clears, match strategy..."
                      placeholderTextColor={colors.textSubtle}
                      style={styles.modalInput}
                    />
                  </View>

                  {/* Submit Button */}
                  <TouchableOpacity
                    style={[
                      styles.confirmBtn,
                      (!isDayAvailable || !modalSlot || !isLevelOffered || bookMutation.isPending) &&
                        styles.confirmBtnDisabled
                    ]}
                    disabled={!isDayAvailable || !modalSlot || !isLevelOffered || bookMutation.isPending}
                    onPress={handleConfirmBooking}
                    activeOpacity={0.8}
                  >
                    {bookMutation.isPending ? (
                      <ActivityIndicator size="small" color={colors.primaryForeground} />
                    ) : (
                      <CheckCircle2 size={16} color={colors.primaryForeground} />
                    )}
                    <Text style={styles.confirmBtnText}>
                      {bookMutation.isPending
                        ? "Confirming Booking..."
                        : `Confirm ${COACHING_LEVEL_LABELS[modalLevel]} Session (₹${modalCoachFee})`}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </View>
          </Modal>
        );
      })()}
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
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
    backgroundColor: colors.card
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.background
  },
  tabBtnActive: {
    backgroundColor: colors.primaryLight
  },
  tabText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40
  },
  section: {
    gap: 12
  },
  levelFilterCard: {
    padding: 14,
    gap: 10,
    backgroundColor: colors.cardElevated,
    borderColor: colors.cardBorder
  },
  levelFilterHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10
  },
  levelFilterTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text
  },
  levelFilterSub: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15,
    marginTop: 2
  },
  levelPillsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2
  },
  levelPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  levelPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  levelPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  levelPillTextActive: {
    color: colors.primaryForeground,
    fontWeight: "800"
  },
  coachesList: {
    gap: 12
  },
  coachCard: {
    padding: 16,
    gap: 12
  },
  coachHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8
  },
  coachName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  coachTitle: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 2
  },
  priceBadgeBox: {
    alignItems: "flex-end",
    gap: 2
  },
  priceSubText: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "500"
  },
  coachBio: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18
  },
  cardLevelSelector: {
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  cardLevelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  cardLevelLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text
  },
  cardLevelFeeText: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.primary
  },
  cardLevelGrid: {
    flexDirection: "row",
    gap: 6
  },
  cardLevelBtn: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center"
  },
  cardLevelBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  cardLevelBtnDisabled: {
    opacity: 0.35,
    backgroundColor: "transparent"
  },
  cardLevelBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted
  },
  cardLevelBtnTextActive: {
    color: colors.primaryForeground,
    fontWeight: "800"
  },
  cardLevelBtnTextDisabled: {
    color: colors.textSubtle
  },
  cardLevelDesc: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: "italic"
  },
  timingCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: 8,
    padding: 10,
    gap: 6
  },
  timingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  timingLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted
  },
  timingVal: {
    fontSize: 11,
    color: colors.text,
    flex: 1
  },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 4
  },
  bookBtnDisabled: {
    opacity: 0.4,
    backgroundColor: colors.cardBorder
  },
  bookBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primaryForeground
  },
  sessionsList: {
    gap: 12
  },
  sessionCard: {
    padding: 16,
    gap: 12
  },
  sessionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start"
  },
  sessionCoach: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  sessionLevelBadgeRow: {
    marginTop: 4
  },
  sessionMetaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    backgroundColor: colors.cardElevated,
    padding: 10,
    borderRadius: 8
  },
  sessionMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  sessionMetaText: {
    fontSize: 12,
    color: colors.textMuted
  },
  sessionNotes: {
    fontSize: 11,
    color: colors.textMuted,
    fontStyle: "italic"
  },
  sessionActionRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 10
  },
  cancelBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: "rgba(239, 68, 68, 0.12)"
  },
  cancelBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.danger
  },
  // AI Lab Styles
  heroCard: {
    padding: 20,
    gap: 12,
    borderColor: "rgba(236, 72, 153, 0.3)",
    backgroundColor: "rgba(236, 72, 153, 0.04)"
  },
  heroHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  brainIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(236, 72, 153, 0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  heroHeaderRight: {
    alignItems: "flex-end",
    gap: 4
  },
  providerText: {
    fontSize: 10,
    color: colors.textMuted
  },
  headline: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    lineHeight: 24
  },
  summaryText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginLeft: 4
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  focusGrid: {
    gap: 8
  },
  focusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  focusPillDot: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: "800"
  },
  focusPillText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    flex: 1
  },
  drillsList: {
    gap: 10
  },
  drillCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 12
  },
  drillNumBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  drillNumText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#f59e0b"
  },
  drillText: {
    fontSize: 13,
    fontWeight: "500",
    color: colors.text,
    flex: 1,
    lineHeight: 18
  },
  center: {
    padding: 40,
    alignItems: "center",
    gap: 8
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted
  },
  emptyCard: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  emptySub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 280
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end"
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  modalCoachSub: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: "600",
    marginTop: 2
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cardElevated
  },
  modalBody: {
    padding: 16
  },
  modalFeeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.cardElevated,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  modalFeeLevelTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.text
  },
  modalFeeSubText: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  modalFeeAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
    fontFamily: "monospace"
  },
  modalFeePerHour: {
    fontSize: 10,
    color: colors.textMuted
  },
  modalSection: {
    gap: 8
  },
  modalSectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text
  },
  modalSectionHelper: {
    fontSize: 11,
    color: colors.textMuted
  },
  modalLevelCardsGrid: {
    gap: 8
  },
  modalLevelCard: {
    backgroundColor: colors.cardElevated,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    gap: 4
  },
  modalLevelCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  modalLevelCardDisabled: {
    opacity: 0.35,
    backgroundColor: colors.background
  },
  modalLevelCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  modalLevelCardName: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text
  },
  modalLevelCardNameActive: {
    color: colors.primary
  },
  modalLevelCardNameDisabled: {
    color: colors.textSubtle
  },
  modalLevelCardDesc: {
    fontSize: 11,
    color: colors.textMuted,
    lineHeight: 15
  },
  modalLevelPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(16, 185, 129, 0.2)"
  },
  modalLevelPriceLabel: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600"
  },
  modalLevelPriceVal: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.primary,
    fontFamily: "monospace"
  },
  modalLevelNotOffered: {
    fontSize: 10,
    color: colors.textSubtle,
    fontStyle: "italic",
    marginTop: 2
  },
  dateChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    gap: 2
  },
  dateChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  dateChipDisabled: {
    opacity: 0.35
  },
  dateChipDay: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.textMuted
  },
  dateChipDayActive: {
    color: colors.primaryForeground
  },
  dateChipDate: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.text
  },
  dateChipDateActive: {
    color: colors.primaryForeground,
    fontWeight: "800"
  },
  dateChipUnavailable: {
    fontSize: 9,
    color: colors.danger,
    fontWeight: "700"
  },
  dayWarningText: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: "500"
  },
  slotGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  slotChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: colors.cardElevated,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  slotChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  slotChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textMuted,
    fontFamily: "monospace"
  },
  slotChipTextActive: {
    color: colors.primaryForeground,
    fontWeight: "800"
  },
  modalInput: {
    backgroundColor: colors.cardElevated,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8
  },
  confirmBtnDisabled: {
    opacity: 0.4,
    backgroundColor: colors.cardBorder
  },
  confirmBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.primaryForeground
  }
});

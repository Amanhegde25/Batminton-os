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
  ScrollView,
  Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Grid, Calendar, Clock, Plus, CheckCircle, AlertCircle } from "lucide-react-native";
import { useClub } from "../../src/context/club";
import { api } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import type { CourtItem, CourtBooking } from "../../src/lib/types";

function money(n: number): string {
  return `₹${(Math.abs(n) / 100).toLocaleString("en-IN")}`;
}

export default function CourtsScreen() {
  const { activeClubId } = useClub();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"courts" | "bookings">("courts");
  const [selectedDate, setSelectedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );

  // Booking Modal State
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<CourtItem | null>(null);
  const [startHour, setStartHour] = useState("18:00");
  const [durationHours, setDurationHours] = useState(1);
  const [bookingNotes, setBookingNotes] = useState("");

  const {
    data: courtsData,
    isLoading: courtsLoading,
    isRefetching: courtsRefetching,
    refetch: refetchCourts
  } = useQuery({
    queryKey: ["clubCourts", activeClubId],
    queryFn: () => api.courts.list(activeClubId!),
    enabled: !!activeClubId && tab === "courts"
  });

  const {
    data: bookingsData,
    isLoading: bookingsLoading,
    isRefetching: bookingsRefetching,
    refetch: refetchBookings
  } = useQuery({
    queryKey: ["clubBookings", activeClubId, selectedDate],
    queryFn: () => api.courts.bookings(activeClubId!, selectedDate),
    enabled: !!activeClubId && tab === "bookings"
  });

  // Book Court Mutation
  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCourt) return;
      const startTime = `${selectedDate}T${startHour}:00.000Z`;
      const endHourNum = parseInt(startHour.split(":")[0], 10) + durationHours;
      const endTime = `${selectedDate}T${String(endHourNum).padStart(2, "0")}:00:00.000Z`;

      return api.courts.book(activeClubId!, {
        courtId: selectedCourt.id,
        startTime,
        endTime,
        notes: bookingNotes || undefined
      });
    },
    onSuccess: () => {
      setBookingModalVisible(false);
      setBookingNotes("");
      Alert.alert("Success", "Court booking confirmed!");
      void queryClient.invalidateQueries({ queryKey: ["clubBookings", activeClubId] });
      void queryClient.invalidateQueries({ queryKey: ["clubCourts", activeClubId] });
    },
    onError: (err: Error) => {
      Alert.alert("Booking Failed", err.message || "Could not reserve court.");
    }
  });

  const openBookingFor = (court: CourtItem) => {
    setSelectedCourt(court);
    setBookingModalVisible(true);
  };

  const courts = courtsData ?? [];
  const bookings = bookingsData ?? [];

  // Generate next 5 days
  const dateOptions = Array.from({ length: 5 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const label =
      i === 0
        ? "Today"
        : i === 1
        ? "Tomorrow"
        : d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
    return { iso, label };
  });

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Courts & Bookings</Text>
          <Text style={styles.screenSub}>Real-time availability and reservations</Text>
        </View>

        <TouchableOpacity
          style={styles.bookActionBtn}
          onPress={() => {
            if (courts.length > 0) openBookingFor(courts[0]);
          }}
        >
          <Plus size={16} color={colors.primaryForeground} />
          <Text style={styles.bookActionBtnText}>Reserve</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabSwitcher}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === "courts" && styles.tabBtnActive]}
          onPress={() => setTab("courts")}
        >
          <Grid size={14} color={tab === "courts" ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabBtnText, tab === "courts" && styles.tabBtnTextActive]}>
            Courts ({courts.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, tab === "bookings" && styles.tabBtnActive]}
          onPress={() => setTab("bookings")}
        >
          <Calendar size={14} color={tab === "bookings" ? colors.primary : colors.textMuted} />
          <Text style={[styles.tabBtnText, tab === "bookings" && styles.tabBtnTextActive]}>
            Schedule
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "courts" ? (
        courtsLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <FlatList
            data={courts}
            keyExtractor={(c) => c.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={courtsRefetching}
                onRefresh={refetchCourts}
                tintColor={colors.primary}
              />
            }
            renderItem={({ item }) => {
              const isAvailable = item.status === "AVAILABLE" || item.effectiveStatus === "AVAILABLE";
              const isMaint = item.status === "MAINTENANCE";

              return (
                <Card style={styles.courtCard}>
                  <View style={styles.courtHeader}>
                    <View style={styles.courtBadgeBox}>
                      <Text style={styles.courtNum}>#{item.number}</Text>
                    </View>
                    <View style={styles.courtTitleCol}>
                      <Text style={styles.courtName}>{item.name}</Text>
                      <Text style={styles.courtType}>
                        {item.type} Surface • {item.openHour}:00 - {item.closeHour}:00
                      </Text>
                    </View>
                    <Badge
                      label={isAvailable ? "AVAILABLE" : isMaint ? "MAINTENANCE" : "IN USE"}
                      tone={isAvailable ? "success" : isMaint ? "danger" : "warning"}
                    />
                  </View>

                  <View style={styles.courtBottom}>
                    <View>
                      <Text style={styles.feeLabel}>Hourly Fee</Text>
                      <Text style={styles.feeValue}>{money(item.hourlyFee)}/hr</Text>
                    </View>

                    <TouchableOpacity
                      style={[styles.reserveBtn, !isAvailable && styles.reserveBtnDisabled]}
                      disabled={!isAvailable}
                      onPress={() => openBookingFor(item)}
                    >
                      <Text style={styles.reserveBtnText}>Book Court</Text>
                    </TouchableOpacity>
                  </View>
                </Card>
              );
            }}
          />
        )
      ) : (
        <View style={{ flex: 1 }}>
          {/* Date Selector */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.dateSelector}
          >
            {dateOptions.map((d) => (
              <TouchableOpacity
                key={d.iso}
                style={[
                  styles.dateChip,
                  selectedDate === d.iso && styles.dateChipActive
                ]}
                onPress={() => setSelectedDate(d.iso)}
              >
                <Text
                  style={[
                    styles.dateChipText,
                    selectedDate === d.iso && styles.dateChipTextActive
                  ]}
                >
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {bookingsLoading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <FlatList
              data={bookings}
              keyExtractor={(b) => b.id}
              contentContainerStyle={styles.listContent}
              refreshControl={
                <RefreshControl
                  refreshing={bookingsRefetching}
                  onRefresh={refetchBookings}
                  tintColor={colors.primary}
                />
              }
              renderItem={({ item }) => (
                <Card style={styles.bookingCard}>
                  <View style={styles.bookingTop}>
                    <View style={styles.bookingCourtInfo}>
                      <Clock size={14} color={colors.primary} />
                      <Text style={styles.bookingCourtName}>
                        {item.court?.name ?? "Court"}
                      </Text>
                    </View>
                    <Badge label={item.status} tone="primary" />
                  </View>
                  <Text style={styles.bookingTime}>
                    {new Date(item.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    {" - "}
                    {new Date(item.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                  <Text style={styles.bookingUser}>
                    Booked by: {item.user?.name ?? "Member"}
                  </Text>
                </Card>
              )}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyTitle}>No bookings on this day</Text>
                  <Text style={styles.emptySub}>All courts are free for reservation.</Text>
                </View>
              }
            />
          )}
        </View>
      )}

      {/* Booking Modal */}
      <Modal
        visible={bookingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalSheetTitle}>
              Book {selectedCourt?.name ?? "Court"}
            </Text>
            <Text style={styles.modalSheetSub}>
              Rate: {money(selectedCourt?.hourlyFee ?? 0)}/hour
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Start Time</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeScroll}>
                {["06:00", "07:00", "08:00", "09:00", "16:00", "17:00", "18:00", "19:00", "20:00"].map((h) => (
                  <TouchableOpacity
                    key={h}
                    style={[styles.timeSlot, startHour === h && styles.timeSlotActive]}
                    onPress={() => setStartHour(h)}
                  >
                    <Text style={[styles.timeSlotText, startHour === h && styles.timeSlotTextActive]}>
                      {h}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Duration</Text>
              <View style={styles.durationRow}>
                {[1, 2].map((dur) => (
                  <TouchableOpacity
                    key={dur}
                    style={[styles.durationBtn, durationHours === dur && styles.durationBtnActive]}
                    onPress={() => setDurationHours(dur)}
                  >
                    <Text style={[styles.durationText, durationHours === dur && styles.durationTextActive]}>
                      {dur} {dur === 1 ? "Hour" : "Hours"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Notes (optional)</Text>
              <TextInput
                value={bookingNotes}
                onChangeText={setBookingNotes}
                placeholder="Friendly doubles practice"
                placeholderTextColor={colors.textSubtle}
                style={styles.modalInput}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setBookingModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={() => bookMutation.mutate()}
                disabled={bookMutation.isPending}
              >
                {bookMutation.isPending ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm Booking</Text>
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
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text
  },
  screenSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  bookActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10
  },
  bookActionBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryForeground
  },
  tabSwitcher: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  tabBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted
  },
  tabBtnTextActive: {
    color: colors.primary
  },
  dateSelector: {
    paddingHorizontal: 20,
    gap: 8,
    paddingBottom: 12
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  dateChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  dateChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  dateChipTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12
  },
  courtCard: {
    padding: 16,
    gap: 14
  },
  courtHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  courtBadgeBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.primary
  },
  courtNum: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primary
  },
  courtTitleCol: {
    flex: 1
  },
  courtName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  courtType: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  courtBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    paddingTop: 12
  },
  feeLabel: {
    fontSize: 10,
    color: colors.textMuted
  },
  feeValue: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.text
  },
  reserveBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8
  },
  reserveBtnDisabled: {
    opacity: 0.4
  },
  reserveBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primaryForeground
  },
  bookingCard: {
    padding: 14,
    gap: 6
  },
  bookingTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  bookingCourtInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  bookingCourtName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  bookingTime: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary
  },
  bookingUser: {
    fontSize: 11,
    color: colors.textMuted
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 6
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text
  },
  emptySub: {
    fontSize: 12,
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
  modalSheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text
  },
  modalSheetSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: -8
  },
  formGroup: {
    gap: 8
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text
  },
  timeScroll: {
    flexDirection: "row"
  },
  timeSlot: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  timeSlotActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  timeSlotText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600"
  },
  timeSlotTextActive: {
    color: colors.primary
  },
  durationRow: {
    flexDirection: "row",
    gap: 10
  },
  durationBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  durationBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  durationText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textMuted
  },
  durationTextActive: {
    color: colors.primary
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

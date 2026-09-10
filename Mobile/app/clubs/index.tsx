import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Search,
  Building,
  MapPin,
  Users,
  Grid,
  Check,
  Clock,
  ChevronRight,
  Sparkles
} from "lucide-react-native";
import { api } from "../../src/lib/api";
import { useClub } from "../../src/context/club";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import type { NearbyClub } from "../../src/lib/types";

export default function ClubsScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { activeClub, refreshClubContext, switchClub } = useClub();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState<string>("ALL");
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const {
    data: clubs = [],
    isLoading,
    isRefetching,
    refetch
  } = useQuery<NearbyClub[]>({
    queryKey: ["clubsSearch", selectedCity, searchQuery],
    queryFn: () =>
      api.clubs.nearby({
        city: selectedCity === "ALL" ? undefined : selectedCity,
        q: searchQuery.trim() || undefined
      })
  });

  const joinMutation = useMutation({
    mutationFn: (clubId: string) => api.clubs.join(clubId),
    onMutate: (clubId) => setJoiningId(clubId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["clubsSearch"] }),
        queryClient.invalidateQueries({ queryKey: ["nearbyClubs"] }),
        refreshClubContext()
      ]);
    },
    onSettled: () => setJoiningId(null)
  });

  // Extract unique cities from current club list for filter pills
  const availableCities = useMemo(() => {
    const set = new Set<string>();
    clubs.forEach((c) => {
      if (c.city) set.add(c.city.trim());
    });
    return ["ALL", ...Array.from(set)];
  }, [clubs]);

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
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Find & Join Clubs</Text>
          <Text style={styles.headerSubtitle}>
            Discover verified badminton venues & communities
          </Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by club name, address or city..."
            placeholderTextColor={colors.textSubtle}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>

        {/* City Filter Pills */}
        {availableCities.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.cityScroll}
          >
            {availableCities.map((city) => {
              const isSelected = selectedCity === city;
              return (
                <TouchableOpacity
                  key={city}
                  style={[
                    styles.cityPill,
                    isSelected && styles.cityPillActive
                  ]}
                  onPress={() => setSelectedCity(city)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.cityPillText,
                      isSelected && styles.cityPillTextActive
                    ]}
                  >
                    {city === "ALL" ? "All Locations" : city}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}
      </View>

      {/* Clubs List */}
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
        <View style={styles.listHeaderRow}>
          <Text style={styles.resultsCount}>
            {isLoading ? "Searching clubs..." : `${clubs.length} Clubs Available`}
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Finding clubs...</Text>
          </View>
        ) : clubs.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Building size={36} color={colors.textMuted} />
            <Text style={styles.emptyTitle}>No Clubs Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? `No clubs matched "${searchQuery}". Try a different name or clear the filters.`
                : "No clubs are registered in this location yet."}
            </Text>
          </Card>
        ) : (
          clubs.map((club) => {
            const isMember = club.membership?.status === "ACTIVE";
            const isPending = club.membership?.status === "PENDING";
            const isCurrentActive = activeClub?.id === club.id;
            const isJoining = joiningId === club.id;

            return (
              <TouchableOpacity
                key={club.id}
                activeOpacity={0.8}
                onPress={() => router.push(`/clubs/${club.id}` as any)}
              >
                <Card style={[styles.clubCard, isCurrentActive && styles.activeClubCard]}>
                  <View style={styles.clubCardHeader}>
                    <View style={styles.clubIconWrap}>
                      <Text style={styles.clubEmoji}>🏸</Text>
                    </View>
                    <View style={styles.clubInfo}>
                      <View style={styles.titleRow}>
                        <Text style={styles.clubName} numberOfLines={1}>
                          {club.name}
                        </Text>
                        {isCurrentActive && (
                          <Badge label="Active" tone="primary" />
                        )}
                      </View>
                      <View style={styles.locationRow}>
                        <MapPin size={12} color={colors.textMuted} />
                        <Text style={styles.locationText} numberOfLines={1}>
                          {club.address || club.city || "Venue Location"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Club stats pills */}
                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <Grid size={13} color={colors.primary} />
                      <Text style={styles.statLabel}>
                        {club.courtCount} {club.courtCount === 1 ? "Court" : "Courts"}
                      </Text>
                    </View>
                    <View style={styles.statDot} />
                    <View style={styles.statItem}>
                      <Users size={13} color="#3b82f6" />
                      <Text style={styles.statLabel}>
                        {club.memberCount} Members
                      </Text>
                    </View>
                    {club.distanceKm != null && (
                      <>
                        <View style={styles.statDot} />
                        <View style={styles.statItem}>
                          <Sparkles size={13} color="#f59e0b" />
                          <Text style={styles.statLabel}>
                            {club.distanceKm.toFixed(1)} km away
                          </Text>
                        </View>
                      </>
                    )}
                  </View>

                  {/* Footer actions */}
                  <View style={styles.cardFooter}>
                    {isMember ? (
                      <View style={styles.membershipRow}>
                        <Badge label="Member" tone="success" />
                        {!isCurrentActive && (
                          <TouchableOpacity
                            style={styles.switchBtn}
                            onPress={(e) => {
                              e.stopPropagation();
                              void switchClub(club.id);
                            }}
                          >
                            <Text style={styles.switchBtnText}>Set Active</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    ) : isPending ? (
                      <View style={styles.membershipRow}>
                        <Badge label="Pending Approval" tone="warning" />
                        <Text style={styles.pendingHint}>Waiting for admin review</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.joinBtn}
                        disabled={isJoining}
                        onPress={(e) => {
                          e.stopPropagation();
                          joinMutation.mutate(club.id);
                        }}
                      >
                        {isJoining ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.joinBtnText}>Request to Join</Text>
                        )}
                      </TouchableOpacity>
                    )}

                    <View style={styles.viewDetailsRow}>
                      <Text style={styles.viewDetailsText}>Details</Text>
                      <ChevronRight size={14} color={colors.textMuted} />
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          })
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
  searchSection: {
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.04)"
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    gap: 10
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14
  },
  cityScroll: {
    gap: 8,
    paddingVertical: 2
  },
  cityPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  cityPillActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary
  },
  cityPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  cityPillTextActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  listContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40
  },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2
  },
  resultsCount: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5
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
  clubCard: {
    padding: 16,
    gap: 12
  },
  activeClubCard: {
    borderColor: colors.primary,
    backgroundColor: "rgba(16, 185, 129, 0.04)"
  },
  clubCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  clubIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  clubEmoji: {
    fontSize: 22
  },
  clubInfo: {
    flex: 1
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  clubName: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    flex: 1
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4
  },
  locationText: {
    fontSize: 12,
    color: colors.textMuted,
    flex: 1
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 10
  },
  statItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "500"
  },
  statDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.textSubtle
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder
  },
  membershipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  pendingHint: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: "500"
  },
  switchBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: colors.primaryLight
  },
  switchBtnText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "700"
  },
  joinBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center"
  },
  joinBtnText: {
    color: colors.primaryForeground,
    fontSize: 12,
    fontWeight: "700"
  },
  viewDetailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  viewDetailsText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600"
  }
});

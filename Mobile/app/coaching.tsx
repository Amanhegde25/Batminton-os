import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Brain, Target, Dumbbell, Sparkles, RefreshCw } from "lucide-react-native";
import { useClub } from "../src/context/club";
import { api } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import type { CoachingInsight } from "../src/lib/types";

export default function CoachingScreen() {
  const router = useRouter();
  const { activeClubId } = useClub();

  const {
    data: coaching,
    isLoading,
    isRefetching,
    refetch,
    error
  } = useQuery<CoachingInsight>({
    queryKey: ["coachingInsight", activeClubId],
    queryFn: () => api.coaching.get(activeClubId!),
    enabled: !!activeClubId
  });

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
        <Text style={styles.topBarTitle}>AI Coaching</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => refetch()}
          activeOpacity={0.7}
        >
          <RefreshCw size={18} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Synthesizing match analytics...</Text>
          </View>
        ) : error || !coaching ? (
          <Card style={styles.emptyCard}>
            <Brain size={44} color="#ec4899" />
            <Text style={styles.emptyTitle}>AI Coach Unavailable</Text>
            <Text style={styles.emptySub}>
              {(error as Error)?.message?.includes("FEATURE")
                ? "AI Coaching requires an active club coaching plan."
                : "Play more matches to generate personalized coaching insights."}
            </Text>
          </Card>
        ) : (
          <>
            {/* Hero Insight Card */}
            <Card style={styles.heroCard}>
              <View style={styles.heroHeader}>
                <View style={styles.brainIconBox}>
                  <Brain size={24} color="#ec4899" />
                </View>
                <View style={styles.heroHeaderRight}>
                  <Badge
                    label={`${Math.round(coaching.confidence * 100)}% Confidence`}
                    tone="primary"
                  />
                  <Text style={styles.providerText}>Engine: {coaching.provider}</Text>
                </View>
              </View>

              <Text style={styles.headline}>{coaching.headline}</Text>
              <Text style={styles.summaryText}>{coaching.summary}</Text>
            </Card>

            {/* Focus Areas */}
            {coaching.focusAreas && coaching.focusAreas.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Target size={18} color={colors.primary} />
                  <Text style={styles.sectionTitle}>Key Focus Areas</Text>
                </View>
                <View style={styles.focusGrid}>
                  {coaching.focusAreas.map((area, idx) => (
                    <View key={idx} style={styles.focusPill}>
                      <Text style={styles.focusPillDot}>•</Text>
                      <Text style={styles.focusPillText}>{area}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Recommended Drills */}
            {coaching.drills && coaching.drills.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Dumbbell size={18} color="#f59e0b" />
                  <Text style={styles.sectionTitle}>Personalized Drills</Text>
                </View>

                <View style={styles.drillsList}>
                  {coaching.drills.map((drill, idx) => (
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
    gap: 16,
    paddingBottom: 36
  },
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
  section: {
    gap: 10
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
    maxWidth: 260
  }
});

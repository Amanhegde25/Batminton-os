import React from "react";
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
import { ArrowLeft, Video, Zap, Activity, Shield, Play } from "lucide-react-native";
import { useClub } from "../src/context/club";
import { api } from "../src/lib/api";
import { colors } from "../src/theme/colors";
import { Card } from "../src/components/Card";
import { Badge } from "../src/components/Badge";
import type { VideoItem } from "../src/lib/types";

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "muted"> = {
  COMPLETED: "success",
  PROCESSING: "warning",
  FAILED: "danger",
  PENDING: "muted"
};

export default function VideosScreen() {
  const router = useRouter();
  const { activeClubId } = useClub();

  const {
    data: videos,
    isLoading,
    isRefetching,
    refetch,
    error
  } = useQuery<VideoItem[]>({
    queryKey: ["clubVideos", activeClubId],
    queryFn: () => api.videos.list(activeClubId!),
    enabled: !!activeClubId
  });

  const list = videos ?? [];

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
        <Text style={styles.topBarTitle}>Video Analysis</Text>
        <View style={{ width: 40 }} />
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
          <Card style={styles.videoCard}>
            <View style={styles.videoHeader}>
              <View style={styles.videoIconBox}>
                <Video size={20} color="#6366f1" />
              </View>
              <View style={styles.videoInfo}>
                <Text style={styles.videoName} numberOfLines={1}>
                  {item.fileName}
                </Text>
                <Text style={styles.videoDate}>
                  {new Date(item.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric"
                  })}
                  {item.durationSeconds ? ` • ${Math.round(item.durationSeconds)}s` : ""}
                </Text>
              </View>
              <Badge
                label={item.status}
                tone={STATUS_TONE[item.status] ?? "muted"}
              />
            </View>

            {/* Mock/Simulated CV Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Footwork</Text>
                <Text style={styles.metricVal}>86/100</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Accuracy</Text>
                <Text style={styles.metricVal}>79%</Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Max Smash</Text>
                <Text style={[styles.metricVal, { color: colors.primary }]}>
                  246 km/h
                </Text>
              </View>
              <View style={styles.metricItem}>
                <Text style={styles.metricLabel}>Coverage</Text>
                <Text style={styles.metricVal}>92%</Text>
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
              <Video size={42} color={colors.textSubtle} />
              <Text style={styles.emptyTitle}>No video analysis files</Text>
              <Text style={styles.emptySub}>
                Upload match videos on the web app to run computer vision shot tracking and footwork scores.
              </Text>
            </View>
          )
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
    gap: 12
  },
  videoCard: {
    padding: 16,
    gap: 14
  },
  videoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  videoIconBox: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center"
  },
  videoInfo: {
    flex: 1
  },
  videoName: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  videoDate: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  metricsGrid: {
    flexDirection: "row",
    backgroundColor: "rgba(255, 255, 255, 0.02)",
    borderRadius: 10,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder
  },
  metricItem: {
    flex: 1,
    alignItems: "center"
  },
  metricLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: "600"
  },
  metricVal: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.text,
    marginTop: 2
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
  }
});

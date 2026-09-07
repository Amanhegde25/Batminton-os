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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../src/lib/api";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { NOTIFICATION_TONES } from "../../src/lib/constants";
import type { NotificationItem } from "../../src/lib/types";

export default function NotificationsScreen() {
  const [tab, setTab] = useState<"ALL" | "UNREAD">("ALL");
  const queryClient = useQueryClient();

  // 1. Data Fetching via TanStack Query & Shared API Client
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
    error
  } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.notifications.list(1)
  });

  // 2. Mutation to mark notifications as read
  const markMutation = useMutation({
    mutationFn: (ids?: string[]) => api.notifications.markRead(ids),
    onSuccess: () => {
      // Invalidate query to trigger seamless background refresh
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const allItems = data?.items ?? [];
  const unreadCount = data?.unread ?? allItems.filter((n) => !n.readAt).length;
  const filtered =
    tab === "UNREAD" ? allItems.filter((n) => !n.readAt) : allItems;

  const renderItem = ({ item }: { item: NotificationItem }) => {
    const isUnread = !item.readAt;
    const tone = NOTIFICATION_TONES[item.type] ?? "muted";

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        disabled={!isUnread || markMutation.isPending}
        onPress={() => markMutation.mutate([item.id])}
      >
        <Card
          style={[
            styles.notificationCard,
            isUnread && styles.unreadCard
          ]}
        >
          <View style={styles.cardHeader}>
            <View style={styles.titleRow}>
              {isUnread && <View style={styles.unreadDot} />}
              <Text style={styles.titleText}>{item.title}</Text>
            </View>
            <Badge label={item.type.replace(/_/g, " ")} tone={tone} />
          </View>

          {item.body ? (
            <Text style={styles.bodyText}>{item.body}</Text>
          ) : null}

          <View style={styles.cardFooter}>
            <Text style={styles.timeText}>
              {new Date(item.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
              })}
            </Text>
            {isUnread && (
              <Text style={styles.tapToRead}>Tap to mark read</Text>
            )}
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.screenTitle}>Notifications</Text>
          <Text style={styles.screenSub}>
            Real-time club announcements & match alerts
          </Text>
        </View>

        {unreadCount > 0 && (
          <Button
            title="Mark All"
            variant="outline"
            style={styles.markAllBtn}
            loading={markMutation.isPending}
            onPress={() => markMutation.mutate(undefined)}
          />
        )}
      </View>

      {/* Tabs Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, tab === "ALL" && styles.tabActive]}
          onPress={() => setTab("ALL")}
        >
          <Text
            style={[styles.tabLabel, tab === "ALL" && styles.tabLabelActive]}
          >
            All ({allItems.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, tab === "UNREAD" && styles.tabActive]}
          onPress={() => setTab("UNREAD")}
        >
          <Text
            style={[
              styles.tabLabel,
              tab === "UNREAD" && styles.tabLabelActive
            ]}
          >
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content State */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Fetching alerts...</Text>
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Failed to load notifications</Text>
          <Text style={styles.errorSub}>{(error as Error).message}</Text>
          <Button
            title="Try Again"
            variant="outline"
            style={{ marginTop: 12 }}
            onPress={() => refetch()}
          />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>
                {tab === "UNREAD"
                  ? "You're all caught up!"
                  : "No notifications yet"}
              </Text>
              <Text style={styles.emptySub}>
                {tab === "UNREAD"
                  ? "All pending club notifications have been read."
                  : "Match alerts, court bookings, and club updates will show here."}
              </Text>
            </View>
          }
        />
      )}
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
    paddingBottom: 16
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
  markAllBtn: {
    height: 36,
    paddingHorizontal: 12
  },
  tabBar: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginBottom: 12,
    gap: 8
  },
  tabItem: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  tabActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textMuted
  },
  tabLabelActive: {
    color: colors.primary
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12
  },
  notificationCard: {
    gap: 8
  },
  unreadCard: {
    borderColor: "rgba(16, 185, 129, 0.4)",
    backgroundColor: "rgba(16, 185, 129, 0.04)"
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 8
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary
  },
  titleText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
    flex: 1
  },
  bodyText: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4
  },
  timeText: {
    fontSize: 11,
    color: colors.textSubtle
  },
  tapToRead: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600"
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10
  },
  loadingText: {
    fontSize: 13,
    color: colors.textMuted
  },
  errorIcon: {
    fontSize: 32
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text
  },
  errorSub: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center"
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12
  },
  emptyIcon: {
    fontSize: 40
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
    maxWidth: 260,
    lineHeight: 18
  }
});

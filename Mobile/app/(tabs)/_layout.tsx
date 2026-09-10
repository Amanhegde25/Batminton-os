import React from "react";
import { Tabs } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Home, Calendar, Trophy, Grid, Menu, Bell, User } from "lucide-react-native";
import { colors } from "../../src/theme/colors";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 60 + (insets.bottom > 0 ? insets.bottom : 8),
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8
        },
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600"
        }
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home size={size ?? 22} color={color as string} />
          )
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          title: "Matches",
          tabBarIcon: ({ color, size }) => (
            <Calendar size={size ?? 22} color={color as string} />
          )
        }}
      />
      <Tabs.Screen
        name="courts"
        options={{
          title: "Courts",
          tabBarIcon: ({ color, size }) => (
            <Grid size={size ?? 22} color={color as string} />
          )
        }}
      />
      <Tabs.Screen
        name="leaderboards"
        options={{
          title: "Rankings",
          tabBarIcon: ({ color, size }) => (
            <Trophy size={size ?? 22} color={color as string} />
          )
        }}
      />
      <Tabs.Screen
        name="hub"
        options={{
          title: "More",
          tabBarIcon: ({ color, size }) => (
            <Menu size={size ?? 22} color={color as string} />
          )
        }}
      />

      {/* Background Tab Screens (accessible via navigation without tab bar items) */}
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: "Alerts"
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
          title: "Profile"
        }}
      />
    </Tabs>
  );
}

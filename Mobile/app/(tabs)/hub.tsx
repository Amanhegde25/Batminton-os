import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  CalendarCheck,
  Trophy,
  Users,
  Brain,
  Video,
  Sparkles,
  Wallet,
  Scale,
  Bell,
  Settings,
  User,
  ChevronRight,
  ShieldCheck,
  Building
} from "lucide-react-native";
import { useAuth } from "../../src/context/auth";
import { useClub } from "../../src/context/club";
import { colors } from "../../src/theme/colors";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";

interface HubItemProps {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  iconColor: string;
  bgColor: string;
  route: string;
  badge?: string;
  staffOnly?: boolean;
}

export default function HubScreen() {
  const { user } = useAuth();
  const { activeClub, activeMembership, isStaff, openClubSwitcher } = useClub();
  const router = useRouter();

  const renderHubItem = (item: HubItemProps) => {
    if (item.staffOnly && !isStaff) return null;
    const Icon = item.icon;

    return (
      <TouchableOpacity
        key={item.title}
        style={styles.hubItem}
        activeOpacity={0.7}
        onPress={() => router.push(item.route as any)}
      >
        <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
          <Icon size={20} color={item.iconColor} />
        </View>

        <View style={styles.itemContent}>
          <View style={styles.itemTitleRow}>
            <Text style={styles.itemTitle}>{item.title}</Text>
            {item.badge && <Badge label={item.badge} tone="warning" />}
          </View>
          <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
        </View>

        <ChevronRight size={18} color={colors.textSubtle} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Profile / Club Overview Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name[0].toUpperCase() : "U"}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{user?.name || "Player"}</Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            <View style={styles.profileBadgeRow}>
              <Badge label={activeMembership?.role ?? "PLAYER"} tone="primary" />
              <TouchableOpacity
                style={styles.clubSwitchLink}
                onPress={openClubSwitcher}
              >
                <Building size={12} color={colors.primary} />
                <Text style={styles.clubSwitchText}>
                  {activeClub?.name ?? "Switch Club"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Card>

        {/* Community & Discovery */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Community & Discovery</Text>
          <Card style={styles.menuCard}>
            {renderHubItem({
              title: "Find & Join Clubs",
              subtitle: "Search verified badminton venues & join communities",
              icon: Building,
              iconColor: colors.primary,
              bgColor: "rgba(16, 185, 129, 0.15)",
              route: "/clubs"
            })}
            <View style={styles.menuDivider} />
            {renderHubItem({
              title: "Play Groups & Squads",
              subtitle: "Cross-club player squads, session meetups & chat",
              icon: Sparkles,
              iconColor: "#a855f7",
              bgColor: "rgba(168, 85, 247, 0.15)",
              route: "/groups"
            })}
          </Card>
        </View>

        {/* Club Operations */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Club Operations</Text>
          <Card style={styles.menuCard}>
            {renderHubItem({
              title: "Attendance & Check-in",
              subtitle: "Today's roster, check-in history & streak",
              icon: CalendarCheck,
              iconColor: colors.primary,
              bgColor: "rgba(16, 185, 129, 0.15)",
              route: "/attendance"
            })}
            <View style={styles.menuDivider} />
            {renderHubItem({
              title: "Tournaments & Brackets",
              subtitle: "Active championships, cups & knockouts",
              icon: Trophy,
              iconColor: "#f59e0b",
              bgColor: "rgba(245, 158, 11, 0.15)",
              route: "/tournaments"
            })}
            <View style={styles.menuDivider} />
            {renderHubItem({
              title: "Club Members Directory",
              subtitle: "Player roster, coaches & administrators",
              icon: Users,
              iconColor: "#3b82f6",
              bgColor: "rgba(59, 130, 246, 0.15)",
              route: "/members"
            })}
          </Card>
        </View>

        {/* Performance & Training */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Performance & AI</Text>
          <Card style={styles.menuCard}>
            {renderHubItem({
              title: "AI Coaching Insights",
              subtitle: "Personalized drill recommendations & weakness focus",
              icon: Brain,
              iconColor: "#ec4899",
              bgColor: "rgba(236, 72, 153, 0.15)",
              route: "/coaching"
            })}
            <View style={styles.menuDivider} />
            {renderHubItem({
              title: "Video CV Analysis",
              subtitle: "Footwork score, shot accuracy & smash speeds",
              icon: Video,
              iconColor: "#6366f1",
              bgColor: "rgba(99, 102, 241, 0.15)",
              route: "/videos"
            })}
            <View style={styles.menuDivider} />
            {renderHubItem({
              title: "Smart Matchmaking",
              subtitle: "AI balanced singles and doubles court pairings",
              icon: Sparkles,
              iconColor: "#a855f7",
              bgColor: "rgba(168, 85, 247, 0.15)",
              route: "/matchmaking"
            })}
          </Card>
        </View>

        {/* Finance & Regulations */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Finance & Conduct</Text>
          <Card style={styles.menuCard}>
            {renderHubItem({
              title: "Club Wallet & Dues",
              subtitle: "Balance, pending dues & complete ledger",
              icon: Wallet,
              iconColor: colors.primary,
              bgColor: "rgba(16, 185, 129, 0.15)",
              route: "/wallet"
            })}
            <View style={styles.menuDivider} />
            {renderHubItem({
              title: "Penalties & Rules",
              subtitle: "Late arrivals, no-shows & club fine policies",
              icon: Scale,
              iconColor: colors.danger,
              bgColor: "rgba(239, 68, 68, 0.15)",
              route: "/penalties"
            })}
          </Card>
        </View>

        {/* Account & Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>Preferences & Controls</Text>
          <Card style={styles.menuCard}>
            {renderHubItem({
              title: "Notification Inbox",
              subtitle: "Club announcements & match updates",
              icon: Bell,
              iconColor: "#3b82f6",
              bgColor: "rgba(59, 130, 246, 0.15)",
              route: "/(tabs)/notifications"
            })}
            <View style={styles.menuDivider} />
            {renderHubItem({
              title: "App & Security Settings",
              subtitle: "Profile specs, password change & club config",
              icon: Settings,
              iconColor: colors.textMuted,
              bgColor: "rgba(255, 255, 255, 0.08)",
              route: "/settings"
            })}
            <View style={styles.menuDivider} />
            {renderHubItem({
              title: "Account & Sign Out",
              subtitle: "Session tokens & logout controls",
              icon: User,
              iconColor: colors.danger,
              bgColor: "rgba(239, 68, 68, 0.12)",
              route: "/(tabs)/profile"
            })}
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    padding: 16,
    gap: 18,
    paddingBottom: 36
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.primary
  },
  profileInfo: {
    flex: 1
  },
  profileName: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text
  },
  profileEmail: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1
  },
  profileBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6
  },
  clubSwitchLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  clubSwitchText: {
    fontSize: 11,
    color: colors.primary,
    fontWeight: "600"
  },
  section: {
    gap: 8
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginLeft: 4
  },
  menuCard: {
    padding: 4,
    borderRadius: 14
  },
  hubItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center"
  },
  itemContent: {
    flex: 1
  },
  itemTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.text
  },
  itemSubtitle: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.cardBorder,
    marginHorizontal: 12
  }
});

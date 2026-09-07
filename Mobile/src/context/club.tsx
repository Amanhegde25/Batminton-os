import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TouchableWithoutFeedback
} from "react-native";
import { useAuth } from "./auth";
import { api } from "../lib/api";
import { storage } from "../lib/storage";
import { colors } from "../theme/colors";
import type { Me, MeClub, MeMembership } from "../lib/types";

const ACTIVE_CLUB_KEY = "bcos_active_club_id";

interface ClubContextType {
  me: Me | null;
  activeClubId: string | null;
  activeClub: MeClub | null;
  activeMembership: MeMembership | null;
  isStaff: boolean;
  isCoach: boolean;
  isLoading: boolean;
  clubs: MeClub[];
  switchClub: (clubId: string) => Promise<void>;
  refreshClubContext: () => Promise<void>;
  openClubSwitcher: () => void;
  closeClubSwitcher: () => void;
}

const ClubContext = createContext<ClubContextType | undefined>(undefined);

export function ClubProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [me, setMe] = useState<Me | null>(null);
  const [activeClubId, setActiveClubId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [switcherVisible, setSwitcherVisible] = useState(false);

  const fetchClubData = useCallback(async () => {
    if (!token || !user) {
      setMe(null);
      setActiveClubId(null);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.users.me();
      setMe(data);

      const storedClubId = await storage.getItemAsync(ACTIVE_CLUB_KEY);
      const validStored =
        storedClubId && data.memberships.some((m) => m.club.id === storedClubId);

      const chosenClubId = validStored
        ? storedClubId
        : data.memberships[0]?.club.id ?? null;

      setActiveClubId(chosenClubId);
      if (chosenClubId) {
        await storage.setItemAsync(ACTIVE_CLUB_KEY, chosenClubId);
      }
    } catch (err) {
      console.warn("[ClubContext] Failed to load club profile:", err);
    } finally {
      setIsLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    void fetchClubData();
  }, [fetchClubData]);

  const switchClub = useCallback(
    async (clubId: string) => {
      setActiveClubId(clubId);
      await storage.setItemAsync(ACTIVE_CLUB_KEY, clubId);
      setSwitcherVisible(false);
    },
    []
  );

  const activeMembership = useMemo(() => {
    if (!me || !activeClubId) return null;
    return me.memberships.find((m) => m.club.id === activeClubId) ?? null;
  }, [me, activeClubId]);

  const activeClub = activeMembership?.club ?? null;

  const isStaff = useMemo(() => {
    const role = activeMembership?.role;
    return role === "OWNER" || role === "ADMIN";
  }, [activeMembership]);

  const isCoach = useMemo(() => {
    const role = activeMembership?.role;
    return role === "COACH" || role === "ADMIN" || role === "OWNER";
  }, [activeMembership]);

  const clubs = useMemo(() => {
    return me?.memberships.map((m) => m.club) ?? [];
  }, [me]);

  const value = useMemo(
    () => ({
      me,
      activeClubId,
      activeClub,
      activeMembership,
      isStaff,
      isCoach,
      isLoading,
      clubs,
      switchClub,
      refreshClubContext: fetchClubData,
      openClubSwitcher: () => setSwitcherVisible(true),
      closeClubSwitcher: () => setSwitcherVisible(false)
    }),
    [
      me,
      activeClubId,
      activeClub,
      activeMembership,
      isStaff,
      isCoach,
      isLoading,
      clubs,
      switchClub,
      fetchClubData
    ]
  );

  return (
    <ClubContext.Provider value={value}>
      {children}

      {/* Club Switcher Modal */}
      <Modal
        visible={switcherVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setSwitcherVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setSwitcherVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Club</Text>
                  <Text style={styles.modalSubtitle}>
                    Switch between your club memberships
                  </Text>
                </View>

                <ScrollView style={styles.clubList}>
                  {clubs.map((club) => {
                    const isSelected = club.id === activeClubId;
                    const membership = me?.memberships.find((m) => m.club.id === club.id);

                    return (
                      <TouchableOpacity
                        key={club.id}
                        style={[
                          styles.clubItem,
                          isSelected && styles.clubItemActive
                        ]}
                        onPress={() => void switchClub(club.id)}
                      >
                        <View style={styles.clubIcon}>
                          <Text style={styles.clubEmoji}>🏸</Text>
                        </View>
                        <View style={styles.clubDetails}>
                          <Text
                            style={[
                              styles.clubName,
                              isSelected && styles.clubNameActive
                            ]}
                          >
                            {club.name}
                          </Text>
                          <Text style={styles.clubRole}>
                            {membership?.role ?? "MEMBER"} • {club.city || "Club"}
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={styles.checkIndicator}>
                            <Text style={styles.checkText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <TouchableOpacity
                  style={styles.closeBtn}
                  onPress={() => setSwitcherVisible(false)}
                >
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </ClubContext.Provider>
  );
}

export function useClub() {
  const ctx = useContext(ClubContext);
  if (!ctx) {
    throw new Error("useClub must be used within a ClubProvider");
  }
  return ctx;
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    padding: 24
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    maxHeight: "80%"
  },
  modalHeader: {
    marginBottom: 16
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text
  },
  modalSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  clubList: {
    marginVertical: 8
  },
  clubItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.inputBg,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.inputBorder
  },
  clubItemActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight
  },
  clubIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  clubEmoji: {
    fontSize: 18
  },
  clubDetails: {
    flex: 1
  },
  clubName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text
  },
  clubNameActive: {
    color: colors.primary,
    fontWeight: "700"
  },
  clubRole: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2
  },
  checkIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8
  },
  checkText: {
    color: colors.primaryForeground,
    fontSize: 14,
    fontWeight: "700"
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.05)"
  },
  closeBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  }
});

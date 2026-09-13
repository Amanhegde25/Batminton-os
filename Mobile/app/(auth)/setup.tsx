import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/auth";
import { colors } from "../../src/theme/colors";
import { Button } from "../../src/components/Button";
import { api } from "../../src/lib/api";

export default function SetupScreen() {
  const router = useRouter();
  const { user, updateUser } = useAuth();

  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [aadhar, setAadhar] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      if (user.email) setEmail(user.email);
      if (user.mobile) setMobile(user.mobile);
      if (user.aadhar) setAadhar(formatAadhar(user.aadhar));
    }
  }, [user]);

  function formatAadhar(val: string): string {
    const digits = val.replace(/\D/g, "").slice(0, 12);
    const parts = [];
    for (let i = 0; i < digits.length; i += 4) {
      parts.push(digits.slice(i, i + 4));
    }
    return parts.join(" ");
  }

  async function handleSave() {
    setErrorMessage(null);
    const cleanAadhar = aadhar.replace(/\D/g, "");

    if (cleanAadhar && cleanAadhar.length !== 12) {
      setErrorMessage("Aadhaar number must be exactly 12 digits (or leave empty).");
      return;
    }

    setLoading(true);
    try {
      const res = await api.users.setup({
        email: email.trim() || undefined,
        mobile: mobile.trim() || undefined,
        aadhar: cleanAadhar || undefined,
        skip: false
      });
      await updateUser(res.user);
      router.replace("/(tabs)");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save profile setup");
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    setErrorMessage(null);
    setLoading(true);
    try {
      const res = await api.users.setup({ skip: true });
      await updateUser(res.user);
      router.replace("/(tabs)");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to skip setup");
    } finally {
      setLoading(false);
    }
  }

  const needsEmail = !user?.email;
  const needsMobile = !user?.mobile;

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.badgePill}>
              <Text style={styles.badgePillText}>Step 2 of 2: Profile Setup</Text>
            </View>
            <Text style={styles.title}>Welcome, {user?.name || "Player"}!</Text>
            <Text style={styles.subtitle}>
              {needsEmail && !needsMobile
                ? "You registered with your phone number. You can optionally link an email and Aadhaar below."
                : !needsEmail && needsMobile
                ? "You registered with your email. You can optionally link your phone number and Aadhaar below."
                : "You can optionally link contact details and Aadhaar number below."}
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            {/* Show already linked contact info */}
            {!needsEmail && (
              <View style={styles.field}>
                <Text style={styles.label}>Email Address (Linked)</Text>
                <TextInput
                  value={user?.email || ""}
                  editable={false}
                  style={[styles.input, styles.disabledInput]}
                />
              </View>
            )}

            {!needsMobile && (
              <View style={styles.field}>
                <Text style={styles.label}>Mobile Number (Linked)</Text>
                <TextInput
                  value={user?.mobile || ""}
                  editable={false}
                  style={[styles.input, styles.disabledInput]}
                />
              </View>
            )}

            {/* Prompt for missing contact info */}
            {needsEmail && (
              <View style={styles.field}>
                <Text style={styles.label}>Email Address (Optional)</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@club.com"
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Text style={styles.hintText}>
                  Link an email for password recovery and tournament notifications.
                </Text>
              </View>
            )}

            {needsMobile && (
              <View style={styles.field}>
                <Text style={styles.label}>Mobile Number (Optional)</Text>
                <TextInput
                  value={mobile}
                  onChangeText={setMobile}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={colors.textSubtle}
                  keyboardType="phone-pad"
                  style={styles.input}
                />
                <Text style={styles.hintText}>
                  Add your phone number for instant match alerts and OTP sign-in.
                </Text>
              </View>
            )}

            {/* Aadhaar Number */}
            <View style={styles.field}>
              <Text style={styles.label}>Aadhaar Number (Optional)</Text>
              <TextInput
                value={aadhar}
                onChangeText={(val) => setAadhar(formatAadhar(val))}
                placeholder="XXXX XXXX XXXX"
                placeholderTextColor={colors.textSubtle}
                keyboardType="numeric"
                maxLength={14}
                style={styles.input}
              />
              <Text style={styles.hintText}>
                12-digit Indian UIDAI ID. Completely optional and stored securely.
              </Text>
            </View>

            <Button
              title="Save & Continue"
              onPress={handleSave}
              loading={loading}
              style={styles.submitBtn}
            />

            <TouchableOpacity
              style={styles.skipBtn}
              onPress={handleSkip}
              disabled={loading}
            >
              <Text style={styles.skipBtnText}>Skip for now →</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24
  },
  header: {
    alignItems: "center",
    marginBottom: 24
  },
  badgePill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: colors.primary + "20",
    marginBottom: 12
  },
  badgePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 6
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 290,
    lineHeight: 18
  },
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 18
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center"
  },
  form: {
    gap: 16
  },
  field: {
    gap: 6
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text
  },
  hintText: {
    fontSize: 11,
    color: colors.textSubtle,
    lineHeight: 15
  },
  input: {
    height: 48,
    backgroundColor: colors.inputBg,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 15
  },
  disabledInput: {
    opacity: 0.6,
    backgroundColor: colors.card
  },
  submitBtn: {
    marginTop: 8
  },
  skipBtn: {
    alignItems: "center",
    paddingVertical: 10
  },
  skipBtnText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600"
  }
});

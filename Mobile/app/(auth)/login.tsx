import React, { useState } from "react";
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
import { useAuth } from "../../src/context/auth";
import { colors } from "../../src/theme/colors";
import { Button } from "../../src/components/Button";
import { loginSchema } from "../../src/lib/schemas";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleLogin() {
    setErrorMessage(null);
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      setErrorMessage(result.error.issues[0]?.message ?? "Invalid credentials");
      return;
    }

    setLoading(true);
    try {
      await signIn({ email, password });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to sign in. Check credentials."
      );
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string, demoPass: string) {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  }

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
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>🏸</Text>
            </View>
            <Text style={styles.title}>Badminton Club OS</Text>
            <Text style={styles.subtitle}>
              Sign in to manage club bookings, matches, and notifications
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.textSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textSubtle}
                secureTextEntry
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              style={styles.submitBtn}
            />

            <View style={styles.demoSection}>
              <Text style={styles.demoTitle}>Quick Demo Logins:</Text>
              <View style={styles.demoButtons}>
                <TouchableOpacity
                  style={styles.demoBtn}
                  onPress={() => fillDemo("admin@bcos.app", "Admin@123!")}
                >
                  <Text style={styles.demoBtnText}>Admin</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.demoBtn}
                  onPress={() => fillDemo("player1@demo.club", "Password123!")}
                >
                  <Text style={styles.demoBtnText}>Player 1</Text>
                </TouchableOpacity>
              </View>
            </View>
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
    marginBottom: 32
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  logoText: {
    fontSize: 32
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    textAlign: "center",
    marginBottom: 8
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 20
  },
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center"
  },
  form: {
    gap: 18
  },
  field: {
    gap: 8
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text
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
  submitBtn: {
    marginTop: 8
  },
  demoSection: {
    marginTop: 20,
    alignItems: "center",
    gap: 8
  },
  demoTitle: {
    fontSize: 12,
    color: colors.textSubtle
  },
  demoButtons: {
    flexDirection: "row",
    gap: 12
  },
  demoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder
  },
  demoBtnText: {
    fontSize: 12,
    color: colors.textMuted
  }
});

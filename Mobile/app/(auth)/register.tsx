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
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/auth";
import { colors } from "../../src/theme/colors";
import { Button } from "../../src/components/Button";
import { registerSchema } from "../../src/lib/schemas";

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleRegister() {
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    const trimmedMobile = mobile.trim();

    if (!trimmedEmail && !trimmedMobile) {
      setErrorMessage("Please provide either an email address or a mobile number.");
      return;
    }

    const validation = registerSchema.safeParse({
      name: name.trim(),
      email: trimmedEmail || undefined,
      mobile: trimmedMobile || undefined,
      password
    });

    if (!validation.success) {
      setErrorMessage(validation.error.issues[0]?.message ?? "Invalid registration details");
      return;
    }

    setLoading(true);
    try {
      await signUp({
        name: name.trim(),
        email: trimmedEmail || undefined,
        mobile: trimmedMobile || undefined,
        password
      });
      // Will auto-redirect to setup or tabs via RootNavigator
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
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
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Register with either your email or mobile number to get started.
            </Text>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Ravi Kumar"
                placeholderTextColor={colors.textSubtle}
                autoCapitalize="words"
                style={styles.input}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Email Address (Optional)</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@club.com"
                placeholderTextColor={colors.textSubtle}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
              <Text style={styles.hintText}>Optional if mobile number is provided</Text>
            </View>

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
              <Text style={styles.hintText}>Optional if email address is provided</Text>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.textSubtle}
                secureTextEntry
                autoCapitalize="none"
                style={styles.input}
              />
            </View>

            <Button
              title="Create Account"
              onPress={handleRegister}
              loading={loading}
              style={styles.submitBtn}
            />

            <TouchableOpacity
              style={{ marginTop: 14, alignItems: "center" }}
              onPress={() => router.back()}
            >
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                Already have an account? <Text style={{ color: colors.primary, fontWeight: "600" }}>Sign in</Text>
              </Text>
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
    color: colors.textSubtle
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
  }
});

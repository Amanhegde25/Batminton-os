import { Platform } from "react-native";
import Constants from "expo-constants";
import { createApiClient } from "./api-client";
import { storage } from "./storage";

export const AUTH_TOKEN_KEY = "bcos_auth_token";
export const USER_INFO_KEY = "bcos_user_info";

export function getBaseApiUrl(): string {
  // 1. Explicit env variable (from Mobile/.env)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Dynamic host detection from Expo Metro connection (works automatically for physical phones & emulators over Wi-Fi)
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost ??
    (Constants as any).manifest?.debuggerHost;

  if (hostUri) {
    const host = hostUri.split(":")[0];
    if (host && host !== "localhost" && host !== "127.0.0.1") {
      return `http://${host}:3000`;
    }
  }

  // 3. Android Emulator fallback (maps 10.0.2.2 to host machine's localhost)
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }

  // 4. iOS Simulator & Web fallback
  return "http://localhost:3000";
}

let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  unauthorizedHandler = handler;
}

export const api = createApiClient({
  baseUrl: getBaseApiUrl(),
  getToken: async () => {
    return await storage.getItemAsync(AUTH_TOKEN_KEY);
  },
  onUnauthorized: () => {
    if (unauthorizedHandler) {
      unauthorizedHandler();
    }
  }
});

import { Platform } from "react-native";
import { createApiClient } from "./api-client";
import { storage } from "./storage";

export const AUTH_TOKEN_KEY = "bcos_auth_token";
export const USER_INFO_KEY = "bcos_user_info";

export function getBaseApiUrl(): string {
  // 1. Explicit env variable (for physical devices or production)
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 2. Android Emulator maps 10.0.2.2 to host machine's localhost:3000
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3000";
  }

  // 3. iOS Simulator & Web both map to localhost:3000
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

import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required")
});

export type LoginInput = z.infer<typeof loginSchema>;

export const markNotificationsSchema = z.object({
  ids: z.array(z.string()).optional()
});

export type MarkNotificationsInput = z.infer<typeof markNotificationsSchema>;

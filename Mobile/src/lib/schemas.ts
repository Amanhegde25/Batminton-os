import { z } from "zod";

export const loginSchema = z.object({
  identifier: z.string().min(3, "Please enter your email or mobile number"),
  password: z.string().min(1, "Password is required")
});

export type LoginInput = {
  identifier?: string;
  email?: string;
  mobile?: string;
  password: string;
};

export const registerSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address").optional().or(z.literal("")),
    mobile: z.string().regex(/^\+?[0-9]{10,14}$/, "Please enter a valid mobile number (10-14 digits)").optional().or(z.literal("")),
    password: z.string().min(8, "Password must be at least 8 characters")
  })
  .refine((data) => Boolean((data.email && data.email.trim()) || (data.mobile && data.mobile.trim())), {
    message: "Either email or mobile number must be provided"
  });

export type RegisterInput = z.infer<typeof registerSchema>;

export const markNotificationsSchema = z.object({
  ids: z.array(z.string()).optional()
});

export type MarkNotificationsInput = z.infer<typeof markNotificationsSchema>;

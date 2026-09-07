import type { User } from "@prisma/client";

export interface SessionUser {
  id: string;
  email: string;
  mobile: string | null;
  name: string;
  photoUrl: string | null;
  role: string;
  tokenVersion: number;
}

export type { User };

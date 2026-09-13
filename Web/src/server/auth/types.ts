export interface SessionUser {
  id: string;
  email: string | null;
  mobile: string | null;
  aadhar?: string | null;
  hasCompletedSetup?: boolean;
  name: string;
  photoUrl: string | null;
  role: string;
  tokenVersion: number;
}

export interface User {
  id: string;
  email: string | null;
  mobile: string | null;
  aadhar: string | null;
  hasCompletedSetup: boolean;
  passwordHash: string | null;
  name: string;
  photoUrl: string | null;
  dob: string | null;
  gender: string | null;
  role: string;
  skillLevel: string | null;
  playingStyle: string | null;
  dominantHand: string | null;
  preferredTime: string | null;
  googleId: string | null;
  tokenVersion: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

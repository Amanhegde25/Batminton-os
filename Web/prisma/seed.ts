import { PrismaClient } from "@prisma/client";
import { registerUser } from "../src/server/services/users";
import { createClub } from "../src/server/services/clubs";
import { addMember } from "../src/server/services/members";
import { createCourt } from "../src/server/services/courts";
import { ensureWallet, postTransaction, getMyWallet } from "../src/server/services/wallets";
import { createMatch, completeMatch } from "../src/server/services/matches";
import { createTournament, startTournament, submitScore } from "../src/server/services/tournaments";
import { runDailySweep } from "../src/server/services/attendance";
import { issueManual } from "../src/server/services/penalties";
import { randomValidSet, scoreToString, type SetScore } from "../src/lib/engines/scoring";

const prisma = new PrismaClient();

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20260823);

function dayKeyOffset(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FIRST_NAMES = [
  "Aarav", "Diya", "Rohan", "Ananya", "Vikram", "Sneha", "Karthik", "Meera", "Arjun", "Priya",
  "Sanjay", "Kavya", "Nikhil", "Riya", "Aditya", "Tanvi", "Harish", "Divya", "Manoj", "Shruti",
  "Varun", "Nisha", "Prakash", "Lakshmi", "Suresh", "Deepa", "Girish", "Anita"
];
const LAST_NAMES = ["Sharma", "Iyer", "Patel", "Reddy", "Nair", "Gupta", "Rao", "Menon", "Joshi", "Kulkarni"];

async function main() {
  console.log("🌱 Resetting database…");
  const tables = [
    "walletTransaction", "wallet", "penaltyRule", "penalty", "ratingHistory", "playerRating",
    "matchScore", "matchPlayer", "matchTeam", "courtBooking", "match",
    "tournamentMatch", "tournamentParticipant", "tournament",
    "attendanceRecord", "aIInsight", "videoAnalysis", "notification",
    "auditLog", "otpCode", "passwordResetToken", "clubMember", "court", "club", "user"
  ] as const;
  for (const t of tables) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any)[t].deleteMany({});
  }

  console.log("👑 Creating super admin…");
  const superAdmin = await registerUser({
    name: "Platform Admin",
    email: "admin@bcos.app",
    password: "Admin@123!",
    mobile: "+910000000001"
  });
  await prisma.user.update({ where: { id: superAdmin.id }, data: { role: "SUPER_ADMIN" } });

  const password = "Password123!";
  const mkPlayer = async (i: number, overrides?: { mobile?: string }) => {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 3 + Math.floor(i / FIRST_NAMES.length)) % LAST_NAMES.length];
    return registerUser({
      name: `${first} ${last}`,
      email: `player${i}@demo.club`,
      password,
      mobile: overrides?.mobile ?? `+9199${String(10000000 + i * 137).slice(0, 8)}`
    });
  };

  console.log("🏸 Creating clubs and owners…");
  const ownerA = await mkPlayer(100, { mobile: "+919900000101" });
  const ownerB = await mkPlayer(200, { mobile: "+919900000201" });

  const clubA = await createClub(ownerA, {
    name: "Smash Arena",
    city: "Bengaluru",
    description: "Competitive doubles club with a strong evening crowd. Home of the Monsoon Smash Cup.",
    lat: 12.9716,
    lng: 77.5946
  });
  const clubB = await createClub(ownerB, {
    name: "Drop Shot Club",
    city: "Pune",
    description: "Friendly neighbourhood badminton club — all levels welcome.",
    lat: 18.5204,
    lng: 73.8567
  });
  const clubC = await createClub(ownerA, {
    name: "Indiranagar Badminton Hub",
    city: "Bengaluru",
    address: "100ft Road, Indiranagar",
    description: "Premier air-conditioned wooden courts with pro coaching and weekly socials.",
    lat: 12.9784,
    lng: 77.6408
  });
  const clubD = await createClub(ownerB, {
    name: "Koramangala Smash Zone",
    city: "Bengaluru",
    address: "5th Block, Koramangala",
    description: "Spacious 6-court facility with synthetic BWF-standard flooring and evening ladders.",
    lat: 12.9352,
    lng: 77.6245
  });

  await prisma.club.update({ where: { id: clubA.id }, data: { subscriptionPlan: "PREMIUM" } });
  await prisma.club.update({ where: { id: clubB.id }, data: { subscriptionPlan: "PRO" } });
  await prisma.club.update({ where: { id: clubC.id }, data: { subscriptionPlan: "PREMIUM" } });
  await prisma.club.update({ where: { id: clubD.id }, data: { subscriptionPlan: "PRO" } });

  console.log("👥 Creating members…");
  const playersA: Awaited<ReturnType<typeof registerUser>>[] = [ownerA];
  const playersB: Awaited<ReturnType<typeof registerUser>>[] = [ownerB];

  for (let i = 1; i <= 15; i++) {
    const u = await mkPlayer(i);
    await addMember(clubA.id, ownerA, { email: u.email, name: u.name, role: i === 2 ? "COACH" : i === 3 ? "ADMIN" : "PLAYER" });
    playersA.push(u);
  }
  for (let i = 11; i <= 20; i++) {
    const u = await mkPlayer(i + 500);
    await addMember(clubB.id, ownerB, { email: u.email, name: u.name, role: i === 12 ? "COACH" : "PLAYER" });
    playersB.push(u);
  }

  console.log("🏟️ Courts & wallets…");
  for (const [clubId, n] of [
    [clubA.id, 4],
    [clubB.id, 3]
  ] as const) {
    const names = ["Centre Court", "Back Court", "Side Court A", "Side Court B"];
    for (let c = 1; c <= n; c++) {
      await createCourt(clubId, {
        name: names[c - 1],
        type: c % 2 === 0 ? "WOODEN" : "SYNTHETIC",
        hourlyFee: c === 1 ? 15000 : 10000
      });
    }
  }

  const allMemberships = await prisma.clubMember.findMany();
  for (const m of allMemberships) {
    const wallet = await ensureWallet(prisma, m.clubId, m.userId);
    if (wallet.balance === 0) {
      await postTransaction(prisma, {
        clubId: m.clubId,
        userId: m.userId,
        amount: 50000,
        type: "OPENING_CREDIT",
        description: "Welcome bonus — happy smashing!",
        createdById: null
      });
    }
  }

  console.log("📅 Attendance history (35 days)…");
  const today = new Date();
  const attendanceRows: {
    clubId: string;
    userId: string;
    day: string;
    status: string;
    method: string;
    createdAt: Date;
  }[] = [];
  for (let off = -35; off <= -1; off++) {
    const day = dayKeyOffset(off);
    const date = new Date(`${day}T09:30:00`);
    if (date.getDay() === 0) continue;
    for (const m of allMemberships.filter((x) => x.clubId === clubA.id || x.clubId === clubB.id)) {
      const roll = rng();
      let status = "PRESENT";
      if (roll < 0.16) continue;
      else if (roll < 0.24) status = "ABSENT";
      else if (roll < 0.34) status = "LATE";
      attendanceRows.push({
        clubId: m.clubId,
        userId: m.userId,
        day,
        status,
        method: rng() < 0.7 ? "QR" : "MANUAL",
        createdAt: date
      });
    }
  }
  await prisma.attendanceRecord.createMany({ data: attendanceRows });

  console.log("🏸 Simulating matches…");
  const skill = new Map<string, number>();
  for (const p of [...playersA, ...playersB]) skill.set(p.id, 0.35 + rng() * 0.3);

  async function simulateMatch(clubId: string, four: string[], dayOffset: number) {
    const shuffled = [...four].sort(() => rng() - 0.5);
    const courts = await prisma.court.findMany({ where: { clubId, deletedAt: null, status: "AVAILABLE" }, take: 1 });
    const when = new Date();
    when.setDate(when.getDate() + dayOffset);
    when.setHours(19, 0, 0, 0);
    const match = await createMatch(clubId, ownerA, {
      type: "DOUBLES",
      teamAUserIds: [shuffled[0], shuffled[1]],
      teamBUserIds: [shuffled[2], shuffled[3]],
      courtId: rng() < 0.6 ? courts[0]?.id ?? null : null,
      scheduledAt: when,
      notes: null,
      notify: false
    });
    const strA = (skill.get(shuffled[0])! + skill.get(shuffled[1])!) / 2;
    const strB = (skill.get(shuffled[2])! + skill.get(shuffled[3])!) / 2;
    const bias = 0.5 + (strA - strB);
    const sets: SetScore[] = [];
    let winsA = 0;
    let winsB = 0;
    while (winsA < 2 && winsB < 2 && sets.length < 3) {
      const s = randomValidSet(rng, Math.min(0.92, Math.max(0.08, bias)));
      sets.push(s);
      if (s.a > s.b) winsA++;
      else winsB++;
    }
    await completeMatch(clubId, match.id, ownerA, { sets });
  }

  for (let off = -30; off <= -1; off += 1) {
    for (const [clubId, pool] of [
      [clubA.id, playersA],
      [clubB.id, playersB]
    ] as const) {
      if (rng() < 0.45) continue;
      const games = 1 + Math.floor(rng() * 2);
      for (let g = 0; g < games; g++) {
        const picks = [...pool].sort(() => rng() - 0.5).slice(0, 4);
        if (picks.length < 4) continue;
        await simulateMatch(clubId, picks.map((p) => p.id), off);
      }
    }
  }

  console.log("🧾 Yesterday's sweep (absence penalties)…");
  const yesterday = dayKeyOffset(-1);
  for (const m of allMemberships.slice(0, 6)) {
    const exists = await prisma.attendanceRecord.findUnique({
      where: { clubId_userId_day: { clubId: m.clubId, userId: m.userId, day: yesterday } }
    });
    if (!exists) {
      await prisma.attendanceRecord.create({
        data: { clubId: m.clubId, userId: m.userId, day: yesterday, status: "ABSENT" }
      });
    }
  }
  await runDailySweep(clubA.id, ownerA, yesterday);

  console.log("⚖️ A manual penalty + reversal example…");
  const victim = playersA[5];
  try {
    await issueManual(clubA.id, ownerA, {
      userId: victim.id,
      eventType: "CUSTOM",
      label: "Broken shutter lock — club property",
      amount: 2500
    });
  } catch {}

  console.log("🏆 Tournament — Monsoon Smash Cup…");
  const t = await createTournament(clubA.id, ownerA, { name: "Monsoon Smash Cup", size: 8, fee: 20000 });
  for (const p of playersA.slice(0, 8)) {
    await prisma.tournamentParticipant.create({ data: { tournamentId: t.id, userId: p.id } }).catch(() => {});
  }
  await startTournament(clubA.id, t.id, ownerA);
  for (const round of [1, 2]) {
    const rms = await prisma.tournamentMatch.findMany({
      where: { tournamentId: t.id, round },
      orderBy: { slot: "asc" }
    });
    for (const tm of rms) {
      if (tm.status !== "READY") continue;
      const sets: SetScore[] = [];
      let wa = 0;
      let wb = 0;
      while (wa < 2 && wb < 2 && sets.length < 3) {
        const s = randomValidSet(rng, rng() < 0.5 ? 0.42 : 0.58);
        sets.push(s);
        if (s.a > s.b) wa++;
        else wb++;
      }
      await submitScore(clubA.id, t.id, tm.id, ownerA, scoreToString(sets)).catch(() => {});
    }
  }

  console.log("🎥 Sample video analysis…");
  const videoOwner = playersA[1];
  await prisma.videoAnalysis.create({
    data: {
      clubId: clubA.id,
      userId: videoOwner.id,
      originalName: "smash-drill-session.mp4",
      storageKey: `videos/${clubA.id}/sample/smash-drill-session.mp4`,
      mimeType: "video/mp4",
      sizeBytes: 48_200_000,
      status: "COMPLETED",
      result: JSON.stringify({
        footworkScore: 78,
        shotAccuracy: 71,
        courtCoverage: 83,
        smashSpeedKmh: 96,
        rallyCount: 22,
        insights: [
          "Your lunge recovery adds ~0.4s before the next shot — drill shadow footwork.",
          "Backhand clears land short 68% of the time; strengthen wrist supination.",
          "Strong net coverage — keep taking the shuttle early."
        ]
      }),
      completedAt: new Date()
    }
  });

  console.log("💰 A couple of court bookings…");
  const courtRows = await prisma.court.findMany({ where: { clubId: clubA.id } });
  const tomorrowAt = (h: number) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(h, 0, 0, 0);
    return d;
  };
  await prisma.courtBooking.createMany({
    data: [
      {
        clubId: clubA.id,
        courtId: courtRows[0].id,
        userId: playersA[2].id,
        startTime: tomorrowAt(18),
        endTime: tomorrowAt(19),
        status: "CONFIRMED",
        amount: courtRows[0].hourlyFee,
        notes: "Weekly doubles slot"
      },
      {
        clubId: clubA.id,
        courtId: courtRows[1].id,
        userId: playersA[4].id,
        startTime: tomorrowAt(19),
        endTime: tomorrowAt(20),
        status: "CONFIRMED",
        amount: courtRows[1].hourlyFee,
        notes: null
      }
    ]
  });

  const w = await getMyWallet(clubA.id, playersA[0].id);
  console.log(`✅ Seed complete.`);
  console.log(`   Clubs: ${clubA.name} (PREMIUM), ${clubB.name} (PRO)`);
  console.log(`   Members: ${allMemberships.length}`);
  console.log(`   Example balance (${playersA[0].name}): ₹${(w.wallet?.balance ?? 0) / 100}`);
  console.log("");
  console.log("   Super admin : admin@bcos.app / Admin@123!");
  console.log(`   Owner A     : ${ownerA.email} / ${password}`);
  console.log(`   Player      : player1@demo.club / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

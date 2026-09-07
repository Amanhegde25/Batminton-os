import { prisma } from "@/server/db";
import { env } from "@/lib/env";

export interface CoachingPayload {
  headline: string;
  summary: string;
  insights: { title: string; detail: string }[];
  focusAreas: string[];
  drills: string[];
  disclaimer: string;
}

export interface CoachingContext {
  name: string;
  played: number;
  winRate: number;
  winRateThisMonth: number;
  winRateLastMonth: number;
  ratingDeltaMonth: number;
  avgPointDiff: number;
  decidingSetWinRate: number | null;
  closeLosses: number;
  attendancePct: number;
  bestPartner?: { name: string; winRate: number } | null;
  hardestOpponent?: { name: string; losses: number } | null;
}

export interface AIProvider {
  name: string;
  coachingInsights(ctx: CoachingContext): Promise<CoachingPayload>;
}

export class RuleBasedProvider implements AIProvider {
  name = "rulebased";

  async coachingInsights(ctx: CoachingContext): Promise<CoachingPayload> {
    const trendDelta = ctx.winRateThisMonth - ctx.winRateLastMonth;
    const insights: { title: string; detail: string }[] = [];
    const focus: string[] = [];
    const drills: string[] = [];

    if (ctx.played === 0) {
      return {
        headline: "Not enough match data yet",
        summary: `Play a few rated matches and check in regularly — insights will appear as soon as there is data to analyse.`,
        insights: [],
        focusAreas: ["Play at least 5 matches"],
        drills: [],
        disclaimer: DISCLAIMER
      };
    }

    if (Math.abs(trendDelta) >= 3) {
      insights.push({
        title: trendDelta > 0 ? "Performance trending up" : "Recent dip in results",
        detail:
          trendDelta > 0
            ? `Win rate improved by ${trendDelta}% compared to last month. Keep the current routine.`
            : `Win rate dropped ${Math.abs(trendDelta)}% vs last month — often a sign of fatigue or opponents adapting.`
      });
    }

    if (ctx.ratingDeltaMonth !== 0) {
      insights.push({
        title: "Rating movement",
        detail: `Rating moved ${ctx.ratingDeltaMonth > 0 ? "+" : ""}${ctx.ratingDeltaMonth} points this month, which suggests ${
          ctx.ratingDeltaMonth > 0 ? "consistently beating similar or stronger opposition" : "close matches going against you lately"
        }.`
      });
    }

    if (ctx.decidingSetWinRate !== null && ctx.decidingSetWinRate < 40 && ctx.played >= 4) {
      insights.push({
        title: "Deciding-set pressure",
        detail: `You win only ${Math.round(ctx.decidingSetWinRate)}% of deciding sets. Conditioning late in long games appears to be a factor.`
      });
      focus.push("Endurance for third sets");
      drills.push("Interval footwork ladders (6 x 2 min) twice a week");
    } else if (ctx.decidingSetWinRate !== null && ctx.decidingSetWinRate >= 60) {
      insights.push({ title: "Clutch finishing", detail: `${Math.round(ctx.decidingSetWinRate)}% of your deciding sets end in a win — a real strength under pressure.` });
    }

    if (ctx.closeLosses >= 2) {
      insights.push({
        title: "Close sets slipping away",
        detail: `${ctx.closeLosses} recent set(s) were lost by 2 points or fewer. Small tactical choices at deuce are costing games.`
      });
      focus.push("Deuce-point tactics");
      drills.push("Practice serve-and-third-shot patterns starting at 20-all in sparring");
    }

    if (ctx.avgPointDiff <= -3 && ctx.played >= 3) {
      focus.push("Defensive positioning & lifts");
      insights.push({
        title: "Point differential",
        detail: `Average point difference is ${ctx.avgPointDiff}. Losing rallies on the defence-to-attack transition looks like the pattern.`
      });
      drills.push("Shadow defensive footwork: 10 min/session");
    } else if (ctx.avgPointDiff >= 3) {
      insights.push({
        title: "Dominant scoring",
        detail: `Average margin of +${ctx.avgPointDiff} points per match indicates control of rally tempo.`
      });
    }

    if (ctx.bestPartner) {
      insights.push({
        title: "Strongest partnership",
        detail: `With ${ctx.bestPartner.name} you win ${ctx.bestPartner.winRate}% of doubles — worth keeping for tournaments.`
      });
    }
    if (ctx.hardestOpponent) {
      insights.push({
        title: "Toughest matchup",
        detail: `${ctx.hardestOpponent.name} has beaten you ${ctx.hardestOpponent.losses} time(s). Ask a coach to scout their game next session.`
      });
    }

    if (ctx.attendancePct < 50) {
      insights.push({
        title: "Attendance is limiting progress",
        detail: `${ctx.attendancePct}% attendance in the last 30 days. Consistent court time is the single biggest lever on rating right now.`
      });
      focus.push("Consistency: attend at least 2 sessions/week");
    }

    if (focus.length === 0) focus.push("Maintain current form", "Add variation to attacking clears");
    if (drills.length === 0) drills.push("Multi-shuttle net kills: 3 sets of 20", "Backhand corner recovery drill: 10 min");

    const headline =
      trendDelta >= 3
        ? `${ctx.name}'s form is improving fast`
        : ctx.played < 3
          ? "Early days — keep playing"
          : trendDelta <= -3
            ? "Slump detected — targeted fixes available"
            : "Steady form with clear growth areas";

    return {
      headline,
      summary: `Based on ${ctx.played} completed match${ctx.played === 1 ? "" : "es"}, a ${ctx.winRate}% win rate and ${
        ctx.attendancePct
      }% attendance over the last 30 days.`,
      insights,
      focusAreas: focus.slice(0, 3),
      drills,
      disclaimer: DISCLAIMER
    };
  }
}

const DISCLAIMER =
  "AI-generated suggestion based on your match history. Treat as guidance from patterns, not a guaranteed diagnosis.";

export class OpenAIProvider implements AIProvider {
  name = "openai";
  constructor(private model: string, private apiKey: string) {}

  async coachingInsights(ctx: CoachingContext): Promise<CoachingPayload> {
    const prompt = buildPrompt(ctx);
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: "You are a badminton coach. Reply ONLY with JSON matching: {headline,summary,insights:[{title,detail}],focusAreas:[string],drills:[string],disclaimer}" },
            { role: "user", content: prompt }
          ],
          temperature: 0.6
        })
      });
      if (!res.ok) throw new Error(`OpenAI responded ${res.status}`);
      const json: any = await res.json();
      const parsed = JSON.parse(json.choices[0].message.content);
      return { ...parsed, disclaimer: parsed.disclaimer || DISCLAIMER };
    } catch (e) {
      console.error("[ai] openai failed, falling back to rulebased", e);
      const fallback = new RuleBasedProvider();
      return fallback.coachingInsights(ctx);
    }
  }
}

function buildPrompt(ctx: CoachingContext): string {
  return `Analyse this badminton player's stats and produce coaching insights.\n${JSON.stringify(ctx, null, 2)}\nInsights must be hedged suggestions, not certainties.`;
}

export function getAIProvider(): AIProvider {
  if (env.aiProvider === "openai" && env.openaiKey) {
    return new OpenAIProvider(env.openaiModel, env.openaiKey);
  }
  return new RuleBasedProvider();
}

export async function buildCoachingContext(clubId: string, userId: string): Promise<CoachingContext> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const matches = await prisma.match.findMany({
    where: { clubId, status: "COMPLETED", players: { some: { userId } }, type: "DOUBLES" },
    include: { teams: { include: { players: true } }, scores: true },
    orderBy: { endedAt: "desc" },
    take: 100
  });

  let winsAll = 0;
  let playedAll = 0;
  let winsThis = 0;
  let playedThis = 0;
  let winsLast = 0;
  let playedLast = 0;
  let closeLossSets = 0;
  let decidersPlayed = 0;
  let decidersWon = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  const partnerAgg = new Map<string, { played: number; wins: number }>();
  const oppAgg = new Map<string, { losses: number; played: number }>();

  for (const m of matches) {
    const myTeam = m.teams.find((t) => t.players.some((p) => p.userId === userId));
    const otherTeam = m.teams.find((t) => t.teamIndex !== myTeam?.teamIndex);
    if (!myTeam || !otherTeam) continue;
    const ended = m.endedAt ?? m.createdAt;
    const won = m.winnerTeamIndex === myTeam.teamIndex;
    playedAll++;
    if (won) winsAll++;
    if (ended >= thisMonthStart) {
      playedThis++;
      if (won) winsThis++;
    }
    if (ended >= lastMonthStart && ended < thisMonthStart) {
      playedLast++;
      if (won) winsLast++;
    }
    const scores = [...m.scores].sort((a, b) => a.setNumber - b.setNumber);
    const myScores = scores.map((s) => (myTeam.teamIndex === 0 ? s.scoreA : s.scoreB));
    const oppScores = scores.map((s) => (myTeam.teamIndex === 0 ? s.scoreB : s.scoreA));
    pointsFor += myScores.reduce((a, b) => a + b, 0);
    pointsAgainst += oppScores.reduce((a, b) => a + b, 0);
    myScores.forEach((ms, i) => {
      if (ms < (oppScores[i] ?? 0) && Math.abs(ms - (oppScores[i] ?? 0)) <= 2) closeLossSets++;
    });
    if (scores.length >= 2 && scores.length % 2 === 1) {
      decidersPlayed++;
      const lastIdx = scores.length - 1;
      if (myScores[lastIdx] > (oppScores[lastIdx] ?? 0)) decidersWon++;
    }
    for (const p of myTeam.players) {
      if (p.userId === userId) continue;
      const agg = partnerAgg.get(p.userId) ?? { played: 0, wins: 0 };
      agg.played++;
      if (won) agg.wins++;
      partnerAgg.set(p.userId, agg);
    }
    for (const p of otherTeam.players) {
      const agg = oppAgg.get(p.userId) ?? { losses: 0, played: 0 };
      agg.played++;
      if (!won) agg.losses++;
      oppAgg.set(p.userId, agg);
    }
  }

  const monthHistory = await prisma.ratingHistory.findMany({
    where: { clubId, userId, createdAt: { gte: thisMonthStart } }
  });
  const attendanceRecords = await prisma.attendanceRecord.findMany({
    where: { clubId, userId, createdAt: { gte: new Date(now.getTime() - 30 * 86400000) } }
  });
  const attended = attendanceRecords.filter((r) => ["PRESENT", "LATE"].includes(r.status)).length;

  const bestPartnerEntry = [...partnerAgg.entries()]
    .filter(([, v]) => v.played >= 2)
    .sort((a, b) => b[1].wins / b[1].played - a[1].wins / a[1].played)[0];
  const hardestOppEntry = [...oppAgg.entries()].filter(([, v]) => v.losses > 0).sort((a, b) => b[1].losses - a[1].losses)[0];

  const idsToName = async (ids: string[]) => {
    if (ids.length === 0) return null;
    const u = await prisma.user.findUnique({ where: { id: ids[0] }, select: { name: true } });
    return u?.name ?? null;
  };

  const bestPartnerName = bestPartnerEntry ? await idsToName([bestPartnerEntry[0]]) : null;
  const hardestOppName = hardestOppEntry ? await idsToName([hardestOppEntry[0]]) : null;

  return {
    name: user?.name ?? "Player",
    played: playedAll,
    winRate: playedAll ? Math.round((winsAll / playedAll) * 100) : 0,
    winRateThisMonth: playedThis ? Math.round((winsThis / playedThis) * 100) : playedAll ? 0 : 0,
    winRateLastMonth: playedLast ? Math.round((winsLast / playedLast) * 100) : playedThis ? 0 : playedThis || playedLast ? 0 : 50,
    ratingDeltaMonth: Math.round(monthHistory.reduce((s, h) => s + h.delta, 0)),
    avgPointDiff: playedAll ? Math.round(((pointsFor - pointsAgainst) / playedAll) * 10) / 10 : 0,
    decidingSetWinRate: decidersPlayed > 0 ? (decidersWon / decidersPlayed) * 100 : null,
    closeLosses: closeLossSets,
    attendancePct: Math.round((attended / 30) * 100),
    bestPartner: bestPartnerName && bestPartnerEntry ? { name: bestPartnerName, winRate: Math.round((bestPartnerEntry[1].wins / bestPartnerEntry[1].played) * 100) } : null,
    hardestOpponent: hardestOppName && hardestOppEntry ? { name: hardestOppName, losses: hardestOppEntry[1].losses } : null
  };
}

import { users, matches, matchPlayers, matchTeams, matchScores, ratingHistories, attendanceRecords } from "@/server/db";
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
        title: "Dominant scoring margin",
        detail: `Averaging +${ctx.avgPointDiff} points over opponents — attacking tempo is working well.`
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

    if (ctx.attendancePct < 50 && ctx.played >= 3) {
      insights.push({
        title: "Session consistency",
        detail: `Club attendance is at ${ctx.attendancePct}% over the past 30 days. Regular sparring directly correlates with rating retention.`
      });
      focus.push("Weekly attendance consistency");
    }

    if (focus.length === 0) focus.push("Maintain current tactical balance", "Spar against higher-rated pairs");
    if (drills.length === 0) drills.push("Half-court singles for placement: 15 min", "Serve return depth drills: 10 min");

    return {
      headline: headlineFor(ctx),
      summary: summaryFor(ctx),
      insights,
      focusAreas: focus.slice(0, 3),
      drills: drills.slice(0, 3),
      disclaimer: DISCLAIMER
    };
  }
}

const DISCLAIMER = "AI coaching insights are algorithmically generated suggestions based on match history, not certified coaching advice.";

function headlineFor(ctx: CoachingContext): string {
  if (ctx.winRate >= 65) return "Strong current form — maintain offensive pressure";
  if (ctx.winRate <= 35) return "Refocus on shot fundamentals and rally control";
  return "Competitive form with clear margin-of-victory upside";
}

function summaryFor(ctx: CoachingContext): string {
  const parts: string[] = [];
  parts.push(`${ctx.name} has played ${ctx.played} doubles matches recorded, with an overall win rate of ${ctx.winRate}%.`);
  if (ctx.bestPartner) parts.push(`Most effective partnership is with ${ctx.bestPartner.name} (${ctx.bestPartner.winRate}% win rate).`);
  if (ctx.hardestOpponent) parts.push(`Toughest matchup has been against ${ctx.hardestOpponent.name} (${ctx.hardestOpponent.losses} losses).`);
  return parts.join(" ");
}

export class OpenAIProvider implements AIProvider {
  name = "openai";

  constructor(private model: string, private apiKey: string) {}

  async coachingInsights(ctx: CoachingContext): Promise<CoachingPayload> {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          model: this.model,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are an expert badminton coach. Return a JSON object matching { headline, summary, insights: [{title, detail}], focusAreas: string[], drills: string[], disclaimer }."
            },
            { role: "user", content: buildPrompt(ctx) }
          ]
        })
      });
      if (!res.ok) throw new Error(`OpenAI error: ${res.statusText}`);
      const json = await res.json();
      const content = json.choices?.[0]?.message?.content;
      const parsed = JSON.parse(content) as CoachingPayload;
      parsed.disclaimer = DISCLAIMER;
      return parsed;
    } catch {
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
  const user = await users().findOne({ id: userId }, { projection: { name: 1 } });
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const userMatches = await matchPlayers().find({ userId }).toArray();
  const userMatchIds = Array.from(new Set(userMatches.map((p) => p.matchId as string)));

  const matchDocs = await matches().find({
    id: { $in: userMatchIds },
    clubId,
    status: "COMPLETED",
    type: "DOUBLES"
  }).sort({ endedAt: -1 }).limit(100).toArray();

  const matchIds = matchDocs.map((m) => m.id as string);

  const [allTeams, allPlayers, allScores] = await Promise.all([
    matchTeams().find({ matchId: { $in: matchIds } }).toArray(),
    matchPlayers().find({ matchId: { $in: matchIds } }).toArray(),
    matchScores().find({ matchId: { $in: matchIds } }).toArray()
  ]);

  const teamsByMatch = new Map<string, any[]>();
  for (const t of allTeams) {
    const list = teamsByMatch.get(t.matchId as string) || [];
    list.push(t);
    teamsByMatch.set(t.matchId as string, list);
  }

  const playersByMatchTeam = new Map<string, any[]>();
  for (const p of allPlayers) {
    const key = `${p.matchId}:${p.teamIndex}`;
    const list = playersByMatchTeam.get(key) || [];
    list.push(p);
    playersByMatchTeam.set(key, list);
  }

  const scoresByMatch = new Map<string, any[]>();
  for (const s of allScores) {
    const list = scoresByMatch.get(s.matchId as string) || [];
    list.push(s);
    scoresByMatch.set(s.matchId as string, list);
  }

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

  for (const m of matchDocs) {
    const mTeams = (teamsByMatch.get(m.id as string) || []).map((t) => ({
      ...t,
      players: playersByMatchTeam.get(`${m.id}:${t.teamIndex}`) || []
    }));
    const mScores = scoresByMatch.get(m.id as string) || [];

    const myTeam = mTeams.find((t) => t.players.some((p: any) => p.userId === userId));
    const otherTeam = mTeams.find((t) => t.teamIndex !== myTeam?.teamIndex);
    if (!myTeam || !otherTeam) continue;
    const ended = (m.endedAt ?? m.createdAt) as Date;
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
    const scores = [...mScores].sort((a, b) => (a.setNumber as number) - (b.setNumber as number));
    const myScores = scores.map((s) => (myTeam.teamIndex === 0 ? (s.scoreA as number) : (s.scoreB as number)));
    const oppScores = scores.map((s) => (myTeam.teamIndex === 0 ? (s.scoreB as number) : (s.scoreA as number)));
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
      const agg = partnerAgg.get(p.userId as string) ?? { played: 0, wins: 0 };
      agg.played++;
      if (won) agg.wins++;
      partnerAgg.set(p.userId as string, agg);
    }
    for (const p of otherTeam.players) {
      const agg = oppAgg.get(p.userId as string) ?? { losses: 0, played: 0 };
      agg.played++;
      if (!won) agg.losses++;
      oppAgg.set(p.userId as string, agg);
    }
  }

  const [monthHistory, attRecords] = await Promise.all([
    ratingHistories().find({ clubId, userId, createdAt: { $gte: thisMonthStart } }).toArray(),
    attendanceRecords().find({ clubId, userId, createdAt: { $gte: new Date(now.getTime() - 30 * 86400000) } }).toArray()
  ]);

  const attended = attRecords.filter((r) => ["PRESENT", "LATE"].includes(r.status as string)).length;

  const bestPartnerEntry = [...partnerAgg.entries()]
    .filter(([, v]) => v.played >= 2)
    .sort((a, b) => b[1].wins / b[1].played - a[1].wins / a[1].played)[0];
  const hardestOppEntry = [...oppAgg.entries()].filter(([, v]) => v.losses > 0).sort((a, b) => b[1].losses - a[1].losses)[0];

  const idsToName = async (ids: string[]) => {
    if (ids.length === 0) return null;
    const u = await users().findOne({ id: ids[0] }, { projection: { name: 1 } });
    return (u?.name as string) ?? null;
  };

  const bestPartnerName = bestPartnerEntry ? await idsToName([bestPartnerEntry[0]]) : null;
  const hardestOppName = hardestOppEntry ? await idsToName([hardestOppEntry[0]]) : null;

  return {
    name: (user?.name as string) ?? "Player",
    played: playedAll,
    winRate: playedAll ? Math.round((winsAll / playedAll) * 100) : 0,
    winRateThisMonth: playedThis ? Math.round((winsThis / playedThis) * 100) : playedAll ? 0 : 0,
    winRateLastMonth: playedLast ? Math.round((winsLast / playedLast) * 100) : playedThis ? 0 : playedThis || playedLast ? 0 : 50,
    ratingDeltaMonth: Math.round(monthHistory.reduce((s, h) => s + (Number(h.delta) || 0), 0)),
    avgPointDiff: playedAll ? Math.round(((pointsFor - pointsAgainst) / playedAll) * 10) / 10 : 0,
    decidingSetWinRate: decidersPlayed > 0 ? (decidersWon / decidersPlayed) * 100 : null,
    closeLosses: closeLossSets,
    attendancePct: Math.round((attended / 30) * 100),
    bestPartner: bestPartnerName && bestPartnerEntry ? { name: bestPartnerName, winRate: Math.round((bestPartnerEntry[1].wins / bestPartnerEntry[1].played) * 100) } : null,
    hardestOpponent: hardestOppName && hardestOppEntry ? { name: hardestOppName, losses: hardestOppEntry[1].losses } : null
  };
}

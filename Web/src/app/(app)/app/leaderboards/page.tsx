"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import { Avatar, Badge, Card, Select, Spinner } from "@/components/ui";
import { Tabs } from "@/components/ui";
import {
  Award,
  Rocket,
  Crown,
  Target,
  CalendarDays,
  Flame,
  Handshake,
  Medal,
  ShuttlecockIcon
} from "@/components/icons";

interface Entry {
  userId: string;
  name: string;
  photoUrl: string | null;
  value: number;
  display: string;
  meta?: string;
}

const CATEGORIES = [
  { key: "BEST_PLAYER", label: "Best Player", icon: Award },
  { key: "MOST_IMPROVED", label: "Most Improved", icon: Rocket },
  { key: "HIGHEST_RATING", label: "Highest Rating", icon: Crown },
  { key: "HIGHEST_WIN_RATE", label: "Win Rate %", icon: Target },
  { key: "ATTENDANCE_CHAMPION", label: "Attendance", icon: CalendarDays },
  { key: "LONGEST_WINNING_STREAK", label: "Win Streak", icon: Flame },
  { key: "MOST_MATCHES", label: "Most Matches", icon: ShuttlecockIcon },
  { key: "BEST_DOUBLES", label: "Best Doubles Pair", icon: Handshake }
];

const PERIODS = ["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "ALL_TIME"];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400" title="1st Place">
        <Medal className="h-4 w-4" />
      </span>
    );
  }
  if (rank === 1) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-400/20 text-slate-600 dark:text-slate-300" title="2nd Place">
        <Medal className="h-4 w-4" />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-amber-700/15 text-amber-700 dark:text-amber-500" title="3rd Place">
        <Medal className="h-4 w-4" />
      </span>
    );
  }
  return <span className="inline-block w-7 text-center text-xs font-semibold text-muted-foreground">{rank + 1}</span>;
}

function LeaderboardsInner() {
  const { activeClubId } = useSession();
  const [category, setCategory] = useState("BEST_PLAYER");
  const [period, setPeriod] = useState("MONTHLY");
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeClubId) return;
    setLoading(true);
    void api<Entry[]>(`/clubs/${activeClubId}/leaderboards?category=${category}&period=${period}`)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [activeClubId, category, period]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leaderboards</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Tabs
          tabs={CATEGORIES.map((c) => {
            const Icon = c.icon;
            return {
              key: c.key,
              label: (
                <span className="inline-flex items-center gap-1.5">
                  <Icon className="h-3.5 w-3.5" />
                  <span>{c.label}</span>
                </span>
              )
            };
          })}
          active={category}
          onChange={setCategory}
        />
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="h-9 w-36 text-xs">
          {PERIODS.map((p) => (
            <option key={p} value={p}>
              {p.replace("_", " ").toLowerCase()}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <Card className="divide-y">
          {rows.map((r, i) => (
            <div key={r.userId} className="flex items-center gap-3 p-4">
              <span className="w-8 shrink-0 flex justify-center">
                <RankBadge rank={i} />
              </span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <Avatar name={r.name} src={r.photoUrl} size={38} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                {r.meta && <p className="truncate text-xs text-muted-foreground">{r.meta}</p>}
              </div>
              <Badge tone={i === 0 ? "primary" : "muted"} className="tabular-nums">
                {r.display}
              </Badge>
            </div>
          ))}
          {!loading && rows.length === 0 && (
            <p className="p-10 text-center text-sm text-muted-foreground">No data for this period yet — play more matches!</p>
          )}
        </Card>
      )}
    </div>
  );
}

export default function LeaderboardsPage() {
  return <LeaderboardsInner />;
}

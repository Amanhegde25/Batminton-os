"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Spinner,
  StatCard,
  Sparkline,
  BarChart,
  useToast
} from "@/components/ui";
import {
  Wallet,
  Scale,
  TrendingUp,
  RefreshCw,
  ArrowRight
} from "@/components/icons";

interface RevenueData {
  days: number;
  byType: { type: string; total: number; count: number }[];
  daily: { date: string; total: number; count: number }[];
  unpaidPenalties: { totalDues: number; count: number };
}

export default function ClubAdminFinancePage() {
  const { activeClubId } = useSession();
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const { toast, node } = useToast();

  async function loadRevenue() {
    if (!activeClubId) return;
    setLoading(true);
    try {
      const res = await api<RevenueData>(`/clubs/${activeClubId}/admin/revenue?days=${days}`);
      setData(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load financial metrics", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRevenue();
  }, [activeClubId, days]);

  if (loading && !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  const positiveInflow = data?.byType.filter((t) => t.total > 0).reduce((acc, t) => acc + t.total, 0) || 0;
  const negativeOutflow = Math.abs(data?.byType.filter((t) => t.total < 0).reduce((acc, t) => acc + t.total, 0) || 0);

  const dailySpark = data?.daily.map((d) => Math.max(0, d.total)) || [];

  return (
    <div className="space-y-6">
      {node}

      {/* Header with Range Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Financial Health & Cashflow</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Breakdown of wallet recharges, court booking collections, penalties, and outstanding dues.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-xl bg-muted p-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                  days === d ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadRevenue()} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {data && (
        <>
          {/* Top Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              label={`Inflows (${days}d)`}
              value={`₹${positiveInflow}`}
              icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
              sub={<span className="text-[11px] text-emerald-600 font-medium">Recharges & Credits</span>}
            />
            <StatCard
              label={`Outflows (${days}d)`}
              value={`₹${negativeOutflow}`}
              icon={<Wallet className="h-4 w-4 text-amber-500" />}
              sub={<span className="text-[11px] text-muted-foreground">Court fees & debits</span>}
            />
            <StatCard
              label="Unpaid Penalties"
              value={`₹${data.unpaidPenalties.totalDues}`}
              icon={<Scale className="h-4 w-4 text-destructive" />}
              sub={
                <span className="text-[11px] text-destructive font-medium">
                  {data.unpaidPenalties.count} outstanding fines
                </span>
              }
            />
          </div>

          {/* Detailed Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Transaction Type */}
            <Card className="p-5">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Activity by Transaction Category
              </h3>
              {data.byType.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground">No transactions recorded in this period</div>
              ) : (
                <div className="space-y-3">
                  {data.byType.map((item) => (
                    <div key={item.type} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                      <div>
                        <div className="font-medium text-foreground">{item.type.replace(/_/g, " ")}</div>
                        <div className="text-[11px] text-muted-foreground">{item.count} transactions</div>
                      </div>
                      <div className={`font-mono font-semibold tabular-nums ${item.total >= 0 ? "text-emerald-600" : "text-amber-600"}`}>
                        {item.total >= 0 ? `+₹${item.total}` : `-₹${Math.abs(item.total)}`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Daily Trend Sparkline */}
            <Card className="p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Daily Cashflow Trend ({days}d)
                </h3>
                <p className="text-xs text-muted-foreground mb-4">Aggregated transaction volumes per day</p>
              </div>
              <div className="py-6 border-y border-border/50 text-primary">
                {dailySpark.length > 1 ? (
                  <Sparkline data={dailySpark} height={60} className="text-primary" />
                ) : (
                  <div className="h-14 flex items-center justify-center text-xs text-muted-foreground">
                    Insufficient data for daily curve
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center text-xs text-muted-foreground pt-3">
                <Link href="/app/wallet" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                  View Full Club Wallet Ledger <ArrowRight className="h-3 w-3" />
                </Link>
                <Link href="/app/penalties" className="text-primary hover:underline font-medium inline-flex items-center gap-1">
                  Manage Penalties <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

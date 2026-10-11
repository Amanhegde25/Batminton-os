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
  Table,
  Td,
  useToast
} from "@/components/ui";
import {
  CalendarCheck,
  QrCode,
  Users,
  RefreshCw,
  ArrowRight,
  Clock
} from "@/components/icons";

interface AttendanceRecordItem {
  id: string;
  day: string;
  userId: string;
  userName: string;
  userEmail: string | null;
  status: string;
  method?: string;
  createdAt: string;
}

export default function ClubAdminAttendancePage() {
  const { activeClubId } = useSession();
  const [records, setRecords] = useState<AttendanceRecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast, node } = useToast();

  async function loadAttendance() {
    if (!activeClubId) return;
    setLoading(true);
    try {
      const res = await api<AttendanceRecordItem[]>(`/clubs/${activeClubId}/admin/reports/attendance`);
      setRecords(res);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load attendance logs", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAttendance();
  }, [activeClubId]);

  if (loading && records.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  }

  // Count check-in methods
  const methodsCount: Record<string, number> = {};
  for (const r of records) {
    const m = r.method || "MANUAL";
    methodsCount[m] = (methodsCount[m] || 0) + 1;
  }

  // Top active players
  const userFrequency: Record<string, { name: string; count: number }> = {};
  for (const r of records) {
    if (!userFrequency[r.userId]) {
      userFrequency[r.userId] = { name: r.userName, count: 0 };
    }
    userFrequency[r.userId].count++;
  }
  const topPlayers = Object.values(userFrequency)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {node}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Attendance Analytics & Check-in Feed</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time feed of member check-ins, validation methods, and habitual regular players.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/app/attendance">
            <Button variant="outline" size="sm" className="gap-1.5 text-xs">
              <QrCode className="h-3.5 w-3.5" /> Launch QR Scanner & Sweeper
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => void loadAttendance()} className="gap-1.5">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          label="Total Check-ins Logged"
          value={records.length}
          icon={<CalendarCheck className="h-4 w-4 text-primary" />}
          sub={<span className="text-[11px] text-muted-foreground">Recent records audit</span>}
        />
        <StatCard
          label="QR Code Scans"
          value={methodsCount["QR"] || 0}
          icon={<QrCode className="h-4 w-4 text-emerald-500" />}
          sub={
            <span className="text-[11px] text-emerald-600 font-medium">
              {Math.round(((methodsCount["QR"] || 0) / (records.length || 1)) * 100)}% of total
            </span>
          }
        />
        <StatCard
          label="Manual Staff Entries"
          value={methodsCount["MANUAL"] || 0}
          icon={<Users className="h-4 w-4 text-amber-500" />}
          sub={<span className="text-[11px] text-muted-foreground">Admin-logged presence</span>}
        />
      </div>

      {/* Top regulars & recent feed */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Top regulars */}
        <Card className="p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Most Frequent Regulars
          </h3>
          {topPlayers.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No records</div>
          ) : (
            <div className="space-y-2.5">
              {topPlayers.map((p, i) => (
                <div key={p.name} className="flex items-center justify-between text-xs py-1 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-muted-foreground font-semibold w-4">{i + 1}.</span>
                    <span className="font-medium text-foreground">{p.name}</span>
                  </div>
                  <Badge tone="primary" className="font-mono tabular-nums">
                    {p.count} sessions
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Live feed */}
        <div className="md:col-span-2 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Latest Check-in Activity
          </h3>
          <Table head={["Date", "Member", "Status", "Method", "Time"]}>
            {records.slice(0, 10).map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                <Td className="font-mono text-xs text-muted-foreground">{r.day}</Td>
                <Td>
                  <div className="text-xs font-medium text-foreground">{r.userName}</div>
                  <div className="text-[10px] text-muted-foreground">{r.userEmail || "—"}</div>
                </Td>
                <Td>
                  <Badge tone={r.status === "PRESENT" ? "success" : "muted"} className="text-[10px]">
                    {r.status}
                  </Badge>
                </Td>
                <Td>
                  <Badge tone="muted" className="text-[10px] font-mono">
                    {r.method || "MANUAL"}
                  </Badge>
                </Td>
                <Td className="text-xs text-muted-foreground font-mono">
                  {new Date(r.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </div>
  );
}

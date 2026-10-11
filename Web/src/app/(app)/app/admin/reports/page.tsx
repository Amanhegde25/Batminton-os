"use client";

import { useState } from "react";
import { useSession } from "@/components/session";
import { api } from "@/lib/client";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Spinner,
  useToast
} from "@/components/ui";
import {
  BarChart3,
  CalendarCheck,
  Wallet,
  Users,
  Check
} from "@/components/icons";

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csvContent =
    "data:text/csv;charset=utf-8," +
    rows
      .map((row) =>
        row
          .map((cell) => {
            const str = String(cell ?? "").replace(/"/g, '""');
            return `"${str}"`;
          })
          .join(",")
      )
      .join("\n");

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export default function ClubAdminReportsPage() {
  const { activeClubId, activeMembership } = useSession();
  const [downloading, setDownloading] = useState<string | null>(null);
  const { toast, node } = useToast();

  // Filters
  const [attendanceStart, setAttendanceStart] = useState("");
  const [attendanceEnd, setAttendanceEnd] = useState("");
  const [financeStart, setFinanceStart] = useState("");
  const [financeEnd, setFinanceEnd] = useState("");

  async function exportAttendance() {
    if (!activeClubId) return;
    setDownloading("attendance");
    try {
      const params = new URLSearchParams();
      if (attendanceStart) params.set("startDate", attendanceStart);
      if (attendanceEnd) params.set("endDate", attendanceEnd);

      const records = await api<any[]>(`/clubs/${activeClubId}/admin/reports/attendance?${params.toString()}`);
      if (records.length === 0) {
        toast("No attendance records found for this date range", "error");
        return;
      }

      const rows: (string | number)[][] = [
        ["Date", "Member Name", "Email", "Status", "Check-in Method", "Timestamp"]
      ];

      for (const r of records) {
        rows.push([
          r.day,
          r.userName,
          r.userEmail || "",
          r.status,
          r.method || "MANUAL",
          new Date(r.createdAt).toISOString()
        ]);
      }

      const slug = activeMembership?.club.slug || "club";
      downloadCsv(`${slug}_attendance_report_${new Date().toISOString().slice(0, 10)}.csv`, rows);
      toast("Attendance report downloaded!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setDownloading(null);
    }
  }

  async function exportFinances() {
    if (!activeClubId) return;
    setDownloading("finance");
    try {
      const params = new URLSearchParams();
      if (financeStart) params.set("startDate", financeStart);
      if (financeEnd) params.set("endDate", financeEnd);

      const txns = await api<any[]>(`/clubs/${activeClubId}/admin/reports/financial?${params.toString()}`);
      if (txns.length === 0) {
        toast("No financial records found for this range", "error");
        return;
      }

      const rows: (string | number)[][] = [
        ["Transaction ID", "Member Name", "Email", "Amount (INR)", "Type", "Description", "Balance After", "Timestamp"]
      ];

      for (const t of txns) {
        rows.push([
          t.id,
          t.userName,
          t.userEmail || "",
          t.amount,
          t.type,
          t.description || "",
          t.balanceAfter ?? "",
          new Date(t.createdAt).toISOString()
        ]);
      }

      const slug = activeMembership?.club.slug || "club";
      downloadCsv(`${slug}_financial_ledger_${new Date().toISOString().slice(0, 10)}.csv`, rows);
      toast("Financial report downloaded!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setDownloading(null);
    }
  }

  async function exportMembers() {
    if (!activeClubId) return;
    setDownloading("members");
    try {
      const members = await api<any[]>(`/clubs/${activeClubId}/members`);
      if (members.length === 0) {
        toast("No members found", "error");
        return;
      }

      const rows: (string | number)[][] = [
        ["User ID", "Name", "Email", "Mobile", "Club Role", "Status", "Joined Date"]
      ];

      for (const m of members) {
        rows.push([
          m.userId,
          m.name,
          m.email || "",
          m.mobile || "",
          m.role,
          m.status,
          m.joinedAt ? new Date(m.joinedAt).toISOString() : ""
        ]);
      }

      const slug = activeMembership?.club.slug || "club";
      downloadCsv(`${slug}_member_roster_${new Date().toISOString().slice(0, 10)}.csv`, rows);
      toast("Member roster downloaded!", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Export failed", "error");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {node}

      <div>
        <h2 className="text-lg font-semibold tracking-tight">Export Club Datasets (CSV)</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Generate clean, spreadsheet-ready CSV downloads for offline record keeping, accounting audits, and attendance verification.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Export */}
        <Card className="p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarCheck className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Attendance Log</h3>
                <p className="text-xs text-muted-foreground">Session check-in timestamps and methods</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Field label="From Date">
                <Input
                  type="date"
                  value={attendanceStart}
                  onChange={(e) => setAttendanceStart(e.target.value)}
                  className="h-8 text-xs"
                />
              </Field>
              <Field label="To Date">
                <Input
                  type="date"
                  value={attendanceEnd}
                  onChange={(e) => setAttendanceEnd(e.target.value)}
                  className="h-8 text-xs"
                />
              </Field>
            </div>
          </div>

          <Button
            onClick={() => void exportAttendance()}
            disabled={downloading === "attendance"}
            className="w-full gap-2 text-xs"
          >
            {downloading === "attendance" ? <Spinner className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
            Download Attendance CSV
          </Button>
        </Card>

        {/* Financial Export */}
        <Card className="p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                <Wallet className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Financial Ledger</h3>
                <p className="text-xs text-muted-foreground">Wallet recharges, court deductions, dues</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Field label="From Date">
                <Input
                  type="date"
                  value={financeStart}
                  onChange={(e) => setFinanceStart(e.target.value)}
                  className="h-8 text-xs"
                />
              </Field>
              <Field label="To Date">
                <Input
                  type="date"
                  value={financeEnd}
                  onChange={(e) => setFinanceEnd(e.target.value)}
                  className="h-8 text-xs"
                />
              </Field>
            </div>
          </div>

          <Button
            onClick={() => void exportFinances()}
            disabled={downloading === "finance"}
            className="w-full gap-2 text-xs"
          >
            {downloading === "finance" ? <Spinner className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
            Download Ledger CSV
          </Button>
        </Card>

        {/* Member Roster Export */}
        <Card className="p-5 flex flex-col justify-between space-y-4 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                <Users className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Complete Member Roster</h3>
                <p className="text-xs text-muted-foreground">Full active directory with contact info and roles</p>
              </div>
            </div>
            <Button
              onClick={() => void exportMembers()}
              disabled={downloading === "members"}
              className="gap-2 text-xs shrink-0"
            >
              {downloading === "members" ? <Spinner className="h-3.5 w-3.5" /> : <BarChart3 className="h-3.5 w-3.5" />}
              Export Roster CSV
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

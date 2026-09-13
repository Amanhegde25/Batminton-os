import Link from "next/link";
import Image from "next/image";
import {
  ShuttlecockIcon,
  CalendarCheck,
  Wallet,
  Calendar,
  Sparkles,
  TrendingUp,
  Trophy,
  Brain,
  Video,
  Shield,
  ArrowRight,
  CheckCircle2,
  Activity
} from "@/components/icons";

const coreFeatures = [
  {
    icon: CalendarCheck,
    title: "Member Attendance & QR Sweeps",
    body: "Automated GPS radius validation, QR code check-ins, late arrival thresholds, monthly attendance matrices, and automated absence sweep jobs.",
    badge: "Operations"
  },
  {
    icon: Calendar,
    title: "Live Court Grid & Slot Bookings",
    body: "Real-time court occupancy tracker with countdown timers, peak-hour split tariffs, automated cancellation windows, and instant member wallet settlement.",
    badge: "Courts"
  },
  {
    icon: Sparkles,
    title: "AI Doubles Matchmaking",
    body: "Bipartite fairness optimization that balances doubles pairings based on active Elo ratings, partnership history, fatigue, and skill compatibility scores.",
    badge: "Intelligence"
  },
  {
    icon: TrendingUp,
    title: "Doubles-Aware Elo Ratings",
    body: "Mathematical rating engine with set margin multipliers, handicap compensations, and real-time leaderboards spanning 8 competitive club categories.",
    badge: "Rankings"
  },
  {
    icon: Wallet,
    title: "Append-Only Wallets & Fines",
    body: "Zero-loss double-entry financial ledger per member. Automated penalties for unexcused no-shows, walkovers, and tournament entry deductions.",
    badge: "Finances"
  },
  {
    icon: Trophy,
    title: "Single & Double Knockout Tournaments",
    body: "Full tournament lifecycle management: seeded knockout brackets up to 32 players, bye distribution, court allocations, and live score updates.",
    badge: "Events"
  },
  {
    icon: Brain,
    title: "AI Coaching & Tactical Insights",
    body: "Data-driven player diagnostics analyzing third-set stamina drops, unforced error patterns, and optimal partnership combinations from match records.",
    badge: "Coaching"
  },
  {
    icon: Video,
    title: "Video Rally Pose Analysis",
    body: "Upload rally footage for deterministic player movement analysis, court coverage heatmaps, smash angles, and footwork split-step recovery time.",
    badge: "Vision AI"
  }
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground selection:bg-primary/20 selection:text-primary">
      {/* Top subtle ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[840px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-md">
        <nav className="container-page flex h-16 items-center justify-between">
          <div className="flex items-center gap-2.5 font-bold tracking-tight">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-muted/60 text-primary">
              <ShuttlecockIcon className="h-5 w-5" />
            </div>
            <span className="text-base font-semibold text-foreground">Badminton Club OS</span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-xl px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="btn-tactile rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-105"
            >
              Get started
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section — Asymmetric Split per taste-design & image-to-code */}
      <section className="container-page relative pt-12 pb-20 sm:pt-20 sm:pb-28">
        <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
          {/* Left Column: Asymmetric Typography & Actions */}
          <div className="flex flex-col items-start lg:col-span-7">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Activity className="h-3.5 w-3.5" />
              <span>Next-Gen Athletic Club Management</span>
            </div>

            <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-foreground sm:text-6xl sm:leading-[1.1]">
              The operating system for modern badminton clubs
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              Badminton Club OS centralizes member attendance, live court schedules, AI doubles matchmaking,
              doubles-aware Elo ratings, wallet penalties, and video rally analysis into one high-performance platform.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Link
                href="/register"
                className="btn-tactile inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-105"
              >
                Create your club
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/login"
                className="btn-tactile inline-flex h-12 items-center justify-center rounded-xl border border-border/80 bg-card/60 px-6 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60"
              >
                Explore demo club
              </Link>
            </div>

            {/* Quick Demo Credentials Pill */}
            <div className="mt-6 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/30 px-3.5 py-2 text-xs text-muted-foreground">
              <Shield className="h-4 w-4 text-primary shrink-0" />
              <span>
                Demo login ready: <strong className="text-foreground">admin@bcos.app</strong> or{" "}
                <strong className="text-foreground">player100@demo.club</strong> (Password:{" "}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">Password123!</code>)
              </span>
            </div>
          </div>

          {/* Right Column: Framed Athletic Action Shot with Floating Tactical Widget */}
          <div className="relative lg:col-span-5">
            {/* Visual Frame */}
            <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-muted/40 shadow-2xl">
              <Image
                src="/hero-badminton.jpg"
                alt="Badminton court action and tactical analysis"
                width={720}
                height={540}
                priority
                className="h-[380px] w-full object-cover object-center transition-transform duration-700 hover:scale-[1.02] sm:h-[440px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

              {/* Floating Tactical Court Card */}
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-border/80 bg-card/95 p-4 shadow-xl backdrop-blur-md">
                <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Live Court Status
                    </span>
                  </div>
                  <span className="rounded-md border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-mono font-medium text-primary">
                    4 Courts Active
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-foreground">Court 1</span>
                      <span className="text-emerald-500 font-medium">Occupied</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">Arjun / Rahul vs David / Sam</p>
                    <p className="mt-1 text-[10px] font-mono text-muted-foreground">18:45 remaining</p>
                  </div>

                  <div className="rounded-xl border border-border/60 bg-muted/40 p-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-foreground">Court 2</span>
                      <span className="text-emerald-500 font-medium">Occupied</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">Priya / Sarah vs Emily / Lin</p>
                    <p className="mt-1 text-[10px] font-mono text-muted-foreground">22:10 remaining</p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                  <span>Match rating impact:</span>
                  <span className="font-mono font-semibold text-primary">+18 Elo</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Section — Asymmetric Bento Layout (Anti-3-card rule) */}
      <section className="border-t border-border/80 bg-muted/20 py-20 sm:py-28">
        <div className="container-page">
          <div className="max-w-2xl">
            <span className="text-xs font-semibold uppercase tracking-wider text-primary">Club Engine</span>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Architected for elite club operations
            </h2>
            <p className="mt-3 text-base text-muted-foreground">
              Every feature is built directly from high-stakes badminton club management requirements.
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {coreFeatures.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group relative flex flex-col justify-between rounded-2xl border border-border/80 bg-card/90 p-6 shadow-sm transition-all duration-200 hover:border-primary/40 hover:bg-card hover:shadow-md"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border/70 bg-muted/60 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {f.badge}
                      </span>
                    </div>
                    <h3 className="mt-4 text-base font-semibold text-foreground">{f.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{f.body}</p>
                  </div>

                  <div className="mt-6 flex items-center gap-1.5 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    <span>Explore module</span>
                    <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Free Tier Callout */}
      <section className="border-t border-border/80 bg-background py-16">
        <div className="container-page flex flex-col items-center text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Community Supported Architecture</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            100% Free & Open For Clubs
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Attendance matrices, wallet ledgers, doubles matchmaking, court scheduling, and Elo ratings are included
            without licensing fees or artificial tier barriers.
          </p>
          <div className="mt-8 flex gap-3">
            <Link
              href="/register"
              className="btn-tactile rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-sm hover:brightness-105"
            >
              Get started now
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/80 bg-card/60 py-8">
        <div className="container-page flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <ShuttlecockIcon className="h-4 w-4 text-primary" />
            <span className="font-semibold text-foreground">Badminton Club OS</span>
            <span>· Operating system for badminton clubs</span>
          </div>
          <span>Built with Next.js 15 & MongoDB</span>
        </div>
      </footer>
    </main>
  );
}

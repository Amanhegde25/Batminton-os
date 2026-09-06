import Link from "next/link";

const features = [
  { icon: "🏸", title: "Members & Attendance", body: "QR check-ins, GPS validation, late rules, monthly matrices and automated absence sweeps." },
  { icon: "💰", title: "Wallets & Penalties", body: "Append-only ledgers per member. Automatic lassi fines for absences, losses and walkovers." },
  { icon: "🏟️", title: "Courts & Bookings", body: "Live court occupancy, hourly booking with wallet payments, cancellation windows." },
  { icon: "🤖", title: "AI Matchmaking", body: "Balanced doubles generated from ratings, partner fairness and fatigue — with explanations." },
  { icon: "📈", title: "Elo Ratings & Leaderboards", body: "Doubles-aware Elo with margin multipliers across 8 leaderboard categories and periods." },
  { icon: "🏆", title: "Tournaments", body: "Knockout brackets up to 32 players with standard seeding, byes and entry fees." },
  { icon: "🧠", title: "AI Coaching", body: "Weekly insights on form, deciding sets and partnerships built from your real match data." },
  { icon: "🎥", title: "Video Analysis", body: "Upload rally footage for deterministic pose analysis: footwork, shot accuracy, court coverage." }
];

export default function LandingPage() {
  return (
    <main className="relative overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      <nav className="container-page flex h-16 items-center justify-between">
        <div className="flex items-center gap-2 font-bold">
          <span className="text-xl">🏸</span> Badminton Club OS
        </div>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-muted">
            Sign in
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:opacity-90"
          >
            Get started
          </Link>
        </div>
      </nav>

      <section className="container-page flex flex-col items-center py-20 text-center sm:py-28">
        <span className="mb-5 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm">
          The complete operating system for badminton clubs
        </span>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Run your club like a <span className="text-primary">pro academy</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
          Attendance, wallets, penalties, courts, AI matchmaking, Elo leaderboards, tournaments and coaching insights —
          one platform for players, coaches and managers.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="h-11 rounded-xl bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow hover:opacity-90"
          >
            Create your club
          </Link>
          <Link href="/login" className="h-11 rounded-xl border px-6 py-3 text-base font-medium hover:bg-muted">
            Explore a demo club
          </Link>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Demo logins after seeding: player@demo.club / admin@demo.club — password <code>Password123!</code>
        </p>
      </section>

      <section className="container-page grid gap-4 pb-24 sm:grid-cols-2 lg:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="rounded-2xl border bg-card p-5 shadow-sm">
            <div className="text-2xl">{f.icon}</div>
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="border-t bg-card/50">
        <div className="container-page grid gap-8 py-16 sm:grid-cols-3">
          <div>
            <p className="text-3xl font-bold text-primary">FREE</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Members, attendance, matches, leaderboard and wallets — forever free for small clubs.
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-secondary">PRO</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Adds penalties, courts & bookings, matchmaking, advanced analytics and tournaments.
            </p>
          </div>
          <div>
            <p className="text-3xl font-bold text-accent">PREMIUM</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything plus AI coaching insights and video analysis for serious academies.
            </p>
          </div>
        </div>
      </section>

      <footer className="container-page flex flex-col items-center justify-between gap-2 border-t py-8 text-sm text-muted-foreground sm:flex-row">
        <span>© {new Date().getFullYear()} Badminton Club OS</span>
        <span>Built with Next.js, Prisma & SQLite</span>
      </footer>
    </main>
  );
}

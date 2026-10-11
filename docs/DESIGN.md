# Design System: Badminton Club OS

## 1. Visual Theme & Atmosphere

An athletic, high-density operating system interface combining Swiss structural discipline with the refined precision of an elite sports club. The atmosphere is calm, tactile, and cockpit-dense — deep zinc canvases, dark slate elevated surfaces, and razor-sharp 1px structural dividers with a singular high-contrast court-emerald accent. Every metric and live status indicator communicates immediacy and operational clarity without visual noise or gimmickry.

- **Density:** Cockpit Dense (8/10) — High information density with monospace data alignment, compact badges, and zero wasted vertical space.
- **Variance:** Offset Asymmetric (7/10) — Split-screen hero architecture, staggered live court layouts, and asymmetric bento grids instead of repetitive cards.
- **Motion:** Tactile Spring Physics (6/10) — Responsive press states (`-1px` active translation), subtle status pulse loops on live courts, and smooth staggered reveals.

---

## 2. Color Palette & Roles

Both the Web platform (`globals.css`) and Mobile app (`colors.ts`) adhere strictly to this tokenized palette:

- **Canvas Base (`#09090b` / `zinc-950`)** — Primary background surface. Pure black (`#000000`) is strictly forbidden.
- **Surface Dark Slate (`#121215` / `zinc-900`)** — Card backgrounds, table rows, and nested containers.
- **Surface Elevated (`#18181b` / `zinc-900/80`)** — Modals, popovers, dropdown menus, and hover highlights.
- **Text High-Contrast (`#f4f4f5` / `zinc-100`)** — Primary headlines, player names, and prominent score metrics.
- **Text Muted (`#a1a1aa` / `zinc-400`)** — Secondary labels, metadata, captions, and navigation text.
- **Text Subtle (`#71717a` / `zinc-500`)** — Timestamps, minor table headers, and inactive borders.
- **Whisper Border (`#27272a` / `rgba(255, 255, 255, 0.08)`)** — 1px crisp structural grid lines and card boundaries.
- **Court Emerald (`#10b981` / `hsl(158, 64%, 48%)`)** — Single curated accent for active tabs, live court status, check-in actions, and positive Elo rating deltas.
- **Court Emerald Light (`rgba(16, 185, 129, 0.12)`)** — Subtle background glow and pill badges.
- **Alert Crimson (`#ef4444`)** — Penalties, walkovers, outstanding dues, and negative Elo deltas.
- **Warning Amber (`#f59e0b` / `rgba(245, 158, 11, 0.15)`)** — Pending member approvals, maintenance courts, and late check-ins.

---

## 3. Typography Rules

- **Display & Headlines:** `Geist` (Web) / Semi-bold Grotesk (Mobile) — Track-tight (`letter-spacing: -0.025em`), controlled scale, weight-driven hierarchy.
- **Body:** `Geist` (Web) / Regular Grotesk (Mobile) — Relaxed line height (`leading-relaxed`), neutral secondary color, maximum 65ch width for narrative copy.
- **Monospace Numbers (`tabular-nums`):** `Geist Mono` / `JetBrains Mono` — Mandatory for Elo ratings, live match scores (`21-19`), countdown clocks (`18:45`), currency values (`₹1,450`), and timestamps.
- **Banned:** `Inter` font is strictly BANNED in premium contexts. Generic serif fonts (`Times New Roman`, `Georgia`) are banned in dashboard software.

---

## 4. Component Stylings

### Buttons & Actions
- Tactile feedback on press (`active:translate-y-[1px]` on Web, `activeOpacity: 0.75` on Mobile).
- Emerald fill for primary actions with dark contrast text (`#042f2e`).
- Crisp 1px border (`#27272a`) for secondary / ghost buttons. No neon halos.

### Cards & Surfaces
- Generously rounded corners (`rounded-2xl` on Web, `20px` radius on Mobile).
- Hairline 1px border in `#27272a`.
- Diffused whisper shadow tinted to background; zero blur bleeding.

### Live Match Scoreboard & Game Points Counter
- **Digital Court Scoreboard:** High-contrast scoreboard card with bold tabular point totals (48px+ on Web, 36px+ on Mobile).
- **Interactive Point Steppers:** Large tactile `+1` increment and `-1` decrement stepper buttons per team with rapid-press response.
- **Server Indicator:** Visual serve badge indicating current serving player and active service half-court (Even score = Right court, Odd score = Left court).
- **Set Pills:** Set tabs (Set 1, Set 2, Set 3) displaying finalized and ongoing set scores.
- **Game / Match Point Alert:** Subtle emerald or amber banner signaling `Game Point` or `Match Point` when a team reaches 20+ with advantage.

### PlayGroups & Community UI
- **Group Cards:** Header with group logo/avatar, skill level pill (`BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `ALL`), member count, and city tag.
- **Community Post Feed:** Compact message bubbles with player avatar, name, relative timestamp (`5m ago`), and clean typography.
- **Play Session Cards:** Date/time badge, court venue name, organizer chip, and RSVP button row:
  - `YES` (emerald active pill)
  - `MAYBE` (amber pill)
  - `NO` (subtle zinc outline)

### Nearby Clubs Explorer
- **Distance Badge:** Precision distance chip (`1.2 km away`) computed from device geolocation coordinates.
- **Filter Bar:** Instant search input, city selector chips, and quick "Join Club" action.

### Live Court Badges
- Minimalist status pills:
  - `Occupied` — Emerald dot with translucent green badge (`rgba(16, 185, 129, 0.12)`).
  - `Available` — Neutral border with muted text.
  - `Maintenance` — Subtle amber pill.

---

## 5. Layout Principles

- **Landing Page Hero:** Asymmetric split-screen layout. Left: track-tight typography and dual tactile CTAs. Right: framed high-resolution court action visual with an overlapping live tactical analytics card.
- **Feature Sections:** 2-column zig-zag and asymmetric bento grids. The generic "3 equal cards horizontally" row is strictly BANNED.
- **Dashboard Cockpit:** 2x2 live court occupancy grid with countdown timers and active player pills, quick member attendance queue, and recent match ticker.
- **Mobile First View:** Clean above-the-fold layout featuring club switcher, player rating/wallet card, quick check-in NFC/QR action, and live court booking timeline.
- **Containment:** Max-width 1280px (`max-w-7xl`) centered with generous gutter padding (`px-4 sm:px-6 lg:px-8`). Full-height viewports use `min-h-[100dvh]`.

---

## 6. Motion & Interaction

- **Spring Physics:** Weighty and tactile damping (`stiffness: 100, damping: 20`).
- **Live Status Loops:** Subtle infinite pulse on live occupied court indicators and active check-in waves.
- **Hardware Acceleration:** Animations strictly leverage `transform` and `opacity`.

---

## 7. Anti-Patterns (Strictly Banned)

- No emojis anywhere in the interface (use Lucide icons exclusively).
- No `Inter` font.
- No pure black (`#000000`).
- No neon/outer glow drop-shadows.
- No 3-column equal card layouts.
- No cards-inside-cards-inside-cards nesting.
- No fake round statistics (`99.99%`, `100%`) or invented AI metrics.
- No AI copywriting clichés ("Elevate your experience", "Seamlessly unleash", "Next-Gen badminton").
- No filler UI text ("Scroll to explore", bouncing arrows).

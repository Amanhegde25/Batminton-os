# Design System: Badminton Club OS

## 1. Visual Theme & Atmosphere
An athletic, high-density operating system interface combining Swiss structural discipline with the refined precision of an elite sports club. The atmosphere is calm, tactile, and cockpit-dense — deep zinc canvases, dark slate elevated surfaces, and razor-sharp 1px structural dividers with a singular high-contrast court-emerald accent. Every metric and live status indicator communicates immediacy and operational clarity without visual noise or gimmickry.

- **Density:** Cockpit Dense (8/10) — High information density with monospace data alignment, compact badges, and zero wasted vertical space.
- **Variance:** Offset Asymmetric (7/10) — Split-screen hero architecture, staggered live court layouts, and asymmetric bento grids instead of repetitive cards.
- **Motion:** Tactile Spring Physics (6/10) — Responsive press states (`-1px` active translation), subtle status pulse loops on live courts, and smooth staggered reveals.

## 2. Color Palette & Roles
- **Canvas Base (`#09090b` / `zinc-950`)** — Primary background surface. Pure black (`#000000`) is strictly forbidden.
- **Surface Dark Slate (`#121215` / `zinc-900`)** — Card backgrounds, table rows, and nested containers.
- **Surface Elevated (`#18181b` / `zinc-900/80`)** — Modals, popovers, dropdown menus, and hover highlights.
- **Text High-Contrast (`#f4f4f5` / `zinc-100`)** — Primary headlines, player names, and prominent score metrics.
- **Text Muted (`#a1a1aa` / `zinc-400`)** — Secondary labels, metadata, captions, and navigation text.
- **Text Subtle (`#71717a` / `zinc-500`)** — Timestamps, minor table headers, and borders.
- **Whisper Border (`#27272a` / `rgba(255, 255, 255, 0.08)`)** — 1px crisp structural grid lines and card boundaries.
- **Court Emerald (`#10b981` / `hsl(158, 64%, 48%)`)** — Single curated accent for active tabs, live court status, check-in actions, and positive Elo rating deltas.
- **Court Emerald Light (`rgba(16, 185, 129, 0.12)`)** — Subtle background glow and pill badges.
- **Alert Crimson (`#ef4444`)** — Penalties, walkovers, outstanding dues, and negative Elo deltas.

## 3. Typography Rules
- **Display & Headlines:** `Geist` (Web) / Semi-bold Grotesk (Mobile) — Track-tight (`letter-spacing: -0.025em`), controlled scale, weight-driven hierarchy.
- **Body:** `Geist` (Web) / Regular Grotesk (Mobile) — Relaxed line height (`leading-relaxed`), neutral secondary color, maximum 65ch width for narrative copy.
- **Monospace Numbers:** `Geist Mono` / `JetBrains Mono` / Tabular Numerals — Mandatory for Elo ratings, scorelines (`21-19`), countdown clocks (`18:45`), currency values (`₹1,450`), and timestamps.
- **Banned:** `Inter` font is strictly BANNED in premium contexts. Generic serif fonts (`Times New Roman`, `Georgia`) are banned in dashboard software.

## 4. Component Stylings
- **Buttons:** Tactile feedback on press (`active:translate-y-[1px]` or `activeOpacity: 0.75`). Emerald fill for primary actions with dark contrast text (`#042f2e`). Crisp 1px border for secondary/ghost buttons. No neon halos.
- **Cards:** Generously rounded corners (`rounded-2xl` on Web, `20px` radius on Mobile). Diffused whisper shadow tinted to the background. 1px hairline border in `#27272a`.
- **Inputs & Controls:** Label positioned firmly above inputs; monospace placeholder text; crisp emerald focus rings.
- **Live Court Badges:** Minimalist status badges: `Occupied` (emerald dot + translucent green badge), `Available` (neutral border + muted text), `Maintenance` (subtle amber pill).
- **Match Score Cards:** High-contrast team score breakdown with tabular numbers and color-coded Elo rating deltas (+18 Elo in emerald, -14 Elo in crimson).
- **Loading & Empty States:** Skeletal shimmer loaders matching exact dimensions — no generic circular spinners on full screens.

## 5. Layout Principles
- **Landing Page Hero:** Asymmetric split-screen layout. Left: track-tight typography and dual tactile CTAs. Right: framed high-resolution court action visual with an overlapping live tactical analytics card.
- **Feature Sections:** 2-column zig-zag and asymmetric bento grids. The generic "3 equal cards horizontally" row is strictly BANNED.
- **Dashboard Cockpit:** 2x2 live court occupancy grid with countdown timers and active player pills, quick member attendance queue, and recent match ticker.
- **Mobile First View:** Clean above-the-fold layout featuring club switcher, player rating/wallet card, quick check-in NFC action, and live court booking timeline.
- **Containment:** Max-width 1280px (`max-w-7xl`) centered with generous gutter padding (`px-4 sm:px-6 lg:px-8`). Full-height viewports use `min-h-[100dvh]`.

## 6. Motion & Interaction
- **Spring Physics:** Weighty and tactile damping (`stiffness: 100, damping: 20`).
- **Live Status Loops:** Subtle infinite pulse on live occupied court indicators and active NFC check-in waves.
- **Hardware Acceleration:** Animations strictly leverage `transform` and `opacity`.

## 7. Anti-Patterns (Banned)
- No emojis anywhere in the interface.
- No `Inter` font.
- No pure black (`#000000`).
- No neon/outer glow drop-shadows.
- No 3-column equal card layouts.
- No cards-inside-cards-inside-cards nesting.
- No fake round statistics (`99.99%`, `100%`) or invented AI metrics.
- No AI copywriting clichés ("Elevate your experience", "Seamlessly unleash", "Next-Gen badminton").
- No filler UI text ("Scroll to explore", bouncing arrows).

# CLAUDE.md — SDL Global Logistics Website

> This file is read automatically by Claude Code at the start of every session.
> Keep it short, current and true. Detailed specs live in `/docs`.

## 0. Your role: read this first

**The system is already built, and it works.** It is a complete, running logistics platform with a public
website, a live shipment-tracking engine, an Express/SQLite API, an admin operations console, PDF document
generation, quotes and bookings. It runs on localhost today and has been deployed before.

**You are acting as a senior professional full-stack developer** who has been hired to take over this
existing codebase and deliver a rebrand and enhancement for a client. You are **not** building a new app, and
you must not scaffold, rewrite or restructure it from scratch.

Work the way a professional developer works on a client's production system:
- **Understand before you change.** Read the relevant files and trace how data flows before editing.
- **Modify in place.** Reuse the existing components, services, routes, styles and data model. Extend them; don't
  replace them. A rewrite needs a written reason in the tracker's Decisions log and the owner's approval.
- **Protect what works.** Tracking, admin login, shipment creation, documents, quotes and the database must work
  after every change. If a change risks them, stop and flag it.
- **Small, reviewable commits** with clear messages (`rebrand: …`, `content: …`, `feat(3d): …`, `fix: …`).
- **Explain your changes** briefly: what changed, which files, how you verified it, and any risks.
- **Ask when a business fact is missing.** Don't guess or invent it.

## 1. What this project is

The existing system was built as "Duolingo Express", a U.S.-only courier platform. The job is to convert
this **already working system** into the website and operations platform for **SDL Global Logistics Ltd**, a
**worldwide** logistics company, without breaking any of its existing functionality.

The end result must:
1. Carry **zero** trace of the old brand (text, images, metadata, IDs, file names, comments, DB names).
2. Use SDL's own images, logo, colours and **original copy** (see `docs/CONTENT.md`).
3. Operate **worldwide**, not U.S.-only (hubs, maps, addresses, time zones, units).
4. Add tasteful **3D and motion** that feel natural and smooth — never heavy (see `docs/MOTION_3D_SPEC.md`).
5. Deploy from GitHub to **Hostinger** (Node.js app) on the SDL domain (see `docs/DEPLOYMENT.md`).

## 2. Company facts (single source of truth)

| Field | Value |
|---|---|
| Registered name | SDL Global Logistics Ltd |
| Short name (UI) | SDL Global Logistics / SDL |
| Primary email | info@sdlgloballogistics.com |
| Domain | sdlgloballogistics.com |
| Coverage | Worldwide |
| Admin console URL | https://private.sdlgloballogistics.com (same Node app, separate subdomain) |
| Tracking ID prefix | `DLS` — full ID is **exactly 8 characters**: `DLS` + 5 characters (e.g. `DLS7K2M9`) |
| Phone / WhatsApp / HQ address | **TBD — ask the owner. Never invent real-looking numbers or addresses.** |

If a fact is not in this table or in `docs/BRAND_GUIDE.md`, **ask** rather than invent it.

## 3. Tech stack (already in place; don't swap frameworks)

- **Frontend:** React 18 + TypeScript + Vite 6. Single-page app with **hash routing** handled in `src/App.tsx`
  (`KNOWN_PAGES`). No React Router.
- **Styling:** Plain CSS per component/page + design tokens in `src/styles/tokens.css` and `src/styles/global.css`.
- **Maps:** Leaflet / react-leaflet. Geocoding via OpenStreetMap Nominatim, road routing via OSRM (public endpoints).
- **Icons:** lucide-react. **Barcodes:** jsbarcode. **PDFs:** jspdf + html2canvas.
- **Backend:** Express 5 (`server/`), SQLite via Node's built-in `node:sqlite` (**requires Node ≥ 22.5**),
  express-session auth, helmet, rate limiting.
- **Admin:** served ONLY on **`private.sdlgloballogistics.com`** in production (`isAdminHost()` in `App.tsx`, which currently checks `dr.` and must be changed to read `ADMIN_SUBDOMAIN = 'private'` from `src/config/brand.ts`). On the public domain, admin must never open. `#/admin` works on localhost only.
- **Static assets folder is `Public/` (capital P)** — `vite.config.ts` sets `publicDir: 'Public'`. Do not rename it;
  Hostinger's Linux build is case-sensitive.

## 4. Commands

```bash
npm install            # also runs `npm run build` via postinstall
npm run dev            # Express API (:5000) + Vite (:3000) together
npm run build          # tsc + vite build + server tsc -> dist/ and dist-server/
npm start              # production: node dist-server/server/index.js
```

Local admin: `http://localhost:3000/#/admin`. Env vars: see `.env.example` and `docs/DEPLOYMENT.md`.

## 5. Key folders

```
src/pages/        Public pages (Home, Track, TrackResult, Services, Quote, Ship, About, Contact, Help, Legal, Locations, PublicQuoteResult)
src/components/   Header, Footer, maps (HomeNetworkMap, FacilityNetworkMap, JourneyMap), ShipmentTimeline, Barcode, etc.
src/admin/        Admin console (dashboard, create shipment, tracking events, documents, quotes, settings)
src/services/     api.ts, geocodingService.ts, routingEngine.ts, planningEngine.ts, simulationEngine.ts
src/data/         Static site data (gateways, countries, help articles, legal docs, image map)
src/styles/       tokens.css (design tokens), global.css
server/           Express app, routes, db.ts (schema + default settings)
Public/           logo, favicon, images (served at /)
docs/             Project docs — read the relevant one before each phase
```

## 6. Rules for every task

1. **Read `docs/PROJECT_TRACKER.md` first.** Work on the next unchecked task in the current phase unless told otherwise.
2. **One task → one small, reviewable change.** Don't mix rebrand, copy and 3D work in one commit.
3. **Copy comes from `docs/CONTENT.md`.** Don't write marketing text on the fly. If copy is missing, add it to
   CONTENT.md first, then use it.
4. **Brand values come from `docs/BRAND_GUIDE.md`** (colours, fonts, naming, tracking-ID format).
5. **Use `docs/REBRAND_MAP.md`** as the checklist for old-brand removal. Tick items as you go.
6. **Never break existing behaviour:** tracking lookup, admin login, shipment creation, documents/PDFs, quote flow,
   database persistence. After any change, run `npm run build` — it must pass with **zero TypeScript errors**.
7. **No fabricated facts on the public site:** no invented statistics, testimonials, client logos, certifications,
   awards, phone numbers or addresses. Use the placeholders defined in CONTENT.md and flag them in the tracker.
8. **Performance budget is a requirement, not a wish** (see MOTION_3D_SPEC.md §2). Anything 3D is lazy-loaded
   and has a static fallback and a `prefers-reduced-motion` path.
9. **Don't touch** `.env`, the live database file, or `server/middleware/auth.ts` security logic unless the task
   is explicitly about them.
10. **No demo data.** The demo shipments, quotes and documents were removed for launch (tracker 6.7). Don't add sample shipments or fake records back to the code or the production database.
11. **Don't rename the database tables or columns.** Renaming the DB *file* is handled once, in Phase 1, with
    the migration note in DEPLOYMENT.md.
12. After finishing a task: tick it in `PROJECT_TRACKER.md`, add a one-line entry to its **Change log**, and
    list anything that needs the owner's input under **Blocked / Needs owner**.

## 7. Conventions

- CSS variables: rename prefix `--dxp-*` → `--sdl-*`; class prefix `dxp-` → `sdl-` (Phase 1, done in one sweep).
- Brand strings live in **one place**: create `src/config/brand.ts` (name, legal name, emails, domain, social links,
  tracking prefix) and import from it — no hard-coded brand strings in components.
- Tracking IDs are generated by **one shared function** (see BRAND_GUIDE.md §7) used by both server and client.
- Keep comments factual and brand-neutral (no "Duolingo" in comments either).
- Images: WebP/AVIF with JPG fallback, explicit `width`/`height`, `loading="lazy"` below the fold.
- Accessibility: every image has meaningful `alt`; contrast ≥ 4.5:1 for body text; all interactive 3D is decorative
  or has a keyboard/text equivalent.

## 8. Definition of done (per task)

- [ ] `npm run build` passes, no new console errors in the browser.
- [ ] Checked at 375px (mobile), 768px (tablet) and 1440px (desktop).
- [ ] No old-brand strings introduced (`grep -rniE "duolingo|dxp" src server index.html` shows nothing new).
- [ ] Tracker updated.
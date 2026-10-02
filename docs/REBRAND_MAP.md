# Rebrand Map: every old-brand trace and what replaces it

> **Context:** The SDL platform is **already built and working**: public website, tracking engine, Express/SQLite API,
> admin console, documents and quotes. Claude is acting as a **senior professional developer** who has taken over this
> existing codebase to rebrand and improve it. Nothing here is built from scratch; every task modifies the working system
> in place and must leave it working. See `CLAUDE.md §0`.

**Approach:** this is surgical editing of an existing, working codebase: targeted replacements, not rewrites. Build and re-test after each group of files.

Audit taken from the `duolingo-express` repo on 2026-09-26. When you work through an item, tick it and note the commit.

---

## 1. Strings → replacements

| Old | New | Notes |
|---|---|---|
| `Duolingo Express Logistics LLC` | `SDL Global Logistics Ltd` | Legal, footer, documents |
| `Duolingo Express` / `DUOLINGO EXPRESS` | `SDL Global Logistics` / `SDL` | Follow BRAND_GUIDE §1 |
| `Duolingo Logistics Intake` | `SDL Intake Desk` | CreateShipmentView.tsx:1151 default sender. *Done: `INTAKE_DESK` in brand.ts.* |
| `duolingoexpress.com` | `sdlgloballogistics.com` | |
| `dispatch@duolingoexpress.com` | `info@sdlgloballogistics.com` | server/db.ts default settings, Header, Contact, PublicQuoteResult, Admin Settings, AdminLayout |
| `duolingo_express.db` | `sdl_global.db` | server/db.ts, server/index.ts, .env.example (see DEPLOYMENT §4) |
| `duolingo-express` (package name) | `sdl-global-logistics` | package.json + regenerate package-lock.json |
| `Duolingo Express Waterproof (Legal) Pouch` | `SDL Tamper-Evident Document Pouch` | CreateShipmentView.tsx |
| `Duolingo Express Commercial Linehaul Highway Hauler` | `SDL Freight Vehicle` (image alt) | TrackResultPage.tsx:616 |
| `Duolingo Express Dedicated Linehaul Division` | `SDL Freight & Linehaul` | |
| `DUOLINGO EXPRESS CORPORATE DESIGN SYSTEM` (CSS header comments) | `SDL Global Logistics design system` | tokens.css, many CSS headers |
| `NATIONWIDE COURIER NETWORK` badge | `WORLDWIDE LOGISTICS NETWORK` | Home hero |
| `Super Admin Operations Desk` (shown publicly as a facility) | `SDL Operations Centre` | TrackResultPage.tsx:425. *Done: `OPERATIONS_CENTRE`.* |
| `Super Admin` (admin UI labels) | `Administrator` | Admin UI only; don't change stored audit values in existing data. *Done: `ADMIN_ROLE_LABEL` for new records; stored "Super Admin" values untouched and shown via `displayOperator()`.* |
| `1-800-555-0199` and other placeholder phones | value from `brand.ts` | FacilityNetworkMap.tsx (×5+), settings defaults |
| `One World Trade Center, Suite 8500, New York…` | value from `brand.ts` (TBD) | ContactPage.tsx:30 default |
| Social links `#facebook` … | real URLs from `brand.ts`, or hide the icon | Footer.tsx:113–117 |

## 2. Files containing "Duolingo" (54 files, ~130 hits)

**Highest counts first:**
- [x] src/admin/pages/DocumentCenterView.tsx (13)
- [x] src/App.tsx (13)
- [x] src/pages/PublicQuoteResultPage.tsx (9)
- [x] src/pages/HomePage.tsx (9)
- [x] src/admin/pages/CreateShipmentView.tsx (7)
- [x] src/pages/AboutPage.tsx (6)
- [x] src/pages/ShipPage.tsx (5)
- [x] src/pages/LegalPage.tsx (5)
- [x] src/components/Header.tsx (5)
- [x] src/admin/pages/SettingsView.tsx (5)
- [x] src/components/Footer.tsx (4)
- [x] server/index.ts (4)
- [x] server/db.ts (3) *Legacy-migration values stay: see §7 Allowed hits.*
- [x] src/pages/TrackPage.tsx, ServicesPage.tsx, QuotePage.tsx, ContactPage.tsx (2 each)
- [x] src/components/ShipmentDocuments.tsx, src/admin/AdminLayout.tsx (2 each)
- [x] server/seed.ts, server/routes/shipments.ts, index.html, .env.example (2 each)
- [x] 1 hit each: routingEngine.ts, planningEngine.ts, geocodingService.ts, TrackResultPage.tsx, main.tsx,
      mockShipments.ts, AdminDataContext.tsx, SupportModal.tsx, TrackingEventsView.tsx, EditShipmentModal.tsx,
      server/routes/documents.ts, package.json
- [x] 1 hit each in CSS header comments: TrackResultPage.css, ServicesPage.css, HomePage.css, AboutPage.css,
      USJourneyMap.css, TrackingLoadingScreen.css, TrackingEventsView.css, SettingsView.css, QuoteRequestsView.css,
      OperationsCenter.css, DocumentCenterView.css, CreateShipmentView.css, AllShipmentsView.css,
      ShipmentControlModal.css, RecentlyDeletedModal.css, EditShipmentModal.css, DeleteShipmentModal.css,
      AdminLogin.css, AdminLayout.css

## 3. Identifier prefixes (`DXP-`), 64 occurrences in 19 files

### 3.1 Tracking-ID generators: replace them all with the ONE shared `generateTrackingId()`
Shared module: `src/shared/trackingId.ts` (generate, normalise, validate, `parsePieceLabel`, `pieceLabel`); server allocator with DB uniqueness check + retry: `server/trackingIds.ts`. Tests: `npm test` (`scripts/trackingId.test.ts`).
- [x] `server/routes/shipments.ts:216`: `DXP-2026-${Math.random()…}` (the **server** generator is the authority; add a uniqueness check). *Always generates; a client-sent ID is ignored.*
- [x] `server/routes/quotes.ts:258`: quote → shipment conversion. *Always generates; a client-sent ID is ignored.*
- [x] `src/context/AdminDataContext.tsx:528` and `:752`. *No longer generate: they send a draft and adopt the ID the server returns.*
- [x] `src/admin/pages/CreateShipmentView.tsx:337`. *Shows `DLS·····` until the server assigns the ID.*
- [x] `src/pages/ShipPage.tsx:181`. *Uses the server-assigned ID.*
- [x] `src/services/planningEngine.ts:638`: return-to-origin → a new DLS ID linked to the original (BRAND_GUIDE §7). *`RTO-` gone; the server creates the return as its own linked shipment (`POST /api/shipments/:id/return`).*

### 3.2 Lookup and matching
- [x] `src/App.tsx:308`: sample/alias matching (`DXP-SAMPLE`, `7K2M9QRX`) → normalise input (BRAND_GUIDE §7) and match `DLS` IDs and child labels
- [x] `src/data/mockShipments.ts:304–409`: alias map keys
- [x] `server/routes/track.ts`: add the normaliser + regex validation before the DB lookup (return 400 for a malformed ID, 404 for not found)

### 3.3 Display, placeholders, help text
- [x] `src/pages/TrackPage.tsx` (2), `HomePage.tsx:1040/1044` (barcode demo), `HelpPage.tsx:52/59` (the "16-character" text → "8-character"), `ContactPage.tsx:80/268`, `SupportModal.tsx:71`, `TrackResultPage.tsx:141` (fallback), `TrackingEventsView.tsx:130–132` (default selection → first shipment). *TrackPage also separates "not a tracking ID" (format help) from "not found".*
- [x] Type comments: `src/types/shipment.ts:62`, `src/types/admin.ts:71/98`

### 3.4 Other references
Generator: `src/shared/references.ts` (`generateReference('seal'|'ticket'|'invoice')`, `referenceFor()` for stable per-record refs).
- [x] Seals `DXP-SEAL-892401` → `SDL-SL-######`: CreateShipmentView.tsx:173, 615, 2631, 2667. *Also the BOL seal generators (CreateShipmentView, DocumentCenterView) and the server default in `routes/documents.ts`.*
- [x] Tickets `DXP-SPT-` (SupportModal.tsx:59), `DXP-TKT-` (ContactPage.tsx:55) → `SDL-TKT-######`. *SupportModal now generates once at submit (it re-rolled on every render).*
- [x] Invoice auth ref `DXP-CORP-PAY-4091` → `SDL-INV-######` (DocumentCenterView.tsx:1368). *Derived per document, no longer the same number on every invoice.*
- [x] `DXP-AUTOGEN-REGISTER` → `DLS·····` (CreateShipmentView.tsx:4021)
- [x] `DXP SECURE LINEHAUL` badge → `SDL SECURE VAULT` (ServicesPage.tsx:584)

### 3.5 Demo data
- [x] `server/seed.ts` (17 hits) and `src/data/mockShipments.ts` (14 hits): rewrite as SDL demo shipments with worldwide
      routes (e.g. Lagos → London by air, Shanghai → Rotterdam by ocean, Dubai → Nairobi by air). Remove the
      personal-name demo ("Randy's Tacoma") and use fictional names like "Demo Consignee".
      *Both now build from `src/shared/demoData.ts`: DLS7K2M9 Lagos→London (air, in transit), DLS8M4PQ Shanghai→Rotterdam
      (sea, via Singapore), DLS3J7NK Dubai→Nairobi (air, delivered), DLS5P6TL Houston→Rotterdam (sea, delayed); two quotes.
      Demo names, example.com emails, no phones or street addresses. Tacoma presets/defaults in the admin wizard replaced.*

## 4. CSS / class naming
- [x] Tokens `--dxp-*` → `--sdl-*` (63 unique tokens, 59 files). Do it with a single, scoped find-and-replace on `src/`, then build.
- [x] Classes `.dxp-admin-*` → `.sdl-admin-*` (AdminLayout and its CSS). *All `dxp-` class prefixes were renamed to `sdl-` in the same pass.*
- [x] `.corp-highlight-orange` → `.sdl-highlight`; `text-orange` → `text-accent`. *Other `*-highlight-orange` page classes (about-, contact-, …) keep their names; they now render red.*
- [ ] Optional (Phase 5 cleanup): rename the `corp-` section prefixes on Home to `sdl-`.

## 5. Images & static assets (`Public/`)
| Old file | Action |
|---|---|
| `logo.png` | Replace → `Public/brand/sdl-logo.svg` (update Header.tsx:96, :193, DocumentCenterView ×5, PublicQuoteResultPage:382) |
| `logo-for-footer-or-any-area-having-thesame-color-as-the-footer.png` | Replace → `Public/brand/sdl-logo-white.svg` (Footer.tsx:102, AdminLayout.tsx:128) |
| `favicon.png` | Replace (index.html uses `/favicon.png?v=2`; bump to `?v=3`) |
| `Automotive & Parts.jpg`, `E-Commerce & Retail.jpg`, `Healthcare & Pharma.jpg` (root of Public, unused duplicates) | Delete |
| `images/home/*.jpg` (3) | Replace with `images/sdl/industry-*.jpg` (HomePage.tsx:573, 625, 651, 747, 769, 791) |
| `images/services/*.jpg` (3) | Replace with `images/sdl/service-*.jpg` |
| `images/tracking/truck_highway_hero.jpg` | Replace with `images/sdl/track-result-vehicle.jpg` (TrackResultPage.tsx:615) |
| `images/tracking/toyota_tacoma_hero.jpg` | Delete (tied to the old demo) |
| `screens/*` | Old reference screenshots; move out of the repo or into a private folder before the repo goes public |

## 6. Invented content to remove or replace (public trust and legal risk)
- [ ] **Testimonials** (HomePage.tsx:93–111): "Jessica Morgan / Apex", "David Vance", "Marcus Sterling". These are invented people. Replace with real, permissioned quotes, or swap the section for "Our commitments" (CONTENT.md §2.10).
- [ ] **Client logos** (ClientLogos.tsx: Titan, Kroma, Synthex, Voltix, Blackwood, Aeris, Norva, Zenith): invented brands presented as clients. Replace with real partners you're authorised to show, or with the "Modes we connect" strip (CONTENT.md §2.11).
- [ ] **Hard stats** (HomePage.tsx:863–871 "142 Trucks/Day", "48,000 Pcs/Hour", "1.4 Hours"; :994–1002 "0.001s", "100%", "Zero"; "YEARS OF…" at :499): keep only numbers SDL can verify.
- [ ] **Certification claims** ("CERTIFIED" badge, "Certified Quality Standards"): keep only certifications SDL actually holds.

## 7. Final sweep (the Phase 6 gate)

```bash
# Must return nothing:
grep -rniE "duolingo|dxp|nationwide|interstate" --exclude-dir={node_modules,dist,dist-server,.git} .
# Review each hit manually:
grep -rniE "\bUSA\b|United States|\bU\.S\.|1-800|555-01" src server
# Check built output and metadata:
grep -rli "duolingo" dist dist-server
```

**Phase 6 gate (tracker 6.1), 2026-09-29:** source and a fresh `npm run build` show **zero unexplained hits**. Every hit left is in the table below. Fixed in this pass: the last 5 `interstate` lines (public delay reason "Interstate Corridor Congestion" → "Road Congestion", state-centroid facility "{State} Interstate Gateway" → "{State} Gateway", the demo fallback event text, the admin ops strip "8 Commercial Interstate Hubs" → the live gateway count) and the U.S. defaults found by the S2 review (admin edit / quick-create / quote conversion stamped "United States"/"USA" and 10001/90001 postcodes; Settings "United States logistics corridors"; the CHEMTREC 1-800 placeholder).

**Allowed hits (document each here):** *Sweep run 2026-09-28 (tracker 1.12) on source and a fresh `npm run build`; re-run 2026-09-29 (tracker 6.1).*
| Hit | Why it's allowed |
|---|---|
| `server/db.ts:9`, `:11` (`OLD_BRAND_SETTINGS`), and the same strings in `dist-server/server/db.js` | Startup migration: finds the old seed's company name and email in an existing `settings` table and rewrites them to SDL values. It has to know the old values to match them. Nothing old is shown to users. |
| `server/db.ts:31` (`LEGACY_DB_FILE`), and `dist-server/server/db.js` | Only used to warn at startup that an old database file is present and ignored (DEPLOYMENT §4). |
| `scripts/trackingId.test.ts:56`, `:75`; `scripts/references.test.ts:43` | Negative tests: they assert that old `DXP-` IDs are rejected and that generated references contain no old-brand text. Not part of the build. |
| `CLAUDE.md`, `PROMPTS.md`, `docs/*.md` | Rebrand documentation that has to name the old strings to describe the job. Internal only; not in `dist/`. Review before the repo goes public. |
| Binary files: `Public/brand/og-image.jpg`, `Public/images/sdl/hero-home-1024.jpg`, `Public/images/sdl/track-hero-1024.webp`, `Public/images/sdl/about-hero-1024.webp` (and their `dist/` copies), `images/free-cc0/locations-hero.webp`, `images/landingimage.png` | False positives: `dxp` matched random bytes in compressed image data (e.g. `LdXP`, `DXP` between binary bytes). No text metadata. |
| `screens/*.png` (4 files) | False positives in binary data, like the images above. The folder itself is due to leave the repo (§5). |
| `data/sdl_global.db-wal` | Local dev database (gitignored, never deployed): stale WAL pages still hold pre-rebrand demo rows. CLAUDE.md rule 9: not touched. It clears on the next checkpoint or when the local DB is recreated. |
| `dex\b` (the tracker 1.12 pattern) | The only real word hit is "FedEx Custom Critical" (`src/pages/HomePage.tsx:142`), a third-party carrier name, not the old brand. Every other hit is `index`/`z-index`/`tabIndex`. That carrier list is invented partner content and belongs to task 3.14. |

| `scripts/routing.test.ts:46` | Negative test: asserts route descriptions contain no "interstate/highway" wording. |
| S2 review (`USA\|United States\|U.S.`), 2026-09-29 | Remaining hits are real geography, not U.S.-only assumptions: U.S. gateways (JFK, IAH, LAX) in `gateways.ts`, the U.S. state tables in `geocodingService.ts` / `timeZones.ts` (used only when a place is in the U.S.), country aliases in `countries.ts`, the Houston demo place (6.7) and code comments. |
| `(212)/(415) 555-01xx` pet presets in `CreateShipmentView.tsx` (admin chunk only) | Reserved fictional range (never a real number). They pre-fill the admin wizard's pet fields: clear with the demo data (tracker 6.7, Blocked #47). |

**History: deferred at 1.12, now closed by 2.x/3.x and 6.1** (kept for the record):
| Hits (2026-09-28) | Owner task |
|---|---|
| `nationwide\|interstate`: 64 lines in `src/` (pages 46, services 10, components 5, admin 3) | 2.2–2.4 (services, `USJourneyMap`), 3.2–3.13 (page copy) |
| S2 `USA\|United States\|U.S.\|1-800\|555-01`: 84 lines in `src/` | 2.1 (hub data, including the fake `1-800-555-0199` facility phones in `FacilityNetworkMap` and `LocationsPage`), 2.6 (address forms and defaults), 3.x (copy), 3.12 (documents print "USA") |
| `(212) 555-01xx` pet/vet presets in `CreateShipmentView.tsx`, `DocumentCenterView.tsx:428` sender-phone fallback | 3.12 (admin and document defaults). 555-01xx is the reserved fictional range, so these are not real numbers. |

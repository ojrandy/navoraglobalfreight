# Navora Global Freight — Brand Guide

> **Context:** The Navora platform is **already built and working**: public website, tracking engine, Express/SQLite API,
> admin console, documents and quotes. Claude is acting as a **senior professional developer** maintaining and improving
> this existing codebase. Nothing here is built from scratch; every task modifies the working system in place and must
> leave it working. See `CLAUDE.md §0`.

**Approach:** apply the brand through the existing design system (`src/styles/tokens.css`), not by replacing the UI.

## 1. Name usage

| Context | Use |
|---|---|
| Legal line, invoices, terms, footer copyright | **Navora Global Freight** (`LEGAL_NAME`) |
| First mention on a page, titles, meta | **Navora Global Freight** (`COMPANY`) |
| Repeated mentions, buttons, UI labels | **Navora** (`COMPANY_SHORT`) |

All three come from `src/config/brand.ts`; never hard-code them. `NGF` is an ID prefix only, not a name for copy.

Copyright line: `© {currentYear} Navora Global Freight. All rights reserved.` (year computed, not hard-coded).

## 2. Positioning

**One line:** Navora Global Freight moves time-critical and high-value cargo across borders, with one tracking number
and one accountable team from pickup to proof of delivery.

**Tagline:** *Connecting Markets, Delivering Trust* (as printed on the logo; `TAGLINE` in `brand.ts`).

**Pillars** (every page should reinforce at least one):
1. **Global reach.** Air, ocean and road connected under one network.
2. **Total visibility.** One 8-character tracking ID and live milestones from start to finish.
3. **Custody you can trust.** Scanned hand-offs, sealed high-value cargo, signed proof of delivery.
4. **People who answer.** Real coordinators, around the clock, across time zones.

## 3. Voice & tone

- **Confident, clear, calm.** We sound like the coordinator who already has it handled.
- Short sentences. Active voice. Concrete nouns ("customs clearance", "signed POD") over buzzwords.
- **Avoid:** "revolutionary", "cutting-edge", "seamless synergy", "60 FPS telemetry", Americanisms that
  assume a U.S. reader ("interstate", "nationwide", "coast to coast").
- **Spelling:** International English (British spelling: *organisation, colour, centre, licence*) to suit a
  worldwide audience. Be consistent.
- **Numbers:** only real, verifiable numbers. Otherwise, describe the capability without a figure.
- **Tracking term:** "tracking ID" everywhere in the public site (not "consignment ID", "waybill number", etc.).
  On documents: "Tracking ID / Waybill No.".

## 4. Colour

The palette follows the logo: black lettering with a red globe, arrow and "FREIGHT" word. Tokens live in
`src/styles/tokens.css`.

- **Brand Primary** = graphite (the logo black).
- **Brand Accent** = brand red (500 = `#D3070B`).
- **Ink / Deep** = a very dark graphite for the dark hero, footer and admin sidebar.
- **Contrast:** body text on backgrounds ≥ 4.5:1; large text/buttons ≥ 3:1. Adjust lightness, not hue.

### 4.1 Token names

```css
:root {
  /* Brand */
  --ngf-primary-50 … --ngf-primary-900;   /* graphite */
  --ngf-accent-50  … --ngf-accent-900;    /* brand red */
  --ngf-ink-950, --ngf-ink-900, --ngf-ink-800, --ngf-ink-700;  /* deep surfaces */

  /* Semantic (keep: shipment status colours must stay universally readable) */
  --ngf-success-*  (green)   /* Delivered */
  --ngf-warning-*  (amber)   /* Delayed / Exception pending */
  --ngf-danger-*   (red)     /* Exception / Held */
  --ngf-info-*     (blue)    /* In transit */

  /* Neutrals */
  --ngf-slate-50 … --ngf-slate-900, --ngf-white;

  /* Role aliases, which components should use */
  --ngf-color-bg, --ngf-color-surface, --ngf-color-text, --ngf-color-muted,
  --ngf-color-brand, --ngf-color-brand-contrast, --ngf-color-accent, --ngf-color-border, --ngf-color-focus;
}
```

Component classes use the `ngf-` prefix (e.g. `.ngf-nav-link`, `.ngf-timeline-card`).

### 4.2 Palette

| Role | Hex | Notes |
|---|---|---|
| Primary 900 (main buttons, headings) | `#171717` | graphite; full scale in `src/styles/tokens.css` |
| Accent 500 | `#D3070B` | brand red (Track button, highlights). Use Accent 600 `#B50407` for small red text on white, Accent 400 `#FE7060` for small red text on Ink |
| Ink 950 | `#141414` | hero/footer/admin sidebar (7.8% lightness) |
| Text on light | `#171717` | 17.93:1 on white (muted `#525252`: 7.81:1) |
| Text on dark | `#FFFFFF` | 18.42:1 on Ink 950 (muted `#D4D4D4`: 12.43:1). Accent 500 on Ink is 3.34:1: large text/icons only |

## 5. Typography

Keep the current, well-performing trio (already loaded in `index.html`):

| Use | Font | Weights |
|---|---|---|
| Display / headings | Plus Jakarta Sans | 600, 700, 800 |
| Body / UI | Inter | 400, 500, 600 |
| Tracking IDs, codes, labels | JetBrains Mono | 500, 600 |

- Headings: tight tracking (-0.02em), line-height 1.1.
- Body: 16px min (17–18px on marketing pages), line-height 1.6.
- Add `font-display: swap` (already present via Google Fonts `display=swap`). Consider self-hosting for speed.

## 6. Logo usage

- Source: `images/Nov-logo.png` (raster; a vector original is still wanted, tracker Blocked #48).
  `scripts/optimize-images.mjs --brand` builds the files in `Public/brand/`: `logo.png` (full colour), `logo-white.png`
  (dark surfaces), `mark.png` (globe mark), `favicon.png`, `favicon-16.png`, `favicon-32.png`, `icon-192.png`,
  `icon-maskable-512.png`, `apple-touch-icon.png` and `og-image.jpg` (1200×630).
- Header uses the full-colour logo on light surfaces, the white logo on Ink.
- Clear space = height of the "N" around the logo. Minimum width: 110px desktop, 96px mobile.
- Never stretch, recolour, add shadows, or place on busy photos without an overlay.

## 7. Tracking ID and other identifiers

**Tracking ID (8 characters exactly):** `NGF` + 5 characters from the safe alphabet (`TRACKING_PREFIX` in `brand.ts`).

```
Format:    NGF + [5 chars]           e.g. NGF7K2M9, NGFQ4X8T
Alphabet:  23456789ABCDEFGHJKLMNPQRSTUVWXYZ   (no 0/O, 1/I, to avoid misreading)
Capacity:  32^5 = 33,554,432 unique IDs
Regex:     ^NGF[2-9A-HJ-NP-Z]{5}$
Input:     trim, uppercase, strip spaces and dashes before validating ("ngf 7k2-m9" → NGF7K2M9)
```

- One shared module, `src/shared/trackingId.ts`, used by the server and the client. **The server is the authority:**
  `server/trackingIds.ts` generates with `crypto.randomInt`, checks uniqueness against the DB and retries on collision.
- **Multi-piece child labels:** base ID + piece suffix, e.g. `NGF7K2M9-01`, `NGF7K2M9-02`. The tracking ID
  itself stays 8 characters, and a search for a child label resolves to the parent.
- **Returns:** a return gets its own new NGF ID and is linked to the original (no `RTO-` prefix).

**Other references** (`src/shared/references.ts`, prefix `REFERENCE_PREFIX`; not tracking IDs, so not bound by the
8-character rule):

| Reference | Format | Example |
|---|---|---|
| Security seal | `NGF-SL-######` | NGF-SL-892401 |
| Support / contact ticket | `NGF-TKT-######` | NGF-TKT-418230 |
| Invoice | `NGF-INV-######` | NGF-INV-004091 |
| Tracking ID not yet assigned | `NGF·····` placeholder | shown until the server returns the ID |
| Quote | `QR-2026-#####` | server-issued; format still open (tracker Blocked #35) |

## 8. Imagery

**Style:** real operations with real people in them: aircraft loading, container terminals, warehouses, couriers
handing over parcels, customs and documentation, vehicles on carriers. Natural light, slightly cool grade, no
cheesy stock handshakes. Diverse global settings (Africa, Europe, Asia, the Americas, the Middle East).
No photo may show a company name or logo.

**Pipeline:** source photos live in `images/free-stock/` (credits in `SOURCES.md`) and `images/free-cc0/`.
`scripts/optimize-images.mjs` writes WebP + JPG per width into `Public/images/site/` and the manifest
`src/data/siteImages.ts` (`SITE_IMAGES`), which `<ResponsiveImage>` reads. Slot names, pages and alt text: CONTENT §12.

## 9. UI details that carry the brand

- **Radius:** 14px cards, 10px inputs, 999px pills.
- **Shadows:** soft and layered (they also sell the 3D depth), e.g.
  `0 1px 2px rgb(0 0 0 / .06), 0 8px 24px rgb(0 0 0 / .08)`; lifted state adds `0 24px 48px rgb(0 0 0 / .12)`.
- **Buttons:** Primary = brand fill; Secondary = outline; the "Track" button always uses the accent.
- **Icons:** lucide-react, 1.75 stroke, sized 18/20/24.
- **Status chips:** fixed semantic colours (see §4.1), never brand colours, so status is always readable.

# SDL Global Logistics — Brand Guide

> **Context:** The SDL platform is **already built and working**: public website, tracking engine, Express/SQLite API,
> admin console, documents and quotes. Claude is acting as a **senior professional developer** who has taken over this
> existing codebase to rebrand and improve it. Nothing here is built from scratch; every task modifies the working system
> in place and must leave it working. See `CLAUDE.md §0`.

**Approach:** apply the brand to the existing design system (`src/styles/tokens.css`) by re-theming it, not by replacing the UI.

## 1. Name usage

| Context | Use |
|---|---|
| Legal line, invoices, terms, footer copyright | **SDL Global Logistics Ltd** |
| First mention on a page, titles, meta | **SDL Global Logistics** |
| Repeated mentions, buttons, UI labels | **SDL** |
| Never | "SDL Logistics", "S.D.L.", "Sdl", "SDL Global" on its own |

Copyright line: `© {currentYear} SDL Global Logistics Ltd. All rights reserved.` (year computed, not hard-coded).

## 2. Positioning

**One line:** SDL Global Logistics moves time-critical and high-value cargo across borders, with one tracking number
and one accountable team from pickup to proof of delivery.

**Tagline (primary):** *Fast, Safe, Reliable.* (as printed on the logo; owner decision 2026-09-26)
**Alternates:** *Global reach. Personal accountability.* · *Wherever it's going, we're already there.*

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

## 4. Colour — derived from the logo

The palette must be built from the SDL logo. **Process (Phase 1, task 1.2):**

1. Put the logo at `Public/brand/sdl-logo.svg` (or high-res PNG).
2. Sample the logo's colours (SVG fill values, or a quick script using `sharp`'s `stats()` / dominant colour on the PNG).
3. Assign roles:
   - **Brand Primary** = the logo's dominant colour.
   - **Brand Accent** = the logo's secondary colour. If the logo has only one colour, choose the complementary
     accent from the table below.
   - **Ink / Deep** = a very dark shade of Primary (for the dark hero, footer and admin sidebar). Lightness about 8–12%.
4. Generate the scale for Primary and Accent (50, 100, 200 … 900) in OKLCH by keeping the hue and chroma and
   stepping lightness.
5. **Check contrast:** body text on backgrounds ≥ 4.5:1; large text/buttons ≥ 3:1. Adjust lightness, not hue.
6. Write the results into `src/styles/tokens.css` using the token names below, then record the hex values in the
   table in §4.2.

### 4.1 Token names (replace the old `--dxp-*` set)

```css
:root {
  /* Brand */
  --sdl-primary-50 … --sdl-primary-900;   /* from logo dominant colour */
  --sdl-accent-50  … --sdl-accent-900;    /* from logo secondary colour */
  --sdl-ink-950, --sdl-ink-900, --sdl-ink-800, --sdl-ink-700;  /* deep surfaces */

  /* Semantic (keep: shipment status colours must stay universally readable) */
  --sdl-success-*  (green)   /* Delivered */
  --sdl-warning-*  (amber)   /* Delayed / Exception pending */
  --sdl-danger-*   (red)     /* Exception / Held */
  --sdl-info-*     (blue)    /* In transit */

  /* Neutrals */
  --sdl-slate-50 … --sdl-slate-900, --sdl-white;

  /* Role aliases, which components should use */
  --sdl-color-bg, --sdl-color-surface, --sdl-color-text, --sdl-color-muted,
  --sdl-color-brand, --sdl-color-brand-contrast, --sdl-color-accent, --sdl-color-border, --sdl-color-focus;
}
```

The existing site uses an **orange** highlight (`--dxp-orange-*`, `.corp-highlight-orange`). Map every orange usage to
`--sdl-accent-*` and rename the classes (`.corp-highlight-orange` → `.sdl-highlight`).

### 4.2 Final palette (fill in after extraction)

| Role | Hex | Notes |
|---|---|---|
| Primary 900 (main buttons, headings) | `#171717` | graphite from the logo black `#060606`; full scale in `src/styles/tokens.css` |
| Accent 500 | `#D3070B` | the exact logo red (Track button, highlights). Use Accent 600 `#B50407` for small red text on white, Accent 400 `#FE7060` for small red text on Ink |
| Ink 950 | `#141414` | hero/footer/admin sidebar (7.8% lightness) |
| Text on light | `#171717` | 17.93:1 on white (muted `#525252`: 7.81:1) |
| Text on dark | `#FFFFFF` | 18.42:1 on Ink 950 (muted `#D4D4D4`: 12.43:1). Logo red on Ink is 3.34:1: large text/icons only |

**Fallback if the logo is monochrome:** Primary = logo colour; Accent = a warm contrasting hue (amber/orange if
Primary is blue/navy; teal if Primary is red/orange). Get the owner's approval before using it.

## 5. Typography

Keep the current, well-performing trio (already loaded in `index.html`) unless the logo uses a specific typeface:

| Use | Font | Weights |
|---|---|---|
| Display / headings | Plus Jakarta Sans | 600, 700, 800 |
| Body / UI | Inter | 400, 500, 600 |
| Tracking IDs, codes, labels | JetBrains Mono | 500, 600 |

- Headings: tight tracking (-0.02em), line-height 1.1.
- Body: 16px min (17–18px on marketing pages), line-height 1.6.
- Add `font-display: swap` (already present via Google Fonts `display=swap`). Consider self-hosting for speed.

## 6. Logo usage

- Files in `Public/brand/`: `sdl-logo.svg` (full colour), `sdl-logo-white.svg` (dark surfaces), `sdl-mark.svg`
  (icon only), `favicon.png` (512×512), `apple-touch-icon.png` (180×180), `og-image.jpg` (1200×630).
- Header uses the full-colour logo on light, the white logo when the header is over the dark hero.
- Clear space = height of the "S" around the logo. Minimum width: 110px desktop, 96px mobile.
- Never stretch, recolour, add shadows, or place on busy photos without an overlay.
- The old file `logo-for-footer-or-any-area-having-thesame-color-as-the-footer.png` is replaced by `sdl-logo-white.svg`.

## 7. Tracking ID and other identifiers

**Tracking ID (8 characters exactly):** `DLS` + 5 characters from the safe alphabet.

```
Format:    DLS + [5 chars]           e.g. DLS7K2M9, DLSQ4X8T
Alphabet:  23456789ABCDEFGHJKLMNPQRSTUVWXYZ   (no 0/O, 1/I, to avoid misreading)
Capacity:  32^5 = 33,554,432 unique IDs
Regex:     ^DLS[2-9A-HJ-NP-Z]{5}$
Input:     trim, uppercase, strip spaces and dashes before validating ("dls 7k2-m9" → DLS7K2M9)
```

- Generate with `crypto.getRandomValues` (client) / `crypto.randomInt` (server). **The server is the authority:**
  check uniqueness against the DB and retry on collision.
- Put it in one shared module, e.g. `src/shared/trackingId.ts`, imported by the server and the client (the server
  tsconfig must include it).
- **Multi-piece child labels:** base ID + piece suffix, e.g. `DLS7K2M9-01`, `DLS7K2M9-02`. The tracking ID
  itself stays 8 characters, and a search for a child label resolves to the parent.
- **Returns:** a return gets its own new DLS ID and is linked to the original (no `RTO-` prefix).

**Other references** (not tracking IDs, so they're not bound by the 8-character rule):

| Old | New | Example |
|---|---|---|
| `DXP-SEAL-######` | `SDL-SL-######` | SDL-SL-892401 |
| `DXP-SPT-#####` / `DXP-TKT-######` | `SDL-TKT-######` | SDL-TKT-418230 |
| `DXP-CORP-PAY-####` | `SDL-INV-######` | SDL-INV-004091 |
| `DXP-AUTOGEN-REGISTER` | `DLS·····` placeholder | shown before the ID is generated |
| `DXP SECURE LINEHAUL` badge | `SDL SECURE VAULT` | |

## 8. Imagery

**Style:** real operations with real people in them: aircraft loading, container terminals, warehouses, couriers
handing over parcels, customs and documentation, vehicles on carriers. Natural light, slightly cool grade, no
cheesy stock handshakes. Diverse global settings (Africa, Europe, Asia, the Americas, the Middle East).

**Drop your files into `Public/images/sdl/` using these names:**

| File name | Used on | Size (min) |
|---|---|---|
| `hero-globe-fallback.jpg` | Home hero (fallback when 3D is off) | 2400×1400 |
| `hero-home.jpg` | Home hero background/overlay | 2400×1400 |
| `service-priority-express.jpg` | Services, Home services | 1600×1100 |
| `service-freight-linehaul.jpg` | Services, Home services | 1600×1100 |
| `service-vehicle-transport.jpg` | Services, Home services | 1600×1100 |
| `service-secure-vault.jpg` | Services, Home services | 1600×1100 |
| `industry-healthcare.jpg` | Home industries, Services | 1600×1100 |
| `industry-technology.jpg` | Home industries, Services | 1600×1100 |
| `industry-automotive.jpg` | Home industries, Services | 1600×1100 |
| `industry-ecommerce.jpg` | Home industries, Services | 1600×1100 |
| `about-team.jpg` | About hero / story | 2000×1300 |
| `about-operations.jpg` | About | 1600×1100 |
| `track-hero.jpg` | Track page hero | 2400×1200 |
| `track-result-vehicle.jpg` | Track result header visual | 1600×900 |
| `locations-hero.jpg` | Locations hero | 2400×1200 |
| `contact-hero.jpg` | Contact hero | 2400×1200 |
| `og-image.jpg` | Social share preview | 1200×630 |

If you have different images, keep your names and update this table. Claude will convert them to WebP and
generate responsive sizes (640 / 1024 / 1600 / 2400).

## 9. UI details that carry the brand

- **Radius:** 14px cards, 10px inputs, 999px pills.
- **Shadows:** soft and layered (they also sell the 3D depth), e.g.
  `0 1px 2px rgb(0 0 0 / .06), 0 8px 24px rgb(0 0 0 / .08)`; lifted state adds `0 24px 48px rgb(0 0 0 / .12)`.
- **Buttons:** Primary = brand fill; Secondary = outline; the "Track" button always uses the accent.
- **Icons:** lucide-react, 1.75 stroke, sized 18/20/24.
- **Status chips:** fixed semantic colours (see §4.1), never brand colours, so status is always readable.

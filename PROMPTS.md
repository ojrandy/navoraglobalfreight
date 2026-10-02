# Navora Global Freight — Prompt Pack for Claude in VS Code

**The job:** turn this working logistics site into **Navora Global Freight** on its own **new domain on
Hostinger**. That means a new name, logo, photos, admin password and tracking-ID prefix. **What stays the same:** the design,
colour palette, fonts, layout and every feature. Target time: **about an hour**.

**How to use**
- Send the prompts in order, one per chat turn. After each one, check the site (`npm run dev` →
  http://localhost:3000) before sending the next.
- If something breaks, send **Prompt F (Fix)**. New chat? Send **Prompt R (Resume)** first.

> ⛔ **Never touch the other project.** The previous brand's domain, Hostinger app, GitHub repo and database
> belong to a separate, live business. Don't edit, redirect, take down or reuse any of them. Everything here is a new, separate site.

---

## Project values (already filled in)

| Key | Value |
|---|---|
| Name | **Navora Global Freight** |
| Short name | **Navora** |
| Legal name | **Navora Global Freight** (confirmed by the owner) |
| Tagline | **Connecting Markets, Delivering Trust** (replaces "Fast, Safe, Reliable") |
| Domain | **navoraglobalfreight.com** |
| Email | **info@navoraglobalfreight.com** |
| Admin console | **https://private.navoraglobalfreight.com** (same app, separate subdomain) · `http://localhost:3000/#/admin` locally |
| Tracking ID | **`NGF` + 5 characters = 8 total**, e.g. `NGF7K2M9` |
| Reference prefixes | `NGF-TKT-######`, `NGF-INV-######`, `NGF-SL-######` |
| Internal code prefix | `ngf` (CSS `--ngf-*`, classes `ngf-*`, storage keys `ngf_*`, cookie `ngf.sid`, DB file `navora.db`) |
| Logo source | `images/Nov-logo.png` (2024×777, **no transparency**, light grey background) |
| Palette | **Unchanged.** Red `#D3070B` + ink `#181818` + greys already match the new logo |
| Phone / WhatsApp / address | **Not supplied yet. Leave the brand.ts values empty and keep them hidden.** Never invent them. Add them later with Prompt O |
| Old brand terms to remove | `SDL`, `sdl`, `DLS` (as an ID prefix), `sdlgloballogistics`, `Duolingo`, `dxp` |

---

### Prompt 1: Safety net & inventory (no code changes, ~5 min)
```
We're turning this working site into "Navora Global Freight" on a new domain. Read PROMPTS.md (the values table is the source of truth), CLAUDE.md, src/config/brand.ts, index.html, scripts/optimize-images.mjs, src/data/sdlImages.ts and docs/DEPLOYMENT.md.

Rules for this whole job: no changes to design, colours, fonts, layout or features. Don't touch the other project's domain, repo, Hostinger app or database.

1. `git status`. If this isn't a repo yet, `git init`. Commit the current state as "chore: snapshot before Navora rebrand" on a branch `navora`.
2. Run `npm run build` and record the result (baseline).
3. Count every occurrence of the old brand terms (see the table) in src, server, scripts, index.html, Public, docs and CLAUDE.md, grouped as: visible text / metadata / PDFs & documents / internal names (CSS, classes, storage keys, cookie, DB file, types, folders) / comments / docs.
4. Open every photo used by the site (Public/images/sdl/ and the originals in images/) and list which ones show old-brand logos or lettering, or any company branding on vehicles, aircraft, ships or uniforms. Say which page and slot each one fills.

STOP and report: build result, counts per group, the photo list, and any questions.
```

### Prompt 2: New logo & icons (~10 min)
```
Replace the logo with images/Nov-logo.png. Same placement and sizes, no layout change.

1. The source has a light grey background and no transparency. Remove the background cleanly (scripts/optimize-images.mjs already has a whiteToAlpha helper; extend it so the off-white/grey texture becomes fully transparent with smooth edges and no grey halo). Trim the empty margins.
2. Produce, in Public/brand/:
   - logo.png: full colour (black + red) on transparent, for light backgrounds.
   - logo-white.png: same logo with the black parts turned white and the red kept, for dark backgrounds (header over the hero, footer, admin sidebar).
   - mark.png: square icon cropped from the red globe-with-arrow symbol.
   - favicon.png (512), favicon-32.png, favicon-16.png, icon-192.png, icon-maskable-512.png (safe padding), apple-touch-icon.png (180) from mark.png.
   - og-image.jpg (1200×630): logo centred on the current brand background.
   Do it in scripts/optimize-images.mjs so it can be re-run. Don't upscale.
3. Point LOGO / LOGO_WHITE in brand.ts at the new files, replace every direct reference to the old logo/mark paths (HomePage barcode label, index.html JSON-LD, documents/PDFs, admin), then delete the old logo and icon files.
4. Bump the ?v=N cache-bust in index.html and site.webmanifest.
5. The new logo is wide (about 2.6:1), with a small tagline. Check the header, mobile menu, footer, admin sidebar and login, a PDF, and the browser tab. If it reads too small or too large anywhere, adjust ONLY that logo's height/width rule.

`npm run build` must pass. Commit "rebrand: Navora logo and icons". STOP and show me how the logo looks on light and dark backgrounds.
```

### Prompt 3: Name, domain, email, tracking IDs, references (~10 min)
```
Apply the values table everywhere users can see it. Keep the copy word-for-word apart from the name. No new marketing text.

1. src/config/brand.ts: COMPANY "Navora Global Freight", COMPANY_SHORT "Navora", LEGAL_NAME "Navora Global Freight", TAGLINE "Connecting Markets, Delivering Trust", EMAIL, DOMAIN "navoraglobalfreight.com", ADMIN_SUBDOMAIN "private", TRACKING_PREFIX "NGF". PHONE, WHATSAPP, HQ_ADDRESS and SOCIAL stay empty, and the UI keeps hiding them.
   The tagline change carries to the Footer and admin sidebar motto through TAGLINE. Also update by hand:
   - the Home hero H1 (HomePage.tsx): "Connecting Markets," <br /> then the accent-highlight span "Delivering Trust." (same markup pattern as today). It's longer than before, so check it at 375px, 768px and 1440px. If it overflows or wraps badly, adjust only that title's font-size/clamp rule.
   - index.html og:title / twitter:title ("Navora Global Freight: Connecting Markets, Delivering Trust") and the JSON-LD "slogan".
   - docs/CONTENT.md (OG title, footer brand block, hero H1).
2. Hard-coded strings: index.html (title, description, canonical, OG/Twitter, JSON-LD Organization), Public/site.webmanifest, App.tsx page titles/descriptions, page copy ("Why ___", "your ___ tracking ID", "___ coordinator"), image alt text, legalDocs.ts, DocumentBrand.tsx and every document/PDF label, server/index.ts (health service name, start log), server/db.ts settings defaults. In .ts/.tsx, import from brand.ts rather than hard-coding a new string.
3. Tracking IDs: trackingId.ts already builds its regex from TRACKING_PREFIX. Update every example/placeholder (DLS7K2M9 → NGF7K2M9, "DLS·····" → "NGF·····"), help text and scripts/trackingId.test.ts. Run the tests.
4. References: generate and display NGF-TKT / NGF-INV / NGF-SL, and update scripts/references.test.ts.

`npm run build` and the tests must pass. Check Home, Track, Contact, Legal and one PDF at 375px and 1440px, then create a shipment in admin and confirm it gets an NGF ID that tracks publicly. Commit "rebrand: Navora name, domain, email and IDs". STOP and report.
```

### Prompt 4: Replace branded photos with free UHD images (~15 min)
```
Replace every photo you listed in Prompt 1 (old-brand or other company branding visible) with free, high-quality stock photos. Keep the same slots, crops and aspect ratios, so the layout doesn't move.

1. Sources: Pexels, Unsplash or Pixabay only (free for commercial use, no attribution required). Download the original at ≥ 3840 px wide (UHD/4K) where the photo is landscape; for square/portrait slots, at least 2400 px on the short side.
2. Pick photos that:
   - show what the slot is about (port and containers, air cargo, trucks on a highway, warehouse, team at work, etc.; match the current alt text's subject),
   - show NO readable company names, logos or livery (no Maersk/DHL/FedEx etc.),
   - fit the palette: neutral, dark, dusk or steel tones with some red where possible. Avoid strong blues and greens that clash with the red/black brand. Don't recolour or filter them heavily.
3. Save the originals in images/free-stock/ and record every file in images/free-stock/SOURCES.md (file, source page URL, photographer, licence, date), like the existing SOURCES.md files.
4. Point scripts/optimize-images.mjs at the new originals and re-run it. Web outputs stay capped at the current widths (max 2400 px, ≤ 250 KB at 1600w): the 4K originals are source files and are not served.
5. Update the alt text in the pages (and docs/CONTENT.md) to describe what each new photo actually shows.
6. Delete the old branded originals from images/ and their outputs from Public/images/.

Re-open every photo on the live site and confirm none shows old branding. `npm run build` must pass. Check Home, Services, About, Track and Track Result at 375px and 1440px. Commit "assets: replace branded photos with free stock". STOP and show me a list of new photo → slot, with the source links.
```

### Prompt 5: Internal clean-up: remove every old-brand trace (~10 min)
```
Remove the remaining internal old-brand names so the codebase carries zero trace. This is a mechanical rename; behaviour must not change. The new site starts with a fresh, empty database, so nothing needs migrating.

1. CSS: --sdl-* → --ngf-*, class prefix sdl- → ngf-, in one scoped pass across src/ and index.html. Then grep that no `--sdl-` or `sdl-` class remains, and no CSS var is left undefined.
2. Storage keys sdl_* → ngf_*, session cookie sdl.sid → ngf.sid (only the name; don't change auth logic in server/middleware/auth.ts), and update the cookie/storage names listed in legalDocs.ts.
3. DB file sdl_global.db → navora.db (server/db.ts, server/index.ts, .env.example, docs). Remove the legacy-DB-file warning and any startup migration whose only job was rewriting old-brand wording in pre-rebrand rows, since this site never has such rows. Don't rename tables or columns.
4. Public/images/sdl/ → Public/images/site/; src/data/sdlImages.ts → siteImages.ts with SDL_IMAGES/SdlImageName/SdlImageInfo → SITE_IMAGES/SiteImageName/SiteImageInfo; update scripts/optimize-images.mjs and all imports.
5. Comments, file names, test names and package.json name ("navora-global-freight"; regenerate package-lock.json) that mention the old brand → Navora or brand-neutral.
6. Docs: rewrite CLAUDE.md §1–§2 for Navora (it should describe the project as Navora Global Freight, with no history of earlier brands). Update the company facts in docs/BRAND_GUIDE.md, CONTENT.md, DEPLOYMENT.md, MOTION_3D_SPEC.md and PROJECT_TRACKER.md (add a dated "Navora launch" note). Delete docs/REBRAND_MAP.md, since it only describes the old rebrand.

Final grep over src, server, scripts, index.html, Public, docs, CLAUDE.md, package.json for: sdl, dls (as ID prefix), duolingo, dxp (case-insensitive). The goal is zero hits; list any you can't remove and why. Then `npm run build`, delete my local data/ DB if it's the old file name (tell me first), run `npm run dev` and confirm: pages look identical, admin login, create → track, a PDF, a quote. Commit "chore: remove remaining old-brand names". STOP and report.
```

### Prompt 6: New admin password & session secret (~5 min)
```
Set a new admin password and session secret. Configuration only: don't edit auth logic.

1. Give me the two commands to run MYSELF in the project folder. Don't run them, and never ask for the password:
   - node -e "console.log(require('bcryptjs').hashSync('MY-NEW-PASSWORD', 12))"
   - node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
2. Tell me exactly what to put in my local .env (ADMIN_PASSWORD_HASH, SESSION_SECRET), and whether the `$` characters in the hash need quoting. Remind me the same values go into Hostinger in Prompt 8.
3. After I say "done", restart `npm run dev` and have me confirm: the old password is rejected, the new one works at http://localhost:3000/#/admin, and logout/login works.
STOP.
```

### Prompt 7: Final check (~5 min)
```
1. Fresh `npm run build`, then sweep src, server, Public, index.html AND dist/ + dist-server/ for the old brand terms. Zero visible hits.
2. Full run on localhost: admin login → create shipment (NGF ID) → track publicly → change status → generate each document type → quote → contact message. Confirm the new name, logo and photos show everywhere and nothing else changed visually.
3. Confirm the admin only opens on private.navoraglobalfreight.com in production, and #/admin on localhost in dev.
4. Confirm there's no demo data in code or seed and SEED_DEMO_DATA is unset/false.
Commit any fixes as "chore: pre-deploy checks". STOP with a short ready / not-ready report.
```

### Prompt 8: Deploy to navoraglobalfreight.com on Hostinger (~15 min, mostly me in hPanel)
```
Prepare the deploy per docs/DEPLOYMENT.md. Don't deploy anything yourself; give me instructions. This is a NEW, separate site. Don't touch the other project's repo, app, domain or database.

1. GitHub: commands to push this project to a NEW empty repo I've created (fresh history; check .gitignore excludes node_modules, dist, dist-server, data, .env).
2. hPanel: create a new Node.js app, connect the repo, Node ≥ 22.5, install/build/start commands, entry dist-server/server/index.js.
3. Env vars: NODE_ENV=production, PORT if needed, ADMIN_PASSWORD_HASH and SESSION_SECRET (from Prompt 6), DB_PATH in persistent storage (e.g. …/persistent-storage/navora.db). The database starts empty.
4. Domains: navoraglobalfreight.com + www + private.navoraglobalfreight.com all on the SAME app, SSL on all three, force HTTPS, and the DNS records if the domain is registered elsewhere.
5. Smoke test: new logo, name, photos and tab icon; share preview uses navoraglobalfreight.com; #/admin on the public domain does NOT open admin; admin login works on private.navoraglobalfreight.com with the new password; create → track an NGF shipment; data survives a redeploy.
STOP and wait for my results.
```

---

## Utility prompts

### Prompt R: Resume in a new chat
```
Resume the Navora Global Freight launch. Read CLAUDE.md, PROMPTS.md and docs/PROJECT_TRACKER.md, run `git status` and `git log --oneline -10`, then tell me which prompt we're on and what's next. Don't change anything until I confirm.
```

### Prompt O: Owner contact details arrived
```
Here are Navora's contact details: [phone / WhatsApp / HQ address / social links].
Add them to src/config/brand.ts (and the JSON-LD in index.html), confirm the UI that was hidden now shows them correctly on Header, Footer, Contact and documents, update the values table in PROMPTS.md, build, and commit "content: add Navora contact details".
```

### Prompt F: Fix something that broke
```
Something broke: [what you see, which page, steps, any error message].
Find the root cause (check the latest commits first) and explain it before fixing. Apply the smallest fix that doesn't change design or unrelated behaviour, confirm `npm run build` passes and admin login → create → track still works, and commit "fix: …".
```

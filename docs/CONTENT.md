# Navora Global Freight — Content Deck (all site copy)

> **Context:** The Navora platform is **already built and working**: public website, tracking engine, Express/SQLite API,
> admin console, documents and quotes. Claude is acting as a **senior professional developer** who maintains and improves this
> existing codebase. Nothing here is built from scratch; every task modifies the working system
> in place and must leave it working. See `CLAUDE.md §0`.

**Approach:** the pages, sections and components already exist. Swap this copy into the existing markup, keeping the current layout and structure unless a doc says otherwise.

This is the **only** source of marketing and UI copy. Claude Code must use this text verbatim (small edits to fit
the layout are fine) and must not invent new claims.

**Placeholders.** Anything in `{{DOUBLE_BRACES}}` comes from `src/config/brand.ts` or needs the owner's input. Never
ship a page with a visible `{{…}}`. Hide the element if the value is missing.

| Placeholder | Value |
|---|---|
| `{{COMPANY}}` | Navora Global Freight |
| `{{LEGAL_NAME}}` | Navora Global Freight |
| `{{EMAIL}}` | info@navoraglobalfreight.com |
| `{{DOMAIN}}` | navoraglobalfreight.com |
| `{{PHONE}}` / `{{WHATSAPP}}` | TBD (owner) |
| `{{HQ_ADDRESS}}` | TBD (owner) |
| `{{YEAR_FOUNDED}}` | TBD (owner). If unknown, remove the "years" stat |
| `{{JURISDICTION}}` | TBD (the country where the Ltd is registered) |

Spelling: International/British English (see BRAND_GUIDE §3).

---

## 1. Global: metadata, header, footer

### 1.1 `index.html` and per-page meta
- **Default title:** `Navora Global Freight | Worldwide Express, Freight & Secure Cargo`
- **Default description:** `Navora Global Freight moves express parcels, freight, vehicles and high-value cargo worldwide, with one tracking ID, live milestones and signed proof of delivery.`
- **OG title:** `Navora Global Freight: Connecting Markets, Delivering Trust`
- **OG description:** same as the default description. **OG image:** `/brand/og-image.jpg`

| Page | `<title>` | Meta description |
|---|---|---|
| Home | Navora Global Freight \| Worldwide Express, Freight & Secure Cargo | (default) |
| Track | Track a Shipment \| Navora Global Freight | Enter your 8-character Navora tracking ID to see live milestones, location and delivery status. |
| Services | Logistics Services \| Navora Global Freight | Priority express, scheduled air, ocean and road freight, vehicle shipping and secure high-value transport, worldwide. |
| Quote | Get a Rate Quote \| Navora Global Freight | Tell us what you're moving and where. A logistics coordinator will send your rate. |
| Ship | Book a Shipment \| Navora Global Freight | Book a pickup, build a multi-piece shipment and get your tracking ID in minutes. |
| About | About Us \| Navora Global Freight | Who we are, how we work and why shippers around the world trust Navora with cargo that matters. |
| Locations | Global Network \| Navora Global Freight | The gateways and trade lanes that connect Navora shipments across Africa, Europe, the Middle East, Asia and the Americas. |
| Help | Help Centre \| Navora Global Freight | Answers on tracking, booking, customs, documents and deliveries. |
| Contact | Contact Us \| Navora Global Freight | Talk to a Navora coordinator, any time zone, any day. |
| Legal | Policies \| Navora Global Freight | Privacy, terms of service, shipping terms and accessibility. |

### 1.2 Header
- Nav: **Track** · **Ship** · **Services** · **Network** (→ Locations) · **About** · **Help** · **Contact**
- Primary button: **Get a Quote**
- Utility bar (desktop only): `24/7 Global Support · {{EMAIL}}` and, if set, `{{PHONE}}`
- Mobile drawer footer: `Need help? {{EMAIL}}`

### 1.3 Footer
**Brand block:** logo (white) + `Connecting Markets, Delivering Trust.`
`Express, freight and secure cargo across borders, with one tracking ID and one accountable team from pickup to proof of delivery.`

**Trust strip (4 items, replaces "Nationwide Coverage" and friends):**
1. **Worldwide Coverage.** Air, ocean and road, connected.
2. **Live Milestones.** Every hand-off scanned and time-stamped.
3. **Piece-Level Labels.** Every carton individually barcoded.
4. **Signed Delivery.** Digital proof of delivery on every shipment.

**Columns**
- *Services:* Priority Express · Freight & Linehaul · Vehicle Shipping · Secure Vault · Get a Quote
- *Company:* About Navora · Global Network · Contact · Careers (hide until live)
- *Support:* Track a Shipment · Help Centre · Book a Shipment · Report an Issue
- *Legal:* Privacy Policy · Terms of Service · Shipping Terms · Cookie Policy · Accessibility

**Bottom line:** `© {year} Navora Global Freight. All rights reserved.` · `{{HQ_ADDRESS}}` (hidden if empty)
**Social:** only show icons that have a real URL.

---

## 2. Home page (13 sections, same order as the current build)

### 2.1 Hero
- **Badge:** `WORLDWIDE LOGISTICS NETWORK`
- **H1:** `Connecting Markets,` **`Delivering Trust.`** (the second line takes the accent highlight)
- **Hero image:** `images/free-stock/hero-home.jpg` on web (`hero-home`), `images/free-stock/hero-home-mobile.jpg` on phones (`hero-home-mobile`, below 768px)
- **Sub:** `Express parcels, freight, vehicles and high-value cargo, moved across borders by a team that answers, with one tracking ID from pickup to signed delivery.`
- **Buttons:** `Get a Rate Quote` (primary) · `Track a Shipment` (ghost)
- **Inline track field (if present):** placeholder `Enter tracking ID, e.g. NGF7K2M9`, button `Track`
- **Guarantee panel.** Title `OUR SERVICE PROMISE` (remove the "CERTIFIED" badge unless a real certification exists)
  1. **Agreed Delivery Windows.** You get a committed pickup and delivery window, and we tell you the moment anything changes.
  2. **Unbroken Chain of Custody.** Every hand-off is scanned, every high-value item is sealed, and every delivery is signed.
  3. **Real People, Every Time Zone.** A named coordinator follows your shipment and replies around the clock.
- **Hotline line:** `Priority line: {{PHONE}}` (hidden if empty; fall back to `{{EMAIL}}`)

### 2.2 Why shippers choose Navora (3 floating cards)
- **Eyebrow:** `WHY Navora`
- **H2:** `Why shippers around the world choose Navora`
- **Intro:** `Global reach only matters if every shipment is handled like it's the only one. That's the standard we work to.`
1. **Priority Express, Worldwide.** Door-to-door express for documents and parcels that can't wait. Booked in minutes, collected fast, cleared and delivered on an agreed window.
2. **Scheduled Freight on Every Mode.** Air, ocean and road departures on fixed schedules. Consolidated or dedicated, with one booking, one tracking ID and one invoice.
3. **Visibility at Every Checkpoint.** Every scan, hand-off and customs milestone appears on your tracking page as it happens. No chasing, no guesswork.

### 2.3 How it works (4 steps; the connecting line animates, see MOTION §4)
- **Eyebrow:** `HOW IT WORKS`
- **H2:** `How Navora moves your shipment`
- **Intro:** `Four stages, one tracking ID, and full visibility from the first scan to the final signature.`
1. **Book & Label.** Book online or with a coordinator. You get your 8-character Navora tracking ID and a barcode label for every piece straight away.
2. **Collect & Verify.** We collect from your door, weigh and scan every piece at the origin gateway, and prepare the export and customs documents.
3. **Move Across Borders.** Your cargo travels on the fastest suitable lane: air, ocean or road. Customs clearance and each transfer are logged live.
4. **Deliver & Sign.** Final-mile delivery to the door, with a signed digital proof of delivery sent to you the moment it lands.
- **CTA strip under the steps** (reuses §3.6, owner approved 2026-09-28): `Ready to ship with Navora? Get a rate in minutes, or talk to a coordinator about your lane.` · Buttons `Get a Quote` · `Contact Us`

### 2.4 About strip
- **Eyebrow:** `ABOUT Navora`
- **H2:** `We believe global shipping should feel local: visible, fast and dependable.`
- **Body:** `Navora Global Freight was built for shippers who are tired of losing sight of their cargo the moment it leaves the building. We bring express, freight and secure transport under one roof, so one team owns your shipment from pickup to proof of delivery, wherever in the world it's going.`
- **Stat tiles (always three):** **24/7** "Global operations desk" · **1** "Tracking ID from start to finish" · **5** "Continents served" (from §2.7). When `{{YEAR_FOUNDED}}` is confirmed, "Years moving cargo" replaces "Continents served".
- **Photo caption** (reuses §2.1, owner approved 2026-09-28): **Real People, Every Time Zone** · `A named coordinator follows your shipment`
- **Link:** `More about Navora →`

### 2.5 Services (4 image cards)
- **Eyebrow:** `WHAT WE MOVE`
- **H2:** `Specialised transport for cargo that matters`
1. **Priority Express Courier.** Time-critical documents and parcels, door to door, with the fastest available routing and customs pre-clearance where possible. → `Explore Express`
2. **Scheduled Freight & Linehaul.** Air, ocean (FCL and LCL) and road freight on fixed departures, for regular volumes that need predictable transit times. → `Explore Freight`
3. **Vehicle Shipping & Transport.** Cars, motorcycles and fleet vehicles moved by container, RoRo or enclosed carrier, with documentation handled end to end. → `Explore Vehicle Shipping`
4. **Secure Vault & High-Value.** Sealed, tamper-evident transport for valuables, sensitive documents, pharmaceuticals and high-value electronics, with restricted hand-offs. → `Explore Secure Vault`

### 2.6 Industries (4 tabs with image showcase)
- **Eyebrow:** `INDUSTRIES`
- **H2:** `Logistics shaped around your industry`
1. **Automotive & Vehicles.** Spare parts, components and complete vehicles, moved to keep production lines and dealerships running. *Bullets:* Line-side parts express · Vehicle export & import documentation · Enclosed and container shipping.
2. **Healthcare & Life Sciences.** Samples, medical devices and pharmaceuticals handled with care, controlled hand-offs and full traceability. *Bullets:* Temperature-sensitive handling (on request) · Sealed chain of custody · Priority customs lodgement.
3. **E-Commerce & Retail.** Cross-border parcels, stock replenishment and returns for growing online brands. *Bullets:* Multi-piece shipments under one ID · Scheduled consolidations · Simple returns with linked tracking.
4. **Technology & Electronics.** High-value hardware and components moved securely, on time and fully insured on request. *Bullets:* Secure vault option · Anti-static, protected packing guidance · Signature-only release.
- **Button on every tab** (owner approved 2026-09-28): `Get a Rate Quote`

### 2.7 Global network map (replaces "Active U.S. Trade Gateways")
- **Eyebrow:** `GLOBAL NETWORK`
- **H2:** `Connected across the world's key trade lanes`
- **Intro:** `Our gateways link Africa, Europe, the Middle East, Asia and the Americas, so your shipment always has a direct, well-travelled route.`
- **Side stats** (replace the invented numbers): **5** "Continents served" · **Air · Ocean · Road** "Modes connected" · **24/7** "Operations desk". Only show gateway/country counts once confirmed.
- **Legend:** `Gateway` · `Trade lane` · `Live shipment` (demo)
- **CTA:** `View our network →`

### 2.8 Trust matrix (8 tiles)
- **Eyebrow:** `SAFE HANDS`
- **H2:** `Your cargo is safe with us`
1. **Integrity Guarantee.** What you hand us is exactly what arrives: counted, sealed and signed for.
2. **Committed Schedules.** Agreed windows, proactive updates and no silent delays.
3. **Vetted Handlers.** Every driver, agent and handler in our chain is vetted and accountable.
4. **Privacy by Design.** Public tracking masks names and addresses. Your data stays yours.
5. **Compliance First.** Export, import and dangerous-goods rules are respected on every lane. *(Replace "Certified Quality Standards" unless Navora holds a named certification; if it does, name it.)*
6. **Digital Documents.** Waybills, invoices and proof of delivery, available online at any time.
7. **Piece-Level Barcodes.** Every carton carries its own scannable label, linked to one tracking ID.
8. **24/7 Support.** A real coordinator, whatever the hour and wherever you are.

### 2.9 Barcode spotlight
- **Eyebrow:** `SMART LABELS`
- **H2:** `One label. Every checkpoint. Zero guesswork.`
- **Body:** `Every Navora piece carries a high-density Code 128 barcode linked to your tracking ID. Each scan, at collection, at the gateway, through customs and at the door, updates your tracking page instantly.`
- **Replace the invented metrics** with capability tiles: **8-character** "Tracking ID" · **Every piece** "Individually scanned" · **Live** "Milestone updates"
- **Demo label header:** `NAVORA GLOBAL FREIGHT` with the Navora mark (`/brand/mark.png`) on the right
- **Demo label fields:** `ORIGIN: LOS (LAGOS)` · `DESTINATION: LHR (LONDON)` · `WEIGHT: 20.4 KG` · `SERVICE: PRIORITY EXPRESS` · barcode value `NGF7K2M9` · caption `TRACKING ID: NGF7K2M9`

### 2.10 Testimonials → "Our commitments" (until real testimonials exist)
The current testimonials are invented people and companies, so they must not ship. **Option A (default):** replace the carousel with:
- **Eyebrow:** `OUR COMMITMENTS`
- **H2:** `What you can hold us to`
1. **"You'll always know where it is."** Live milestones on every shipment, with no exceptions.
2. **"You'll always reach a person."** A coordinator who knows your shipment, any time zone.
3. **"You'll hear from us first."** If something changes, we tell you before you have to ask.

**Option B:** real testimonials. For each one, collect the quote, name, role, company and written permission, and add them to this file first.

### 2.11 Partners strip → "Modes we connect"
Remove the invented client logos. Replace with an icon row: **Air Freight · Ocean Freight · Road Freight · Express Courier · Customs Brokerage · Secure Transport**. Add real partner logos only with written permission.

### 2.12 Callback banner
- **H3:** `Need an urgent collection or a custom rate?`
- **Body:** `Leave your number and a coordinator will call you back, usually within 30 minutes during business hours.` *("30 minutes" confirmed by the owner 2026-09-28.)*
- **Background:** `callback-banner` (3:1 crop of `images/free-stock/callback-banner.jpg`) under the dark overlay
- **Fields:** Name · Phone (with country code) · Preferred time
- **Button:** `Request a Callback`
- **Success:** **Request received!** `A coordinator will call you shortly. Your reference is NGF-TKT-######.`

### 2.13 FAQ (home, 5 items)
- **Eyebrow / H2** (owner approved 2026-09-28): `COMMON QUESTIONS` · `Frequently Asked Questions`
1. **Do I need an account to track a shipment?** No. Enter your 8-character tracking ID (for example NGF7K2M9) on the Track page and you'll see its status and milestones straight away. Personal details are masked for privacy.
2. **How does live tracking work?** Every piece is scanned at each hand-off: collection, gateway, departure, arrival, customs and delivery. Between scans, we show your shipment's estimated position on its route.
3. **Can I track a multi-piece shipment under one ID?** Yes. All pieces share one tracking ID, and each piece has its own label (for example NGF7K2M9-01, -02), so you can see every carton individually.
4. **Do you handle customs clearance?** Yes. We prepare the export and import documentation with you and manage clearance on your behalf. Duties and taxes are billed as agreed at booking.
5. **Are my documents available online?** Yes. Your waybill, invoice and signed proof of delivery can be viewed and downloaded from your tracking page.

---

## 3. Services page

- **Hero eyebrow:** `OUR SERVICES` · **H1:** `Every mode. Every border. One accountable team.`
- **Sub:** `Choose the speed, security and mode that fit your cargo. We'll handle the route, the paperwork and the hand-offs.`
- **Tier selector heading:** `Choose a service to see how it works`
- **Hero stat pills** (reuse approved stats from §2.7/§2.9): **5** "Continents served" · **Air · Ocean · Road** "Modes connected" · **8-character** "Tracking ID" · **24/7** "Operations desk"
- **Hero image:** `services-hero` (12:5 crop of `images/free-stock/services-hero.jpg`)
- **Section eyebrows** (labels added 2026-09-28, owner to confirm): `SERVICE TIERS` · `COMPARE` · `INDUSTRIES` · `ADD-ONS` · `HOW IT WORKS`
- **Tier panel labels:** `Highlights` · `Service specifications` · buttons `Get a Rate Quote` · `Track a Shipment`

### 3.1 Service tiers (specs marked [confirm] need the owner's sign-off)

**Priority Express Courier**
- *Summary:* Our fastest door-to-door service for urgent documents and parcels, worldwide.
- *Highlights:* Same-day collection when booked before the cut-off · Fastest available air routing · Customs pre-alert and pre-clearance where possible · Signature on delivery
- *Specs:* Weight: up to 70 kg per piece [confirm] · Dimensions: up to 120 × 80 × 80 cm [confirm] · Tracking: every scan, live · Signature: always · Cover: standard liability, with extended cover on request · Ideal for: contracts, samples, spare parts, urgent e-commerce orders

**Scheduled Freight & Linehaul**
- *Summary:* Air, ocean and road freight on fixed departures, built for regular volumes and predictable transit.
- *Highlights:* Air freight consolidations · Ocean FCL and LCL · Cross-border road linehaul · Palletised and oversized cargo
- *Specs:* Weight: from 70 kg to full container/truckload · Dimensions: pallet, container or project cargo · Tracking: milestone updates at every gateway · Signature: at delivery · Cover: standard liability, with cargo insurance on request · Ideal for: stock replenishment, manufacturing inputs, distributor supply

**Vehicle Shipping & Transport**
- *Summary:* International and domestic shipping for cars, motorcycles and fleet vehicles.
- *Highlights:* Container or RoRo shipping · Enclosed carrier option · Export/import documentation · Condition report with photos at collection and delivery
- *Specs:* Vehicles: cars, SUVs, motorcycles, light commercial [confirm] · Tracking: milestone updates plus vessel/carrier status · Signature: condition report sign-off · Cover: marine insurance on request · Ideal for: dealers, exporters, relocations, fleet moves

**Secure Vault & High-Value**
- *Summary:* Sealed, tamper-evident transport with restricted hand-offs for valuables and sensitive cargo.
- *Highlights:* Tamper-evident sealed pouches and cases · Restricted, named hand-offs · Photo and seal-number verification at each stage · ID-checked release
- *Specs:* Weight: up to 30 kg per piece [confirm] · Tracking: every hand-off, with the seal number · Signature: ID-verified, named recipient only · Cover: declared-value cover on request · Ideal for: legal and financial documents, jewellery, pharmaceuticals, prototypes

### 3.2 Comparison table
- **H2:** `Compare speed and capability`
- Rows: Transit speed · Modes · Max weight · Tracking detail · Signature · Best for (use the values from 3.1)
- Values (Transit speed and Modes are derived from the §3.1 wording, **[confirm]**):

| Service | Transit speed | Modes | Max weight | Tracking detail | Signature | Best for |
|---|---|---|---|---|---|---|
| Priority Express Courier | Fastest available routing [confirm] | Air, door to door [confirm] | 70 kg per piece [confirm] | Every scan, live | Always | Contracts, samples, spare parts, urgent e-commerce orders |
| Scheduled Freight & Linehaul | Fixed departures, predictable transit [confirm] | Air · Ocean · Road | Full container/truckload | Milestone updates at every gateway | At delivery | Stock replenishment, manufacturing inputs, distributor supply |
| Vehicle Shipping & Transport | Scheduled vessel or carrier departures [confirm] | Container · RoRo · Enclosed carrier | Cars, SUVs, motorcycles, light commercial [confirm] | Milestones plus vessel/carrier status | Condition report sign-off | Dealers, exporters, relocations, fleet moves |
| Secure Vault & High-Value | Door to door, restricted hand-offs [confirm] | Sealed, door to door [confirm] | 30 kg per piece [confirm] | Every hand-off, with the seal number | ID-verified, named recipient only | Legal and financial documents, jewellery, pharmaceuticals, prototypes |

### 3.3 Industries (4)
- **H2:** `Solutions tailored to your industry`
- **Healthcare & Life Sciences:** Controlled hand-offs, priority customs lodgement and temperature-sensitive handling on request.
- **Technology & Electronics:** Secure vault options, protected packing guidance and signature-only release.
- **Automotive & Fleet:** Parts express to keep lines moving, plus complete vehicle shipping.
- **Commercial & Retail Distribution:** Scheduled consolidations, cross-border e-commerce and linked returns.
- *Bullets per tab:* reuse the §2.6 bullets (Healthcare, Technology, Automotive; Commercial & Retail uses the E-Commerce bullets). Images: the matching `industry-*` photos. Button: `Get a Rate Quote`.

### 3.4 Add-ons
- **H2:** `Extra care when you need it`
1. **Signature Confirmation.** Delivery is released only against a named signature.
2. **Weekend Delivery.** Saturday delivery on selected lanes. *(Replaces "Saturday Priority Delivery"; confirm the lanes.)*
3. **Hold for Collection.** Keep your shipment at the destination gateway for the recipient to collect.
4. **Enclosed Vehicle Care.** Soft-tie securing and enclosed transport for high-value vehicles.

### 3.5 Process strip
- **H3:** `How every shipment moves through Navora`
- Digital Booking & Labels → Gateway Scan → Linehaul & Border Crossing → Signed Proof of Delivery
- *Intro and step text:* reuse §2.3 (intro `Four stages, one tracking ID, and full visibility from the first scan to the final signature.` and the four step bodies, in order).

### 3.6 CTA (also used on About)
- **H2:** `Ready to ship with Navora?`
- **Body:** `Get a rate in minutes, or talk to a coordinator about your lane.`
- **Buttons:** `Get a Quote` · `Contact Us`

---

## 4. About page

- **Hero eyebrow:** `ABOUT Navora` · **H1:** `Moving what matters, with nothing hidden.`
- **Sub:** `Navora Global Freight connects businesses and people to the world with express, freight and secure transport, and with the one thing logistics often forgets: accountability.`

- **Hero image:** `about-hero` (12:5 crop of `images/free-stock/about-hero.jpg`). The credentials row shows only the admin "regulatory line" when it is set.

**Stat cards** (reuse approved stats; no invented figures): **24/7** "Global operations desk" · `Our desk follows the sun across time zones.` — **1** "Tracking ID from start to finish" · `One team accountable from the first mile to the last.` — **5** "Continents served" · `Gateways across Africa, Europe, the Middle East, Asia and the Americas.` — **Air · Ocean · Road** "Modes connected" · `Air, ocean and road, connected.`

**Our approach (5 points)** (shown under the story text, eyebrow `OUR STORY`; photo `about-story` with the caption **24/7 Global operations desk** · `Our desk follows the sun across time zones.`)
1. **Milestone Visibility.** Every scan and hand-off is recorded and visible to you.
2. **Direct Routing.** The fewest possible hand-offs between origin and destination.
3. **Secure Custody.** Seals, scans and named releases for anything of value.
4. **Proactive Support.** We contact you first when plans change.
5. **Round-the-Clock Operations.** Our desk follows the sun across time zones.

**Our divisions:** the four services with their one-line summaries from §3.1. Eyebrow `DIVISIONS` · H2 `Our divisions`; each card lists the first three §3.1 highlights.

**Our story.** **H2:** `How Navora came to be`
`Navora Global Freight started with a simple frustration: once cargo crossed a border, shippers lost sight of it. Calls went unanswered, updates arrived late, and nobody owned the problem. We built Navora to fix that, joining express, freight and secure transport into one network, with one tracking ID and one team accountable from the first mile to the last.`
*(The owner should add real milestones, e.g. year founded, first lanes, first office. Don't invent a timeline.)*

**Timeline cards** (only if the owner provides real dates; otherwise show them as capabilities without years):
- **Express Courier Lines:** where we began, with urgent door-to-door delivery.
- **Cross-Border Freight:** scheduled air, ocean and road departures.
- **Piece-Level Tracking:** every carton barcoded and scanned.
- **Global Gateway Network:** partner gateways across five continents.
- *Section header while undated* (added 2026-09-28, owner to confirm): eyebrow `WHAT WE'VE BUILT` · H2 `Express, freight and secure transport under one roof` (from §2.4). Year badges appear per card only once real dates are supplied.

**Compliance block.** **H3:** `Committed to safety and compliance`
`We follow the export, import, security and dangerous-goods rules on every lane we operate, and we work only with vetted carriers and agents. Ask us for our compliance documents at any time.` *(Name specific licences only if Navora holds them.)*
Eyebrow `SAFETY & COMPLIANCE`. Badge tiles reuse §2.8: **Compliance First** · **Vetted Handlers** · **Privacy by Design** · **Digital Documents** (plus the admin regulatory line when set). Background: `callback-banner` photo under the dark overlay.

**CTA:** as §3.6.

---

## 5. Locations / Network page

- **Hero eyebrow:** `GLOBAL NETWORK` · **H1:** `Wherever it's going, we're already connected.`
- **Sub:** `Our gateways and trade lanes link the world's major markets, so your cargo moves on routes we know well.`
- **Map heading:** `Gateways & scheduled trade lanes`
- **List heading:** `Our gateways`
- **Card fields:** Gateway name · City, Country · Modes (Air / Ocean / Road) · Local time (live) · `Contact this gateway` (→ Contact with the gateway pre-filled)
- **Note under list:** `Don't see your city? We deliver well beyond these gateways. Ask us about your lane.`
- **Gateway list:** see §9.

---

## 6. Track, Track Result, loading, support

### 6.1 Track page
- **H1:** `Track your shipment`
- **Sub:** `Enter your 8-character Navora tracking ID to see where your shipment is right now.`
- **Input placeholder:** `e.g. NGF7K2M9` · **Button:** `Track`
- **Validation:** `Tracking IDs start with NGF and are 8 characters long, e.g. NGF7K2M9.`
- **Not found:** `We couldn't find a shipment with ID {id}. Check the characters and try again, or contact us and we'll look it up for you.`
- **"Where to find your ID" (3 cards):**
  1. **Booking confirmation.** It's in the email or SMS we sent when your shipment was booked.
  2. **Waybill / label.** Printed at the top of your waybill and on every piece label.
  3. **Your coordinator.** Any Navora coordinator can find it from your name, reference or phone number.
- **Multi-track (if kept):** **Track several shipments** · `Enter up to 10 tracking IDs, one per line.`
- **Help banner:** **Need help with an active shipment?** `Our operations desk is available 24/7.` → `Contact Support`

### 6.2 Loading screen
Rotating lines: `Locating your shipment…` · `Checking the latest scans…` · `Plotting the route…`

### 6.3 Track Result: labels
- Status names: **Booked** · **Collected** · **At origin gateway** · **Departed** · **In transit** · **Arrived at destination gateway** · **Customs clearance** · **Out for delivery** · **Delivered** · **On hold** · **Delayed** · **Returning to sender**
- Panels: **Shipment summary** · **Route** · **Journey timeline** · **Pieces** · **Documents** · **Need help?**
- Mode labels on legs: `By air` · `By sea` · `By road`
- Public facility for admin actions: `Navora Operations Centre`
- ETA line: `Estimated delivery: {date}, {window} ({local time zone})`
- Delivered line: `Delivered {date} at {time}. Signed by {masked name}.`

### 6.4 Support modal
- **H3:** `How can we help with this shipment?`
- Fields: Tracking ID (pre-filled) · Issue type (Delay · Address change · Damage · Customs question · Other) · Message · Email
- **Success:** `Ticket NGF-TKT-###### opened for {tracking ID}. We'll reply to {email} shortly.`
- Also a **Name** field (the Messages inbox needs a name to reply to; owner approved 2026-09-29). Submit button: `Open ticket`.

### 6.5 Interface labels (owner approved 2026-09-29)
- Track page tabs: `One ID` · `Track several shipments` · recent searches: `Recently tracked`
- Several-shipments results: `Open tracking` (button) · `Last seen` · `{n} of {m} found`
- Track Result: `Back to tracking` · `Last scan` · `Show scan history` / `Hide scan history`
- Admin quick action (records a scan at a hub; shown publicly as In transit): `Hub scan`
- Older status codes are shown as: Exception → On hold · Delivery attempted → Delayed · At facility (intermediate hub) → In transit · Created / Awaiting pickup → Booked · Cancelled → `Cancelled`

---

## 7. Quote, Ship, Public Quote Result

### 7.1 Quote page
- **H1:** `Get a rate quote`
- **Sub:** `Tell us what you're moving and where. A coordinator will confirm your rate, usually the same business day.`
- **Form sections:** Route (from country/city → to country/city) · Cargo (pieces, weight in kg/lb, dimensions, contents, declared value) · Service (Express / Freight / Vehicle / Secure Vault) · Your details
- **Side card:** **Straight answers, no surprises.** `Your quote includes the service, estimated transit time and every known charge, so the price you accept is the price you pay (duties and taxes as applicable).`
- **Success H2:** `Quote request received`
- **What happens next:** 1. A coordinator reviews your lane and cargo. 2. You receive your rate by email with a secure quote link. 3. Accept it online and we'll book your collection.

### 7.2 Public Quote Result
- **H1:** `Your Navora quote` · Labels: Quote reference · Valid until · Route · Service · Estimated transit · Charges breakdown · Total
- Footer line: `{{DOMAIN}} · Secure quote link`
- Buttons: `Accept & Book` · `Download PDF` · `Ask a question`

### 7.3 Ship page
- **H1:** `Book a shipment`
- Steps: **1. Sender & collection** · **2. Recipient & delivery** · **3. Pieces** · **4. Service & extras** · **Summary**
- **Success H2:** `Shipment booked`. Body: `Your tracking ID is {ID}. Labels for each piece are ready to print.`
- **Next steps:** Print and attach a label to each piece · Have the shipment ready at the collection time · Track progress any time with your ID
- **How booking works:** Booking → Gateway scan → Linehaul & border crossing → Proof of delivery

### 7.4 Interface labels (added 2026-09-29 with 3.6/3.7, **owner to confirm**)
Reused where possible: service names and summaries (§3.1), add-ons (§3.4), stage bodies (§2.3, as on Services §3.5), the §7.1 side card as the quote's terms.
- **Quote form:** sections `1. Route` (`From` / `To`) · `2. Cargo` · `3. Service` · `4. Your details`; fields `Pieces` · `Weight` · `Declared value` · `Dimensions` · `Contents` · `Service` · `Transport mode` · `Special instructions` · `Name` · `Company` · `Email` · `Phone`; submit `Request a Quote` (§8.1 quick link).
- **Quote success:** `Quote reference {ref}` · `What happens next` · buttons `View your quote` · `Request another quote`.
- **Quote Result:** status names `In review` · `Ready` · `Accepted` · `Booked` · `Declined` · `Expired`; while in review: `Quote request received` + the §7.1 next steps; charge lines `Transport ({route})` · `Oversize handling` · `Special handling` (only lines the coordinator filled in); after accepting: `Quote accepted` · `We'll book your collection.` (from §7.1 step 3) or `Tracking ID {ID}` once booked; `Copy reference`; side cards `Your details` · `24/7 Operations Desk`. "Download PDF" opens the browser's print dialog (Save as PDF).
- **Ship page:** collection choice `Book a Collection` (§8.1) · `Drop-off at a Navora gateway` · `Collection time`; field labels `Sender name` · `Recipient name` · `Phone` · `Street address` · `Company` · `Delivery instructions` · `Contents`; buttons `Continue` · `Back` · `Add a piece` · `Book shipment` · `Print labels` · `Copy tracking ID` · `Book another shipment`.
- **Ship summary note:** `Your coordinator confirms the rate before collection.`

---

## 8. Help Centre and Contact

### 8.1 Help: hero and quick links
- **H1:** `How can we help?` · Search placeholder: `Search for answers, e.g. customs, delivery time, documents`
- Quick links: **Track a Shipment** · **Book a Collection** · **Request a Quote** · **24/7 Operations Desk**
- Empty search: **No matching answers.** `Try different words, or contact us and we'll answer directly.`
- Footer banner: **Still need help with a shipment?** → `Contact Support`

### 8.2 Help: knowledge base (heading `Answers to common questions`)
**Tracking**
- *Where do I find my tracking ID?* On your booking confirmation, at the top of your waybill and on every piece label. It's 8 characters and starts with NGF (e.g. NGF7K2M9).
- *Why hasn't my tracking updated?* Updates appear at each scan. On long air or ocean legs there can be several hours between scans. The estimated position keeps moving in the meantime.
- *How do multi-piece shipments work?* All pieces share one tracking ID. Each piece has its own label ending in -01, -02 and so on.

**Booking & collection**
- *What's the cut-off for same-day collection?* It depends on your city and service. Your coordinator confirms it at booking. [confirm the standard cut-off]
- *How should I pack my shipment?* Use a strong outer box, cushion every item and seal all seams. For high-value items, ask for our Secure Vault packaging.
- *Can I change the delivery address?* Yes, before the shipment reaches the destination gateway. Contact us with your tracking ID.

**Customs & international**
- *Who pays duties and taxes?* That's agreed at booking: either the sender (duties paid) or the recipient (duties unpaid).
- *What documents do I need?* Usually a commercial invoice and, for some goods, permits or certificates. We'll tell you exactly what your lane needs.
- *What can't I ship?* Prohibited and restricted items vary by country. See our Shipping Terms, or ask us before you book.

**Documents & delivery**
- *Where's my proof of delivery?* On your tracking page as soon as the shipment is delivered, available to download as a PDF.
- *What if my shipment is damaged?* Tell us within 7 days of delivery, with photos [confirm the period]. We'll open a claim and keep you updated.

### 8.3 Contact page
- **H1:** `Talk to Navora`
- **Sub:** `Questions, quotes or a shipment that needs attention: a real coordinator will get back to you.`
- **Channels:** Email `{{EMAIL}}` · Phone `{{PHONE}}` · WhatsApp `{{WHATSAPP}}` · Head office `{{HQ_ADDRESS}}` (hide any that are empty)
- **Form title:** `Send us a message`. Fields: Name · Email · Phone (optional) · Topic (Quote · Active shipment · Billing · Partnership · Other) · Tracking ID (optional) · Message
- **Success:** **Message received.** `Your reference is NGF-TKT-######. We'll reply to {email} as soon as possible.`
- **24/7 card:** **24/7 Operations Desk.** `For active shipments, include your tracking ID for the fastest help.` (Say "Average response under 30 minutes" only if confirmed.)
- **FAQ block heading:** `Quick answers` (reuse 3–4 items from §8.2)

### 8.4 Interface labels (added 2026-09-29 with 3.9/3.10, **owner to confirm**)
- **Help:** category filter `All topics ({n})` + the four §8.2 group names; empty-search button `Clear search`; `Call {{PHONE}}` next to `Contact Support` (only when a phone is set).
- **Contact:** Topic placeholder `Choose a topic`; the existing optional **Gateway** field (pre-filled by "Contact this gateway" on Locations) is kept; submit `Send message`; success buttons `Send another message` · `Track a Shipment`. Quick answers shown: where to find the tracking ID, changing the delivery address, duties and taxes, damaged shipments.

---

## 9. Global gateway list (owner to confirm or edit before Phase 2)

Presented as "gateways we serve". Don't describe them as Navora-owned facilities unless they are.

| Code | Gateway | Country | ISO | Lat | Lng | Time zone | Modes |
|---|---|---|---|---|---|---|---|
| LOS | Lagos | Nigeria | NG | 6.5774 | 3.3212 | Africa/Lagos | Air · Ocean · Road |
| ACC | Accra | Ghana | GH | 5.6052 | -0.1668 | Africa/Accra | Air · Road |
| NBO | Nairobi | Kenya | KE | -1.3192 | 36.9278 | Africa/Nairobi | Air · Road |
| JNB | Johannesburg | South Africa | ZA | -26.1392 | 28.2460 | Africa/Johannesburg | Air · Road |
| LHR | London | United Kingdom | GB | 51.4700 | -0.4543 | Europe/London | Air · Road |
| RTM | Rotterdam | Netherlands | NL | 51.9496 | 4.1453 | Europe/Amsterdam | Ocean · Road |
| FRA | Frankfurt | Germany | DE | 50.0379 | 8.5622 | Europe/Berlin | Air · Road |
| DXB | Dubai | United Arab Emirates | AE | 25.2532 | 55.3657 | Asia/Dubai | Air · Ocean |
| BOM | Mumbai | India | IN | 19.0896 | 72.8656 | Asia/Kolkata | Air · Ocean |
| SIN | Singapore | Singapore | SG | 1.3644 | 103.9915 | Asia/Singapore | Air · Ocean |
| HKG | Hong Kong | Hong Kong SAR | HK | 22.3080 | 113.9185 | Asia/Hong_Kong | Air · Ocean |
| PVG | Shanghai | China | CN | 31.1443 | 121.8083 | Asia/Shanghai | Air · Ocean |
| JFK | New York | United States | US | 40.6413 | -73.7781 | America/New_York | Air · Road |
| IAH | Houston | United States | US | 29.9902 | -95.3368 | America/Chicago | Air · Ocean · Road |
| LAX | Los Angeles | United States | US | 33.9416 | -118.4085 | America/Los_Angeles | Air · Ocean · Road |
| YYZ | Toronto | Canada | CA | 43.6777 | -79.6248 | America/Toronto | Air · Road |
| GRU | São Paulo | Brazil | BR | -23.4356 | -46.4731 | America/Sao_Paulo | Air · Ocean |
| SYD | Sydney | Australia | AU | -33.9399 | 151.1753 | Australia/Sydney | Air · Ocean |

**Hero-globe trade lanes (arcs):** LOS–LHR, LOS–DXB, LOS–JFK, LHR–JFK, DXB–SIN, SIN–SYD, PVG–RTM, HKG–LAX, FRA–DXB, JNB–DXB, NBO–LHR, GRU–JFK, IAH–RTM, YYZ–LHR, BOM–DXB.

---

## 10. Admin console strings
- Login: **Navora Operations Console** · `Sign in to manage shipments, tracking and documents.` · Button `Sign in` · Error `Incorrect password. Please try again.`
- Sidebar brand: logo + `Operations Console`
- Role label: `Administrator` (replaces "Super Admin" in the UI)
- Default intake sender: `Navora Intake Desk`
- Settings defaults: company `Navora Global Freight`, email `{{EMAIL}}`, phone `{{PHONE}}`, address `{{HQ_ADDRESS}}`, currency `USD` (editable)
- *Added 2026-09-29 with 3.13 (owner to confirm):* login field placeholder `Password`, busy state `Signing in…`; the operator card and profile menu show `Administrator` · `Operations Console` (replacing "Terminal Dispatcher #01" / "Root Dispatch"); menu links `Settings` · `Document Center`.

## 11. Generated documents (waybill, BOL, invoice, POD, seal label)
- Header: logo + `Navora Global Freight` + `{{HQ_ADDRESS}} · {{EMAIL}} · {{DOMAIN}}`
- Title labels: `Air Waybill / House Waybill` (air), `Bill of Lading` (ocean/road), `Commercial Invoice`, `Proof of Delivery`, `Security Seal Record`
- ID line: `Tracking ID / Waybill No.: NGF7K2M9`
- Pouch line: `Navora Tamper-Evident Document Pouch · Seal No. NGF-SL-######`
- Footer: `This document was generated by Navora Global Freight. Carriage is subject to Navora's Shipping Terms at {{DOMAIN}}/#/legal.`
- *Added 2026-09-29 with 3.12 (owner to confirm):* the Document Center also produces three types not named above, titled `Shipping Label`, `Shipment Receipt` and `Certificate of Cargo Insurance`. Charge lines: `Transport` · `Oversize handling` · `Special handling`, totals `TOTAL DUE` / `TOTAL PAID`. Insurance certificate text: `The cargo described below is insured by {insurer} under policy {policy no.}, subject to that policy's terms, conditions and exclusions.` and claims line `Tell Navora about any loss or damage within 7 days of delivery, quoting the tracking ID above, with photos and proof of value.` (7 days: same [confirm] as Help §8.2). **Proof of Delivery** and **Security Seal Record** have no document type yet (see tracker Blocked).

## 12. Image alt text
Approved 2026-09-26; photos replaced with free stock 2026-10-02 (sources and photographers in `images/free-stock/SOURCES.md`). Files are generated into `Public/images/site/` by `scripts/optimize-images.mjs`.
No photo shows the Navora name or any other company's branding, so the alt text describes only what is in the picture. Each page uses its own photos (Track Result reuses the Track header photo on purpose).

| Image (slot) | Source | Alt |
|---|---|---|
| hero-home / hero-home-mobile | images/free-stock/hero-home.jpg, hero-home-mobile.jpg | Container cranes silhouetted against the setting sun at a seaport |
| callback-banner | images/free-stock/callback-banner.jpg (3:1 crop) | (decorative background behind the Home callback form, empty alt) |
| services-hero | images/free-stock/services-hero.jpg (12:5) | Aircraft silhouetted against an orange sunset sky after take-off |
| about-hero | images/free-stock/about-hero.jpg (12:5) | Dock worker with a radio watching a cargo ship being loaded at sunset |
| about-story | images/free-stock/about-story.jpg | Operations coordinator checking a clipboard between storage racks |
| about-compliance | images/free-stock/about-compliance.jpg (3:1 crop) | (decorative background behind the About compliance banner, empty alt) |
| track-hero | images/free-stock/track-hero.jpg (2:1 crop) | Lorry with its headlights on, driving a mountain road at dusk |
| locations-hero | images/free-stock/locations-hero.jpg | Aerial view of a container ship berthed at a lit port terminal at night |
| service-priority-express | images/free-stock/service-priority-express.jpg | View from an aircraft cargo door down the loader to the airport apron |
| service-freight-linehaul | images/free-stock/service-freight-linehaul.jpg | Aerial night view of a container ship being loaded by gantry cranes |
| service-vehicle-transport | images/free-cc0/service-vehicle-transport.webp | Roll-on/roll-off vehicle carrier ship berthed at a harbour quay |
| service-secure-vault | images/free-cc0/service-secure-vault.webp | Close-up of the combination lock on a metal security case |
| industry-healthcare | images/free-stock/industry-healthcare.jpg | Gloved hands holding a sealed vaccine shipment box |
| industry-technology | images/free-cc0/industry-technology.webp | Server rack with network cables and status lights |
| industry-automotive | images/free-stock/industry-automotive.jpg | Aerial view of rows of new cars waiting for shipment |
| industry-ecommerce | images/free-stock/industry-ecommerce.jpg | Parcels stacked inside a delivery van |
| track-result-vehicle | images/free-stock/track-result-vehicle.jpg | Lorry travelling along a highway beneath mountains at dusk |
| about-operations | images/free-pexels/about-operations.jpg (Home only) | Warehouse staff member checking stock on a tablet between loaded pallet racks |
| about-team | images/free-pexels/about-team.jpg (cropped) | Smiling support coordinator wearing a headset |
| contact-team | images/free-stock/contact-team.jpg | Smiling warehouse team member holding a clipboard beside parcel shelves (slot kept; not placed on a page yet) |
| ship-hero | images/free-stock/ship-hero.jpg (CSS background, `ShipPage.css`) | (decorative background behind the Ship hero text) |
| quote-result-hero | images/free-stock/quote-result-hero.jpg (CSS background, `PublicQuoteResultPage.css`) | (decorative background behind the quote result header) |
| og-image | images/Nov-logo.png (white logo on Ink) | (social preview, no alt needed) |

`hero-globe-fallback` is produced in Prompt 24 from the 3D globe.

## 13. Legal pages: structure (plain-language draft; **lawyer review required before launch**)
Tabs: **Privacy Policy · Terms of Service · Shipping Terms · Cookie Policy · Accessibility**

- **Privacy Policy:** who we are ({{LEGAL_NAME}}, {{HQ_ADDRESS}}, {{EMAIL}}) · what we collect (sender/recipient details, shipment data, contact messages, basic analytics) · why (to carry shipments, customs, support, legal duties) · public tracking masks names and addresses · who we share with (carriers, agents, customs authorities, only as needed) · international transfers · how long we keep it · your rights (access, correction, deletion, objection) under applicable law, e.g. Nigeria's NDPA 2023, UK/EU GDPR · contact for privacy requests.
- **Terms of Service:** acceptance · use of the website and tracking · accounts and quotes · payment and invoicing · limitation of liability · governing law: {{JURISDICTION}}.
- **Shipping Terms:** booking and acceptance of goods · prohibited and restricted items · packaging responsibilities · dimensional weight (kg: L×W×H cm ÷ 5000 [confirm the divisor]) · surcharges (fuel, remote area, customs) · duties and taxes · delivery and proof of delivery · liability limits and declared value · claims (notification window, documents required) · return to sender.
- **Cookie Policy:** essential cookies only (admin session). Add analytics disclosure if analytics are added.
- **Accessibility:** commitment to WCAG 2.2 AA · reduced-motion support · how to report a barrier ({{EMAIL}}).

### 13.1 Draft text (added 2026-09-29 with 3.11, **lawyer review required**)
The text below is rendered from `src/data/legalDocs.ts`; change both together. Page H1: `Legal`. Each tab shows `Last updated: 29 September 2026`. The Head-office sentence is left out while {{HQ_ADDRESS}} is empty. {{JURISDICTION}} is not shown: the governing-law clause names "the country in which Navora Global Freight is registered" until it is confirmed (TODO in the code). Differences from the outline above: no analytics are installed, so Privacy and Cookies say so; Cookies also lists the browser-storage keys and the third-party services the pages load.

**Privacy Policy**
1. *Who we are.*
   Navora Global Freight ("Navora", "we") runs this website and carries the shipments booked through it. Our head office is at {{HQ_ADDRESS}}. For anything about your personal data, write to {{EMAIL}}.
2. *What we collect.*
   - Sender and recipient details you give us when you book or ask for a quote: names, company, phone numbers, email and delivery addresses.
   - Shipment data: contents, weights, sizes, declared value, and the scans and events recorded as the shipment moves.
   - Messages you send us through the contact, callback and support forms.
   - Basic technical data: when your browser loads our pages, maps and fonts, the servers involved receive your IP address. We do not use analytics or advertising tools.
3. *Why we use it.*
   - To collect, carry and deliver your shipments.
   - To prepare customs and shipping documents.
   - To answer your questions, handle claims and keep you updated.
   - To meet our legal, tax and customs duties.
4. *Public tracking.*
   Anyone with a tracking ID can follow a shipment. The public tracking page shows only the city and country for each end of the journey, and masks names, phone numbers and email addresses.
5. *Who we share it with.*
   We share only what each party needs to move your shipment: carriers, agents and handlers on the route, and customs and other authorities. We do not sell personal data.
6. *International transfers.*
   Because we move goods across borders, shipment details travel with them to the countries on the route. We share only what carriage and customs require.
7. *How long we keep it.*
   We keep personal data only as long as we need it for the purposes above, including the periods set by tax, customs and transport record-keeping rules.
8. *Your rights.*
   Depending on where you live (for example under Nigeria's Data Protection Act 2023, or the UK or EU GDPR), you can ask to see the personal data we hold about you, correct it, delete it, or object to how we use it. You can also complain to your data protection authority.
9. *Privacy requests.*
   Email {{EMAIL}} with your request and, if it concerns a shipment, its tracking ID. We may ask you to confirm your identity before we act on it.

**Terms of Service**
1. *Accepting these terms.*
   By using this website you agree to these terms. When you book a shipment, our Shipping Terms also apply.
2. *Using the website and tracking.*
   You can use this website to ask for quotes, book shipments and track them. Please don't misuse it: no automated collection of tracking data, and no attempts to reach other people's shipments or our internal systems.
   Tracking updates depend on scans along the route and can be delayed. They are for information and are not a guarantee of delivery times.
3. *Quotes and bookings.*
   A quote is valid until the date shown on it and covers the shipment you described. If the shipment turns out different (for example heavier, larger or with other contents), the price may change. A booking is confirmed when you receive a tracking ID.
4. *Payment and invoicing.*
   We invoice each shipment, or as agreed with you in writing. Payment is due as stated on the invoice. Duties, taxes and charges set by authorities are extra unless your quote says otherwise.
5. *Limitation of liability.*
   As far as the law allows, we are not liable for indirect or consequential losses arising from your use of this website. Our liability for shipments is set out in the Shipping Terms.
6. *Changes to these terms.*
   We may update these terms. The date at the top of this page shows the current version.
7. *Governing law.*
   These terms are governed by the laws of the country in which Navora Global Freight is registered. Nothing in them takes away rights you have under the consumer law of the country where you live.

**Shipping Terms**
1. *Booking and acceptance.*
   We accept a shipment when we collect it, or you hand it to us, and it has a tracking ID. We may inspect, refuse or hold any shipment that does not meet these terms or the law.
2. *Prohibited and restricted items.*
   You must not send anything that is illegal in the origin, transit or destination country. Items such as dangerous goods, cash, weapons, live animals and perishables are either prohibited or need our agreement before booking. Rules vary by country, so ask us before you book.
3. *Packaging.*
   You are responsible for packing your shipment to withstand normal handling: use a strong outer box, cushion every item and seal all seams. For high-value items, ask for our Secure Vault packaging.
4. *Chargeable weight.*
   We charge on the greater of the actual weight and the dimensional weight. Dimensional weight in kg = length × width × height in cm ÷ 5000.
5. *Surcharges.*
   Fuel, remote-area and customs-related surcharges may apply. Every known surcharge is shown on your quote.
6. *Duties and taxes.*
   Who pays duties and taxes is agreed at booking: either the sender (duties paid) or the recipient (duties unpaid).
7. *Delivery and proof of delivery.*
   We deliver to the address on the booking. The delivery time and the name of the person who signed are recorded against your tracking ID as proof of delivery.
8. *Liability and declared value.*
   Our liability for loss or damage is limited. Unless you declare a value and take extended cover when you book, compensation is limited to the standard liability for your service and route, as confirmed at booking. We are not liable for delays or for indirect losses.
9. *Claims.*
   Tell us within 7 days of delivery. Include your tracking ID, a description of the problem, photos of the goods and the packaging, and proof of value (for example the commercial invoice). We will open a claim and keep you updated.
10. *Return to sender.*
   If a shipment cannot be delivered or cleared through customs, we contact the sender. It may be returned at the sender's cost; a return gets its own tracking ID.

**Cookie Policy**
1. *Cookies we use.*
   We use one essential cookie, ngf.sid. It keeps Navora staff signed in to our operations console for up to 12 hours. It is not set for visitors to the public website.
   We do not use analytics or advertising cookies. If we add analytics, we will update this page and ask for your consent where the law requires it.
2. *Choices saved in your browser.*
   Some pages remember a few choices in your browser's local storage. This data stays on your device and is not sent to us:
   - ngf_recent_tracking: tracking IDs you looked up recently, so you can open them again.
   - ngf_units: whether you prefer metric or imperial units.
   - ngf_live_shipment_stream: the latest update for a shipment you are viewing, so other open tabs stay in step.
   You can clear these at any time in your browser settings.
3. *Other services our pages use.*
   Our pages load map tiles from Esri (ArcGIS), fonts from Google Fonts and some photos from Unsplash, and use OpenStreetMap Nominatim and OSRM to look up addresses and routes. These services receive your IP address when your browser contacts them.

**Accessibility**
1. *Our commitment.*
   We want everyone to be able to track, book and contact us. We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA across this website.
2. *What we do.*
   - Forms, buttons and menus work with a keyboard, and form fields have labels.
   - Images have text alternatives, and text is sized and coloured to stay readable.
   - Animated maps respect your device's reduced-motion setting.
   - Tracking pages give the route and every scan as text, not only on the map.
3. *Report a barrier.*
   If something on this website is hard to use, email {{EMAIL}}. Tell us the page and what happened, and we will help you get what you need another way while we fix it.

Still **[confirm]** (shown as written): the dimensional-weight divisor 5000 (Shipping Terms 4) and the 7-day claims window (Shipping Terms 9, same as Help §8.2).

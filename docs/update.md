# Update: Package Images, Payment Methods & Proof of Payment

> Tracker for this one update. It follows the same rules as `docs/PROJECT_TRACKER.md` and `CLAUDE.md`:
> modify the existing system in place, one task → one small commit, `npm run build` must pass with zero
> TypeScript errors after every task, and tracking, admin login, shipment creation, documents, quotes and the
> database must keep working.

**Status legend:** `[ ]` to do · `[~]` in progress · `[x]` done · `[!]` blocked (see Needs owner)

---

## 1. What this update delivers

1. **Package images with captions.** The admin uploads one or more photos for a shipment and names each one
   (e.g. "iPhone 15 – sealed at origin"). Customers see them on the track page.
2. **Payment methods (per shipment, D-9).** There is **no fixed account list**. While creating a shipment (before
   the tracking ID exists) the courier can add **one payment request**: amount, reason, and the payment accounts
   for *this* shipment (PayPal, Bitcoin, Zelle, bank transfer…), typing each account's details. All of it can be
   edited or deleted later from the shipment. **Only the accounts on that shipment** appear on its track page,
   each with its icon and exact details.
3. **Proof of payment.** On the track page the customer uploads a screenshot (images only) and an optional
   reference number. The admin reviews it and approves or rejects it. The admin is notified **on the
   dashboard**: a badge, plus a "New payment proofs" panel showing the screenshot.

### Example flow
> Courier fills in the Create Shipment form, including the payment step ($120.00 USD, "Customs duty – Invoice
> NGF-INV-104233", a **PayPal** account and a **Bitcoin** wallet typed in for this shipment) → submits → the
> shipment gets `NGF7K2M9` and its payment request is saved with it → uploads a photo captioned "iPhone 15".
> The customer tracks `NGF7K2M9` and sees the photo, the amount, the reason, and **only** the PayPal and
> Bitcoin cards → pays → uploads a screenshot + reference → status shows "Proof under review" → admin approves
> → status shows "Paid". At any point the courier can edit the accounts or amount, or delete the request.

---

## 2. Owner decisions (agreed)

| # | Question | Decision |
|---|---|---|
| 1 | What is the "name" on an image? | A **caption per image** |
| 2 | Which payment methods? | PayPal, Bitcoin and the common US/UK methods (list in §4) |
| 3 | Payment requests per shipment | **One** per shipment |
| 4 | Who sees payment details? | **Anyone with the tracking ID**, but only the accounts on that shipment's request |
| 4b | Where do the account details come from? | **Typed per shipment** by the courier (no fixed account list), at creation or later; full create/edit/delete (D-9) |
| 5 | Proof file types | **Images only** (JPG, PNG, WebP, HEIC converted in the browser) |
| 6 | New-proof notification | **Admin dashboard only** (badge + panel with the screenshot), no email |
| 7 | Tracker | This file |

---

## 3. Design rules for this update

- **Payment accounts are never stored in `settings.general`.** `GET /api/settings` is public, so storing them
  there would expose every account. They are stored **on the shipment's payment request** (`shipment_payments`),
  written only through admin routes. The public track endpoint returns only that shipment's accounts.
- **The public booking endpoint never accepts payment data.** `POST /api/shipments` is public (the Ship page uses
  it), so the Create Shipment form saves the payment request through the admin-only payment route right after
  the server assigns the tracking ID.
- **Image files are not stored in SQLite.** Files go to a new **`UPLOADS_DIR`** folder that, like `DB_PATH`,
  sits **outside the deploy folder** on Hostinger. Otherwise every GitHub redeploy deletes them.
- **Images are compressed in the browser before upload:** longest side ≤ 1600px, converted to WebP, about
  200–400 KB. Redrawing on a canvas also **strips EXIF data, including GPS location**. No native image library
  is needed (sharp is unreliable on shared hosting). This keeps the existing base64-in-JSON upload pattern.
- **The server checks every upload by its content** (magic bytes), not by file name, with a size cap of about 2 MB after compression.
- **Package images are public** only when marked visible, served from `/media/<random-id>.webp`.
- **Payment proofs are private.** They're served only through an admin-authenticated route, because
  screenshots show names and account numbers.
- **Every payment request needs a charge reason.** The customer always sees *what* they are paying for, never a
  bare "Additional Fee Applied". The request can link to an existing `NGF-INV-` invoice; approving the payment
  then marks that invoice PAID (existing logic in `server/routes/documents.ts`).
- **One shared definition** of the method types (`src/shared/paymentMethods.ts`), used by both server and client:
  type → label, icon, fields, validation. Adding a method later means adding one entry.
- Copy for the new public sections goes into `docs/CONTENT.md` **before** it is used.
- No demo data: no sample shipments, payment accounts or proofs are seeded.

---

## 4. Payment method types (initial list)

| # | Type | Fields the admin fills in | Customer sees |
|---|---|---|---|
| 1 | PayPal | PayPal email **or** paypal.me link, account name | Copy email / "Open PayPal" button + QR |
| 2 | Bitcoin (BTC) | Wallet address, network (Bitcoin / Lightning) | Address + copy + QR |
| 3 | USDT (Tether) | Wallet address, **network** (TRC20 / ERC20 / BEP20…) | Address + network warning + copy + QR |
| 4 | Ethereum (ETH) | Wallet address, network | Address + copy + QR |
| 5 | Zelle | Email or US phone, recipient name | Copy fields |
| 6 | Cash App | $Cashtag, name | Copy + "Open Cash App" link |
| 7 | Venmo | @username, name | Copy + link |
| 8 | Apple Pay / Apple Cash | Phone or email, name | Copy fields |
| 9 | Google Pay | Phone or email, name | Copy fields |
| 10 | US bank transfer (ACH / wire) | Account name, bank, routing number, account number, account type, bank address | Copy fields |
| 11 | UK bank transfer (Faster Payments) | Account name, bank, sort code, account number | Copy fields |
| 12 | International wire (SWIFT / IBAN) | Beneficiary, bank, IBAN / account, SWIFT/BIC, bank address, country | Copy fields |
| 13 | Wise | Email or Wisetag, name | Copy fields |
| 14 | Revolut | @Revtag or phone, name | Copy fields |
| 15 | Card payment link | Checkout URL (Stripe, Square, etc.) | "Pay by card" button + QR |
| 16 | Western Union | Receiver full name, country, city | Copy fields + "send MTCN as reference" note |
| 17 | MoneyGram | Receiver full name, country, city | Copy fields + reference note |

Every method also has: display label (optional override), **instructions** (free text, optional),
**enabled** on/off and sort order. The admin can store **several accounts of the same type** (e.g. two bank accounts).

**Gift cards are not included.** See Decisions log D-1.

### Icon sources (C.2)
All brand marks come from **Simple Icons 16.34.0** (`https://cdn.jsdelivr.net/npm/simple-icons@16.34.0/icons/<slug>.svg`),
downloaded 2026-10-10 into `src/assets/payment-icons/`. Simple Icons is released under **CC0 1.0**; none of these
icons carries a separate licence in its data file. The marks remain **trademarks of their owners**: they are used
only to identify the payment method, next to its name, unmodified except for colour. `index.ts` there is generated
by `scripts/payment-icons.mjs`; `scripts/paymentIcons.test.ts` fails if it drifts from the SVGs.

| Icon (slug) | Used for | Colour used | Brand guidelines (from Simple Icons data) |
|---|---|---|---|
| `paypal` | PayPal | #002991 | https://newsroom.paypal-corp.com/media-resources |
| `bitcoin` | Bitcoin (BTC) | #F7931A | none listed |
| `tether` | USDT (Tether) | #50AF95 | https://tether.to/branding/ |
| `ethereum` | Ethereum (ETH) | #3C3C3D | none listed |
| `zelle` | Zelle | #6D1ED4 | none listed |
| `cashapp` | Cash App | #00C244 | none listed |
| `venmo` | Venmo | #008CFF | https://venmo.com/about/brand |
| `applepay` | Apple Pay / Apple Cash | #000000 | none listed |
| `googlepay` | Google Pay | #4285F4 | none listed |
| `wise` | Wise | #163300 (Wise Forest Green; the listed #9FE870 is too light on white) | https://wise.design/foundations/logo |
| `revolut` | Revolut | #191C1F | none listed |
| `stripe` | bundled, not used by default (a card link may be Square etc.) | #635BFF | none listed |
| `westernunion` | Western Union | #1A1A1A (the listed #FFDD00 is too light on white) | none listed |
| `moneygram` | MoneyGram | #DA291C | none listed |

Generic types use lucide: `Landmark` (US and UK bank), `Globe` (international wire), `CreditCard` (card payment
link), `Wallet` (any unknown type).

### Icons
- Brand marks (PayPal, Bitcoin, Tether, Ethereum, Zelle, Cash App, Venmo, Apple Pay, Google Pay, Wise,
  Revolut, Stripe, Western Union, MoneyGram) are bundled **locally** as SVGs from Simple Icons (CC0), one small
  file each, with no requests to other sites. Check each one exists and its licence at build time.
- Where a brand mark isn't available, and for the generic types, use lucide: `Landmark` (bank),
  `Globe` (international wire), `CreditCard` (card link), `Wallet` (fallback).
- Icons are decorative (`aria-hidden`). The method name is always shown as text next to them.

---

## 5. Data model (new tables, existing ones not renamed)

```sql
shipment_images (
  id TEXT PRIMARY KEY,           -- random, also the public file name
  tracking_number TEXT NOT NULL,
  caption TEXT NOT NULL,          -- e.g. "iPhone 15"
  file_name TEXT NOT NULL,        -- stored under UPLOADS_DIR/images/
  width INTEGER, height INTEGER, size_bytes INTEGER,
  is_public INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
)

-- (No shared payment_methods table: accounts are typed per shipment, D-9.)

shipment_payments (               -- ONE per shipment; all of it admin-written
  id TEXT PRIMARY KEY,
  tracking_number TEXT NOT NULL UNIQUE,
  amount REAL NOT NULL,
  currency TEXT NOT NULL,         -- ISO 4217; USD only for now (D-7)
  charge_reason TEXT NOT NULL,    -- required, shown to the customer
  due_date TEXT,
  methods_json TEXT NOT NULL,     -- this shipment's accounts, in display order:
                                  --   [{ id, type, label, details, instructions }]
                                  --   type = key from src/shared/paymentMethods.ts; details validated by it
  invoice_document_id TEXT,       -- optional link to documents.id
  status TEXT NOT NULL,           -- AWAITING_PAYMENT | UNDER_REVIEW | PAID | CANCELLED
  customer_note TEXT,             -- optional extra line on the track page
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL, paid_at TEXT
)

payment_proofs (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL,
  tracking_number TEXT NOT NULL,
  method_id TEXT,                 -- id of the account (inside methods_json) the customer says they used
  method_snapshot_json TEXT,      -- type/label/details at submission (accounts can be edited or deleted later)
  payer_name TEXT NOT NULL,
  amount_sent REAL,
  reference TEXT,                 -- transaction ID / MTCN / tx hash (optional)
  file_name TEXT NOT NULL,        -- stored under UPLOADS_DIR/proofs/ (private)
  status TEXT NOT NULL,           -- SUBMITTED | APPROVED | REJECTED
  admin_note TEXT,                -- rejection reason shown to the customer
  created_at TEXT NOT NULL, reviewed_at TEXT
)
```

**Deleting a shipment:** images, payment and proofs follow the existing trash/restore behaviour. Files are only
removed from disk when the shipment is permanently deleted.

---

## 6. API (planned)

| Method & path | Auth | Purpose |
|---|---|---|
| `GET/POST /api/shipments/:id/images` | admin | list / upload (base64 WebP + caption) |
| `PATCH/DELETE /api/shipments/:id/images/:imageId` | admin | caption, visibility / delete |
| `PUT /api/shipments/:id/images/order` | admin | reorder: `{ ids: [...] }` in the new order (one call instead of a PATCH per image) |
| `GET /api/shipments/:id/images/:imageId/file` | admin | the image itself, visible or hidden, for console previews (`no-store`) |
| `GET /media/:imageId.<ext>` | public | serve a **public** package image (404 otherwise), long cache. Usually `.webp`; `.jpg` when the browser could not encode WebP. The track response gives the full URL. |
| `POST /api/shipments/:id/payment/status` | admin | `action`: `cancel` / `mark_paid` / `reopen`. AWAITING/UNDER_REVIEW → CANCELLED or PAID (sets `paid_at`, linked invoice PAID); PAID/CANCELLED → AWAITING_PAYMENT (invoice back to PENDING if it was paid). 409 for any other transition. |
| `GET/PUT/DELETE /api/shipments/:id/payment` | admin | the shipment's single payment request **including its accounts** (create/replace with PUT, remove with DELETE). Each account is validated by the shared registry. Called by Create Shipment right after the tracking ID is assigned, and by Edit Shipment. |
| `GET /api/track/:id` | public | **extended:** adds `images[]` (public only) and `payment` (amount, reason, status, **only this shipment's accounts**, latest proof status / rejection reason) |
| `POST /api/track/:id/payment-proof` | public, rate-limited | submit proof (only while status is AWAITING_PAYMENT; max 3 open proofs) |
| `GET /api/payments/proofs?status=` | admin | the Payments page list |
| `GET /api/payments/proofs/:id/file` | admin | the private proof image |
| `POST /api/payments/proofs/:id/approve` · `/reject` | admin | review (reject needs a reason) |

---

## 7. Tasks

### Phase A — Storage foundation
- [x] A.1 Add `UPLOADS_DIR` (default `data/uploads`, next to the default DB) with `images/` and `proofs/` subfolders, created on start. Document it in `.env.example` and `docs/DEPLOYMENT.md` (persistent folder outside the deploy dir, include it in backups).
- [x] A.2 Server upload helper: decode base64, check magic bytes (WebP/JPEG/PNG only), enforce the size cap, write with a random name, and never trust client file names or paths.
- [x] A.3 Client helper `src/services/imageCompress.ts`: load the file (incl. HEIC where the browser supports it), resize to ≤1600px, convert to WebP (JPEG fallback) and return base64 + dimensions. EXIF is stripped as a side effect.
- [x] A.4 `GET /media/:id.webp` route (public images only), with cache headers and `X-Content-Type-Options: nosniff`.

### Phase B — Package images
- [x] B.1 Create the `shipment_images` table in `server/db.ts` (`CREATE TABLE IF NOT EXISTS`, safe on existing DBs). *(Done with A.4: the media route needs it to check visibility.)*
- [x] B.2 Admin image API (list / upload / caption / visibility / reorder / delete).
- [x] B.3 Admin UI: a "Package images" panel in `EditShipmentModal` with drag-and-drop/upload, a required caption field, a visibility toggle, reordering and delete. Add the same panel as an optional step in `CreateShipmentView`.
- [x] B.4 `server/routes/track.ts`: return public images (`url`, `caption`, `width`, `height`, `createdAt`).
- [x] B.5 Copy for the section (heading, intro line, empty state) added to `docs/CONTENT.md`.
- [x] B.6 `TrackResultPage`: "Package images" section with a responsive grid (1 column on mobile, 2–3 on desktop), captions under each image, and a keyboard-accessible full-screen view (Esc closes, arrows navigate). Explicit width/height and `loading="lazy"`. Hidden when there are no images.
- [x] B.7 Show existing `photos_json` photos read-only alongside the new ones, so nothing already uploaded disappears.

### Phase C — Payment method types (shared)
- [x] C.1 `src/shared/paymentMethods.ts`: the 17 types from §4 with label, icon key, fields (name, label, required, validator: email, URL, IBAN checksum, UK sort code, US routing checksum, crypto address format), and the "customer sees" layout.
- [x] C.2 Payment icons: add the SVGs locally (`src/assets/payment-icons/`), record each one's source/licence in this file, and build a `<PaymentIcon type>` component with a lucide fallback.
- [x] ~~C.3 Create the `payment_methods` table and its admin-only API.~~ Built, then **removed by D-9** (see C.5).
- [x] ~~C.4 Admin Settings → Payment methods page.~~ Built, then **removed by D-9** (see C.5). Its customer preview card (`PaymentMethodCard`) stays and is reused in D.2 and E.3.
- [x] C.5 Remove the shared account list (D-9): the Settings tab, `/api/payment-methods`, the `payment_methods` table creation and the client calls. Registry, validators, icons and `PaymentMethodCard` stay.

### Phase D — Payment request per shipment (admin, accounts typed per shipment)
- [x] D.1 Create the `shipment_payments` table (one row per shipment, `UNIQUE tracking_number`, accounts in `methods_json`) and its admin API (`GET/PUT/DELETE /api/shipments/:id/payment`), validating every account with the shared registry. Deleted with the shipment only on permanent delete.
- [x] D.2 `PaymentRequestEditor` (admin): amount, currency (USD only, D-7), a required charge reason, an optional due date, an optional link to an existing invoice for this shipment, an optional customer note, and the **accounts for this shipment**: "Add account" → the 17 types as icon tiles → that type's form; edit, remove and reorder accounts. A **live preview** shows exactly what the customer will see. Used in two places:
  - **Create Shipment:** an optional "Payment request" step in the form, filled in **before** the tracking ID exists; saved through the admin payment route right after the server assigns the ID (never through the public booking POST). If that save fails, the shipment still exists and the success screen says so and offers to retry.
  - **Edit Shipment:** a "Payment request" section with full create / edit / delete.
- [x] D.3 Status controls: Cancel request, Mark paid manually (e.g. cash at the counter), Reopen.
- [x] D.4 `server/routes/track.ts`: return the `payment` block with **only this shipment's accounts**, in the courier's order, plus the latest proof status and rejection reason. Never return another shipment's accounts or internal notes.

### Phase E — Payment section on the track page
- [x] E.1 Copy for the payment section, method instructions, status labels, proof form, success/error messages and the rejected state, added to `docs/CONTENT.md`.
- [x] E.2 `PaymentSection` component: amount + currency (formatted with `Intl.NumberFormat`), charge reason, due date and status badge (*Awaiting payment · Proof under review · Paid · Cancelled*).
- [x] E.3 Method cards with icon + name; on mobile they are an accordion (one open at a time), on desktop a grid. Every field has a **Copy** button that confirms with a "Copied" toast and an `aria-live` announcement. QR codes for crypto addresses and payment links (add a small `qrcode` dependency, loaded only when a QR is shown). A network warning is shown for crypto.
- [x] E.4 When status is PAID, collapse the methods and show "Payment received". When CANCELLED, hide the section.
- [x] E.5 Responsive check at 375 / 768 / 1440 and with long values (IBANs, crypto addresses wrap, never overflow).

### Phase F — Proof of payment
- [x] F.1 Create the `payment_proofs` table.
- [x] F.2 `POST /api/track/:id/payment-proof`: a dedicated rate limiter (e.g. 5 per hour per IP), and accepted only while the status is AWAITING_PAYMENT and the chosen account belongs to this shipment's request. Images only, checked by content, max 3 open proofs per request. On success the request moves to UNDER_REVIEW.
- [x] F.3 Customer form (inside `PaymentSection`): method used (this shipment's accounts only), payer name, amount sent, reference (optional), screenshot (required; compressed in the browser with A.3; preview before sending). Clear success and error states.
- [x] F.4 Customer status: "Proof under review" (with submission time), or "Proof not accepted: *reason*" with the form shown again.
- [x] F.5 Admin **Payments** page (new sidebar item): a list of proofs (filter: submitted / approved / rejected), each showing the shipment, amount due vs sent, method, reference, a full-size image preview, and a link to the shipment.
- [x] F.6 Approve marks the request PAID, sets `paid_at`, marks the linked invoice PAID (reusing existing code), and optionally adds a "Payment confirmed" tracking event (checkbox). Reject requires a reason and sets the request back to AWAITING_PAYMENT.

### Phase G — Dashboard notifications (no email)
- [x] G.1 Admin badge: a count of SUBMITTED proofs on the Payments sidebar item and a bell in the admin header (from the existing stats call; polled every 30 s while the tab is visible, and refreshed when the console regains focus).
- [x] G.2 Dashboard panel: a **"New payment proofs"** card on the Operations Center dashboard listing unreviewed proofs, each with the **screenshot thumbnail** (served through the admin-only file route), tracking ID, amount due vs sent, method icon + name, reference and time received. Clicking it opens a full-size image viewer with **Approve / Reject** inline. Empty state when there's nothing to review.
- [x] G.3 When the poll finds a new proof while the console is open, show a toast ("New payment proof – NGF7K2M9") that links to it. Proofs already seen are tracked by id in `localStorage` (`ngf_seen_proofs`), wrapped in try/catch.

### Phase H — QA & release
- [x] H.1 End-to-end test of the example flow in §1 on a scratch DB (never the live `navora.db`).
- [x] H.2 Security checks: another shipment's accounts or a deleted account never appear in `/api/track`; proof files are 404/401 without an admin session; non-image uploads are rejected; rate limit works; `/api/settings` still contains no payment data.
- [x] H.3 Regression check: tracking lookup, admin login, shipment create/edit/delete/restore, documents/PDFs, quotes all still work.
- [x] H.4 `npm run build`: zero TS errors; check the bundle-size impact (payment UI and QR code lazy-loaded).
- [!] H.5 Deploy: create `UPLOADS_DIR` on Hostinger, set the env vars, redeploy, then re-test the flow on the live domain and on `/private-user/` for admin.
- [x] H.6 Tick the matching items in `PROJECT_TRACKER.md` and log the update there.

### Phase I — Owner corrections after go-live (2026-10-12)
- [x] I.1 Track page photos: on tablet/desktop (≥ 768 px) the photos fill the full width at a low, fixed height (one photo = full width, two = halves, three or more = thirds), cropped to fit, opening full size in the viewer. Mobile (< 768 px) unchanged.
- [x] I.2 Payment accounts behind a tab: "How to pay" is a full-width tab the customer opens to see the accounts (closed by default, `aria-expanded`), in the brand colours. The paid-state "Show payment accounts" toggle uses the same tab. Copy in CONTENT.md §6.8 first.
- [x] I.3 Proof form behind a tab: "Send proof of payment" is a tab of the same design that opens the form (closed by default). Copy in CONTENT.md §6.8 first.
- [x] I.4 Several methods at once: in the payment editor (Create Shipment step 5 and Edit Shipment) the method picker is a multi-select ("choose the methods to offer", up to the 10-account limit); the courier then fills in each chosen method in turn ("Account 2 of 3"). Hint recommends offering 3–5. Minimum stays 1.
- [x] I.5 Edit pen on the dashboard: Recent Shipments rows get the same pencil as All Shipments, opening Edit Shipment (details, photos, payment request). The literal "-" in the "Control"/"Moving" pill becomes an icon (both tables). A failed edit save is reported (it was swallowed and a success toast shown) and the local change is rolled back.
- [x] I.7 Edit Shipment is worldwide: no U.S. defaults (`New York`/`NY`/`100 Broadway`, `Los Angeles`/`CA`/`500 Grand Ave`, `Aug 26, 2026`, `(555) 000-0000`); State is an optional "State / Region"; an empty region is no longer saved as `US`; an empty delivery date keeps the stored one. Location is re-resolved only when the city/region was edited, and the offline lookup's guesses (`isExactCoordinate: false`, which place unknown cities in the United States) are ignored, so an unrelated edit never changes the country, coordinates or facility.
- [x] I.6 API errors: a response that isn't JSON (CDN check page, host restarting, timeout) no longer shows "Server returned non-JSON response (HTTP 200)". Reads (GET) retry automatically; anything still failing shows a plain message ("We couldn't reach the server…") with **Try again** in the photo and payment panels; details go to the browser console for diagnosis.

---

## 8. Blocked / Needs owner
- [ ] **Copy review (Phase I):** the new tab lines in CONTENT.md §6.8: `Choose one of {n} payment options` / `1 payment option` and `Already paid? Upload your receipt so we can confirm it.`
- [x] **Found in I.5, fixed 2026-10-12 (owner: "yes fix it"):** Edit Shipment U.S. defaults and the "United States" location guess (see I.7).
- [ ] **Edit Shipment, city the offline lookup doesn't know** (e.g. Kyoto): the new city name is saved but the map position stays where it was (no live geocoding in this form). Changing to a gateway city (Tokyo, London…) re-places it correctly.
- [ ] **H.5 Deploy (owner):** Hostinger deploys `main`; branch `navora` is 40+ commits ahead of `origin/main`. (1) Merge/push `navora` → `main`. (2) On Hostinger, create the persistent uploads folder next to the database (e.g. `/home/<hostinger-user>/navora-data/uploads`), set `UPLOADS_DIR` to it (DEPLOYMENT.md env block), redeploy. (3) Check `/api/diag/storage` while logged in at `/private-user/`. (4) Re-test the §1 flow on the live domain and on `/private-user/` (a test shipment, then delete it permanently: no demo data in production). (5) Add `UPLOADS_DIR` to the daily backup.
- [x] **Default currency** for new payment requests: **USD** (owner, 2026-10-09).
- [x] Which currencies the payment-request picker offers: **USD only for now** (owner, 2026-10-10; D-7).
- [ ] **Copy review:** payment section, proof form and messages in CONTENT.md §6.8 (added with E.1): owner to confirm.
- [x] **Copy review:** package-images text in CONTENT.md §6.6 and payment method names, field labels, warnings and notes in §6.7: **approved by the owner** (2026-10-10).
- [x] **Account details:** there is no fixed account list. The courier types the accounts per shipment, at creation or later (owner, 2026-10-10; D-9).
- [x] Approving a payment adds a public "Payment confirmed" tracking event: **on by default** (owner, 2026-10-10; D-8). The checkbox stays so the admin can untick it.
- [x] **Pre-existing test failures (not from this update):** 4 tests in `scripts/intl.test.ts`, `routing.test.ts` and `timeZones.test.ts` still expect the Lagos/Ibadan gateways removed in commit 584b7b6. Update the tests to the new gateways, or restore those gateways? → Owner: update the tests. Done 2026-10-10 (Tokyo, Osaka, Tateyama, Busan).

## 9. Decisions log
- **D-10 (2026-10-12)** Owner corrections (Phase I): photos full width/low height on tablet and desktop; payment accounts and the proof form each behind a tab; several methods chosen at once (3–5 recommended, minimum stays 1); edit pen on dashboard shipments; plain errors with automatic retry instead of "non-JSON response".
- **D-1 (2026-10-09) Gift cards are not offered as a payment method.** Gift cards are not a payment method for
  invoices: the US FTC and the UK's Action Fraud both state that a business demanding payment in gift cards is a
  scam sign, and gift card issuers (Apple, Amazon, Google, Steam…) forbid using their cards to pay third parties.
  Showing it on a tracking page puts the domain at risk of being flagged by browsers and payment providers and
  undermines customer trust, which conflicts with CLAUDE.md §1.3 (Honest). Card payments are covered by the
  **Card payment link** method (Stripe/Square), which also gives customers buyer protection.
- **D-2** Payment accounts never go in public settings. *(Their storage changed with D-9: on the shipment's payment request.)*
- **D-3** Uploaded files live in `UPLOADS_DIR` outside the deploy folder; images are compressed and EXIF-stripped in the browser.
- **D-4** Exactly one payment request per shipment; a charge reason is always required and shown to the customer.
- **D-5 (2026-10-09)** New-proof notifications go to the **admin dashboard** (badge, bell, panel with the screenshot, toast), **not email**. No SMTP or `nodemailer` needed.
- **D-6 (2026-10-09)** Default currency for payment requests is **USD** (owner).
- **D-7 (2026-10-10)** Payment requests are in **USD only** for now. The currency column stays (ISO 4217), so more can be added later without a schema change.
- **D-8 (2026-10-10)** The "Payment confirmed" tracking event checkbox on Approve is **ticked by default**.
- **D-9 (2026-10-10) No fixed payment-account list (owner).** The courier types the payment accounts for each shipment, in the Create Shipment form before the tracking ID is generated, or later from Edit Shipment, with full create/edit/delete. Accounts are stored in that shipment's `shipment_payments.methods_json`; the Settings → Payment Methods list (C.3/C.4) is removed. The public booking endpoint still never accepts payment data: Create Shipment saves the request through the admin-only payment route once the ID exists.

## 10. Change log
- 2026-10-09: Update plan written (this file). No code changed yet.
- 2026-10-09: Notifications changed from email to dashboard-only (D-5); `docs/PROMPT-UPDATE.md` added as the implementation prompt.
- 2026-10-10: A.1 `UPLOADS_DIR` (`server/uploads.ts`; default `uploads/` next to the DB) with `images/` + `proofs/` created on start; documented in `.env.example` and DEPLOYMENT.md (incl. backups).
- 2026-10-10: A.2 Upload helper in `server/uploads.ts`: base64/data-URL decode, magic-byte check (WebP/JPEG/PNG), 2 MB cap, `<uuid>.<ext>` names only, safe delete; tests in `scripts/uploads.test.ts`.
- 2026-10-10: A.3 `src/services/imageCompress.ts`: resize ≤1600px, WebP (JPEG fallback, white background), quality steps down to fit 2 MB, EXIF dropped by the canvas redraw; HEIC via the browser's own decoder. Checked in headless Chrome (3000×2000 PNG → 1600×1067 WebP, 242 KB; non-images rejected).
- 2026-10-10: A.4 + B.1 `shipment_images` table and public `GET /media/<id>.<ext>` (`server/routes/media.ts`): serves only visible images on non-trashed shipments, 1-year immutable cache, `nosniff`; hidden/trashed/unknown/proof/traversal requests all 404. Tested on a scratch DB, incl. after a restart.
- 2026-10-10: Fixed 4 tests that still used the removed Lagos/Ibadan gateways; they now use Tokyo (NRT), Osaka, Tateyama and Busan. `npm test`: 37/37 pass.
- 2026-10-10: B.2 Admin image API (`server/routes/shipmentImages.ts`): list / upload (caption required, ≤120 chars, max 20 per shipment) / caption + visibility / reorder / delete, plus an admin-only file route for previews. Permanent shipment delete now also removes image rows and files; trash/restore leaves them. Tested on a scratch DB.
- 2026-10-10: B.4 `/api/track/:id` returns `images[]` (visible only, admin order; `url`, `caption`, `width`, `height`, `createdAt`). Types `PublicShipmentImage` / `AdminShipmentImage` added. Tested on a scratch DB: hidden image excluded, order respected.
- 2026-10-10: B.3 `ShipmentImagesPanel` (admin) in `EditShipmentModal` and on the Create Shipment success screen (the tracking ID exists only after creation): drag-and-drop/choose files, browser compression, required caption, visibility toggle, move earlier/later, delete; saves on each change, Enter never submits the shipment form. Checked in headless Chrome at 1440/768/375 (no overflow, no console errors). Create-screen placement type-checked, not clicked through.
- 2026-10-10: B.5 Package-images copy added to CONTENT.md §6.6 (flagged for owner review).
- 2026-10-10: B.6 `PackageGallery` on the track page (after the route map; hidden with no images): 1/2/3-column grid, caption under each photo and as alt, width/height + lazy loading. `PackageImageViewer` is lazy-loaded (2.4 KB chunk, fetched on first open): Esc closes, ←/→ wrap, Tab trapped, focus returns to the thumbnail, body scroll locked, reduced-motion respected. Checked in headless Chrome at 1440/768/375: no overflow, no console errors.
- 2026-10-10: B.7 Older `photos_json` photos shown read-only: after the captioned images on the track page (`Shipment photo {n}`) and in an "Earlier photos (read-only)" block in the admin panel. `src/shared/legacyPhotos.ts` keeps only http(s), site-relative or `data:image/` values (test in `scripts/legacyPhotos.test.ts`). Phase B regression on a scratch DB: booking, tracking, admin login, edit, events, quotes, documents list, settings, trash/restore/permanent delete all OK; `npm test` 38/38.
- 2026-10-10: C.1 `src/shared/paymentMethods.ts` (17 types, fields, either/or rules, link/QR/warning/note builders, `validatePaymentDetails`, `customerMethodView`) + `src/shared/paymentValidation.ts` (email, https link with optional host check, phone, IBAN mod-97, sort code, ABA routing, SWIFT/BIC, crypto format per coin/network, $Cashtag, @handle, account digits). Field kinds extended with `swift`, `cashtag`, `handle`, `accountNumber`; fields can carry `options` (networks, account type). Customer copy in CONTENT.md §6.7. Tests: `scripts/paymentMethods.test.ts`.
- 2026-10-10: C.2 14 Simple Icons SVGs in `src/assets/payment-icons/` (sources and guidelines in §4 "Icon sources"), generated path module + `scripts/payment-icons.mjs`, `<PaymentIcon type size />` (decorative, lucide fallback). Drawn from path data, so no Vite-specific imports and no raw HTML. Test: `scripts/paymentIcons.test.ts`.
- 2026-10-10: C.3 `payment_methods` table + admin-only `/api/payment-methods` (list, create, edit, enable/disable, reorder, delete). Details validated and normalised by the shared registry; field errors returned per field; max 50 accounts; delete refused (409) while an open request ticks the method (check activates once D.1 creates `shipment_payments`). Tested on a scratch DB: 401 without session, `/api/settings` has no payment data.
- 2026-10-10: C.4 Settings → **Payment Methods** tab (`PaymentMethodsManager`), rendered outside the settings form (Save All Settings hidden on that tab): card grid with icons, enable/disable, reorder, delete (server 409 message shown), "Add method" → 17 icon tiles → per-type form (selects for networks/account type, client + server validation with per-field errors) with a **live customer preview** (`PaymentMethodCard`, reusable for D.2 and E.3). Checked in headless Chrome at 1440/768/375 on a scratch DB: no overflow, no console errors, `/api/settings` unchanged.
- 2026-10-10: **D-9** (owner): no fixed account list; accounts are typed per shipment at creation (before the tracking ID exists) or later, with full create/edit/delete. Spec updated (§1, §2, §3, §5, §6, Phases C, D, F, H). C.3 and C.4 superseded; C.5 added to remove them.
- 2026-10-10: C.5 Removed the shared account list (D-9): Settings tab (SettingsView restored to its pre-C.4 version), `/api/payment-methods` route, `payment_methods` table creation, client calls and `AdminPaymentMethod` type. Kept: registry, validators, icons, `PaymentMethodCard`, and per-field error passthrough in `api.ts`. Build clean, 47/47 tests; scratch server: route 404s, no `payment_methods` table on a fresh DB.
- 2026-10-10: D.1 `shipment_payments` table (accounts in `methods_json`) + admin `GET/PUT/DELETE /api/shipments/:id/payment` (`server/routes/shipmentPayments.ts`). Shared `src/shared/paymentRequest.ts`: `validatePaymentRequest` (amount > 0, USD only, reason 3–200 chars, real due date, note ≤300, 1–10 accounts each checked by the registry, stable account ids), `publicPaymentView`, `formatPaymentAmount`. Invoice link must be an INVOICE of the same shipment. Kept on trash/restore, removed on permanent delete. Tests: `scripts/paymentRequest.test.ts`; scratch-DB API run incl. 401 without session and the public booking POST ignoring payment data.
- 2026-10-10: D.2 `PaymentRequestEditor` (amount, USD, reason, due date, invoice link, note, per-shipment accounts via type tiles → type form, edit/remove/reorder, live customer preview) used in **Create Shipment step 5** (optional, clearly marked public; invalid draft blocks Create and returns to step 5; saved via `PUT /api/shipments/:id/payment` right after the ID is assigned; failure leaves the shipment, shows the error and a Try again button; summary in step 6 review; not in the browser draft) and in **Edit Shipment** (`ShipmentPaymentPanel`: add, edit, delete; saved on its own). Headless Chrome on a scratch DB: blocked create, happy path, forced 503 + retry, edit/delete/re-add, 1440/768/375 without overflow, no console errors.
- 2026-10-10: D.3 `POST /api/shipments/:id/payment/status` (cancel / mark_paid / reopen, 409 on invalid transitions) + buttons in the Edit Shipment payment panel (with confirmations). Invoice paid/pending logic extracted from the documents route into `setDocumentPaymentStatus` and reused (route behaviour unchanged, re-tested). Scratch-DB API run + headless Chrome check (1440/375, no console errors).
- 2026-10-10: D.4 `/api/track/:id` returns `payment` (amount, currency, reason, due date, status, customer note, paid time, and this shipment's accounts in order with their customer view: fields, link, QR value, warning, note, instructions) or `null`. Built by `publicPaymentView`; no invoice id or other internal fields. Scratch-DB check: two shipments never see each other's accounts; cancelled shows CANCELLED (hidden by E.4); deleted gives `null`. Latest proof status / rejection reason is added with the proofs table in F.4.
- 2026-10-10: E.1 Payment section copy (summary, status badges, accounts heading, accordion, QR, copy toast, paid state, proof form, review/rejected states, errors) added to CONTENT.md §6.8 (flagged for owner review).
- 2026-10-10: E.2 `PaymentSection` (lazy-loaded 1.8 KB chunk, only for shipments with a payment request) after the package images on the track page: amount via `Intl.NumberFormat`, charge reason, due date (read as a calendar date, no time-zone shift), customer note, status badge. Headless Chrome on a scratch DB at 375/768/1440: no overflow, no console errors.
- 2026-10-10: E.3 "How to pay" accounts in `PaymentSection`: grid (2 columns from 768px, 3 from 1200px) / accordion below 768px (one open at a time, first open, `aria-expanded`); `PaymentMethodCard` gained optional accordion props, a copy callback for the section's `{field} copied` toast (`role=status`, 2 s) and a Show/Hide QR code toggle (`PaymentQr`; `qrcode@1.5.4`, MIT, in its own 26 KB chunk fetched only when a QR is opened). Copy messages now keep the field name's case ("IBAN", not "iban"). The admin live preview shows the QR toggle too. Headless Chrome on a scratch DB at 375/1440: QR chunk not loaded until clicked, copy toast + reset, accordion state, no overflow, no console errors; `npm test` 52/52.
- 2026-10-10: E.4 PAID: "Payment received" line with the paid date (or the no-date text) and the accounts collapsed behind `Show/Hide payment accounts` (`aria-expanded`). CANCELLED: the track page doesn't render the section or fetch its chunk (and `PaymentSection` returns nothing as a second guard). Checked in headless Chrome on a scratch DB after `mark_paid` / `cancel` through the admin status route (1440/375, no overflow, no console errors).
- 2026-10-10: E.5 Responsive check on a scratch DB with worst-case data (amount 1,000,000,000, 200-char reason, 300-char note with a long URL, 60-char label, long beneficiary/IBAN/bank address/email/card URL, Taproot BTC, ETH and BEP20 addresses, 120-char unbroken instructions) at 320/375/768/1440, every accordion item opened with its QR shown: no element outside its card, no page overflow, no console errors. No code changes needed.
- 2026-10-10: F.1 `payment_proofs` table (§5 columns, indexes on payment and status/date) and `server/routes/paymentProofs.ts`. Deleting a payment request, or permanently deleting its shipment, now also removes its proofs (rows and screenshot files); trash/restore leaves them. Created on an existing scratch DB at start-up.
- 2026-10-10: F.2 Public `POST /api/track/:id/payment-proof` (`server/routes/trackProof.ts`, mounted before the track lookup) with `paymentProofLimiter` (5 per hour per IP). Accepted only while AWAITING_PAYMENT (status re-checked inside the transaction), for one of this shipment's own accounts, max 3 open proofs; image checked by content (2 MB cap) and stored in `proofs/`; the account is snapshotted; the request moves to UNDER_REVIEW. Errors carry `code` (NOT_ACCEPTING, TOO_MANY_OPEN, RATE_LIMITED) and CONTENT.md §6.8 messages. Shared rules in `src/shared/paymentProof.ts` (test: `scripts/paymentProof.test.ts`). Scratch-DB run: non-image, another shipment's account and missing fields rejected with no file written; valid PNG 201 → UNDER_REVIEW; repeat 409; 6th request 429; 4th open proof 409; deleting the request removed all proof files.
- 2026-10-10: F.3 `PaymentProofForm` in `PaymentSection` (only while awaiting payment): account (this shipment's accounts; preselected when there is one), payer name, amount sent (prefilled with the amount due), optional reference, screenshot (compressed to WebP and EXIF-stripped in the browser, preview, change/remove). Same validation as the server (`validateProofSubmission`), errors tied to fields with `aria-describedby`/`aria-invalid`, focus moves to the first error, each error clears when its field is edited; 409/429 show the server's message, anything else the connection message. On success the form is replaced by the thank-you line and the badge shows "Proof under review" until the next refresh. `api.submitPaymentProof` added. Headless Chrome on a scratch DB at 375/768/1440: empty submit, fill + upload (stored as WebP, ~80 KB), success, intercepted 409 and offline errors; no console errors.
- 2026-10-10: F.4 `/api/track/:id` `payment.proof` = the latest proof's status, submission time and (only when REJECTED) the admin's reason; never the file, payer name, amount or reference (`latestPublicProof`). Track page: "Proof under review" with the submission date and time (visitor's locale), or "Proof not accepted: {reason}" above the form shown again. Test extended in `scripts/paymentRequest.test.ts` (57/57). Scratch DB + headless Chrome at 375/1440 (rejection set in the DB until F.6 exists): no overflow, no console errors.
- 2026-10-10: F.5 Admin **Payments** page (sidebar under Messages): filters Submitted (default) / Approved / Rejected / All with counts, header search, refresh; each proof shows the screenshot thumbnail, tracking ID, proof and request status, amount due vs sent (flagged when they differ), the account used (icon + name, from the snapshot), payer, reference, reason, received time, `View screenshot` (`ProofViewer`: full size, Esc, focus trap and return) and `View shipment`. API: `GET /api/payments/proofs?status=` and the private `GET /api/payments/proofs/:id/file` (`no-store`, `nosniff`), both behind `requireAdminAuth`; trashed shipments' proofs are left out. Scratch DB: list and file 401 without a session, proof ids 404 on `/media`; headless Chrome at 1440/375 with no overflow or console errors.
- 2026-10-11: F.6 `POST /api/payments/proofs/:id/approve` (request → PAID + `paid_at`, linked invoice PAID via `setDocumentPaymentStatus`, optional public "Payment confirmed" event at the Operations Centre that leaves the shipment status alone; only for SUBMITTED proofs while the request is awaiting or under review, else 409) and `/reject` (reason 3–300 chars, shown to the customer; an UNDER_REVIEW request returns to AWAITING_PAYMENT once no other proof is waiting). Both in one transaction. `ProofReviewControls` on each card and in the viewer: event checkbox ticked by default (D-8), confirm before approving, reason required to reject; the list reloads after a review. Event copy added to CONTENT.md §6.8. Long "For" reasons now use the full card width. Scratch DB: every rule above checked over the API (incl. 401 without a session) and approve/reject clicked through in headless Chrome; no console errors.
- 2026-10-11: G.1 `/api/stats` returns `submittedProofsCount` (SUBMITTED proofs of shipments not in the trash, same as the Payments page). The console polls it every 30 s while the tab is visible and again on focus/visibility change, and after the Payments list reloads (e.g. after a review). Payments sidebar item shows `{n} NEW`; the header bell adds the count and opens with a "New payment proof(s)" item that goes to Payments (keyboard-reachable). `api.getStats` now sends credentials like the other admin calls. Scratch DB: 401 without a session, approved and trashed-shipment proofs not counted, count drops to 0 after a reject; headless Chrome at 1440/375: badge, bell, click-through, badge clears after a reject, no overflow, no console errors.
- 2026-10-11: G.2 `NewProofsPanel` on the Operations Center (between the KPI cards and Recent Shipments): "New payment proofs" with a "{n} to review" pill, refresh and "All Payments →"; up to 6 cards (screenshot thumbnail from the admin-only file route, tracking ID, received time, amount due vs sent with a "differs" flag, method icon + name, reference), then a link to the rest in Payments. Clicking opens `ProofViewer` with the details and the F.6 Approve / Reject controls; the outcome stays in the viewer, the card leaves the list, the badge/bell refresh straight away, and focus returns to the heading when its thumbnail is gone. Reloads whenever the G.1 poll count changes. Empty state "Nothing to review". The proof details block moved from `PaymentsView` into a shared `ProofFacts` component (with its CSS); the Payments page renders the same. Scratch DB + headless Chrome: 3 proofs on 1440/768/375 without overflow, approve and reject from the viewer, empty state, Payments page unchanged, no console errors; build clean, `npm test` 57/57.
- 2026-10-11: G.3 New-proof toast in `AdminApp`: when the G.1 poll counts proofs waiting, it also fetches the SUBMITTED list and compares ids with `ngf_seen_proofs` (localStorage, every read/write in try/catch, plus an in-memory copy). An unseen proof shows "New payment proof – {tracking ID}" (several: "{n} new payment proofs"); clicking opens Payments filtered to that tracking ID (or the whole list), ✕ dismisses, it hides after 10 s. The stored list keeps only proofs still waiting, so it stays small. Proofs that arrived while the console was closed are announced on the next open; if storage is blocked, the first poll only records what's there. Scratch DB + headless Chrome (14 checks): first-open toast, no repeat after reload or a second poll, toast for 1 and for 2 new proofs, click-through filter, dismiss, list pruned after reviews, blocked storage, 375px fit, no console errors; build clean.
- 2026-10-11: H.1 The §1 example flow on a scratch DB in headless Chrome (42 checks, all pass). Courier, in the real Create Shipment form: Parcel Tokyo (JP) → Busan (KR), step 5 payment request $120.00 USD "Customs duty – Invoice NGF-INV-104233" with a PayPal and a Bitcoin account → Register → `NGF…` ID, request saved, BOL generated; photo captioned "iPhone 15" uploaded from the success screen. An invoice was then linked to the request over the admin API (it can only exist after the shipment). Customer (no session) at 1440 and 375: photo, amount, reason and **only** the PayPal and Bitcoin cards, badge "Awaiting payment"; proof form (amount prefilled, reference, screenshot compressed in the browser) → thank-you → after refresh "Proof under review", form hidden. Admin: dashboard panel + "1 NEW" badge + thumbnail, approve in the viewer with the event box ticked → invoice PAID. Customer: badge "Paid", "Payment received", "Payment confirmed" in **Show scan history** (the main Journey timeline lists the planned milestones, so real events are only in the scan history; existing design). Courier (admin API): reopen + edit to $95 with only the Bitcoin account → track shows exactly that; delete → no payment on the track API or page, photo still shown. No console errors, no page overflow; the only HTTP errors were the known public-page 401s from `AdminDataProvider`.
- 2026-10-11: H.2 Security checks over HTTP on a scratch DB (54 checks, all pass): `/api/track` shows only that shipment's accounts, never another's or a removed one, and none of the internal fields (invoice id, payer, file, admin note); a proof naming another shipment's or a removed account is refused with no file written; a trashed shipment is 404. Proof file 401 without a session, 200 with one (`private, no-store`, `nosniff`); the proof is not reachable through `/media` (by id, by file name, `proofs/`, encoded `../`) or any other public path. Proof list, approve, reject, stats, and the shipment payment/status/images routes are 401 without a session; the public booking route ignores payment data. Text, SVG with a script, PDF, HTML and GIF are rejected by content for both proofs and package images; >2 MB image 400, >5 MB body 413; rejected uploads write no file and leave the request unchanged. Rate limit: attempts 6 and 7 in the hour get 429 with `RATE_LIMITED` and the §6.8 message, another client is not blocked, a spoofed left-most `X-Forwarded-For` doesn't reset it (`trust proxy` = 1 hop, as on Hostinger). `/api/settings` has no payment data (with or without a session); `/api/payment-methods` stays 404.
- 2026-10-11: H.3 Regression on a scratch DB (32 of 33 checks pass; the miss is the test browser, see below). API: public booking (NGF ID), document generate, tracking event, status change, track API (and 404 for an unknown ID), quote submit → admin list (401 without a session) → publish → public quote, trash + permanent delete. Headless Chrome: the Track page form opens the result at 1440 and 375 with the admin's event in the scan history and no overflow, unknown ID shows the not-found line; admin login form refuses a wrong password and accepts the right one; Edit Shipment saves (events kept); delete → gone from the public track API → Recently Deleted → Restore (events intact); Document Center preview renders and **Download PDF** builds a real PDF (263 KB `application/pdf`, `%PDF-` header, "Downloaded BOL-….pdf" toast); Quote Requests lists the request; the public quote page renders; dashboard loads with all sections; no console errors and only the known public-page 401s. Not verified: headless Chrome did not write the PDF to disk (download plumbing in the test browser; the app's blob and save call were confirmed). Note: `POST /api/documents/generate` (public, pre-existing) accepts an unknown `docType`, which then previews as a blank page; not changed here.
- 2026-10-11: H.4 `npm run build` passes with zero TypeScript errors (last run after G.3; no code changed since), `npm test` 57/57. Bundle compared with a Vite build of `0395282` (the commit before this update), gzip: first load of the public site **253.8 → 255.6 KB (+1.8 KB)**: `index.js` +1.1, `index.css` +0.7. Everything else is fetched on demand: `PaymentSection` 3.6 KB + CSS 1.8 (only for shipments with a payment request), shared payment-method/compression chunk 13.5 KB + CSS 1.1 (track page payment section and the admin), the QR library 9.9 KB (only when a QR code is opened), `PackageImageViewer` 1.0 KB + CSS 0.7 (first photo opened). Admin bundle (already separate): `AdminApp.js` 74.6 → 86.8 KB (+12.2), `AdminApp.css` +4.1. The existing >500 kB chunk warning (`index.js`) was there before this update.
- 2026-10-11: H.5 marked blocked: deploying needs the owner (push to `main`, Hostinger `UPLOADS_DIR` + redeploy, live re-test); steps listed under Needs owner. H.6: PROJECT_TRACKER.md had no items for this update to tick; added a Change log entry summarising it, `UPLOADS_DIR` in Phase 7 tasks 7.2/7.5, and Blocked #54 (deploy + CONTENT §6.8 copy review + the `docType` note from H.3).
- 2026-10-12: Phase I (owner corrections, D-10). **I.1** `PackageGallery`: from 768 px the grid columns follow the photo count (1 full width, 2 halves, 3+ thirds) and photos are a fixed 220 px (tablet) / 260 px (desktop) high, `object-fit: cover`; phones unchanged. **I.2/I.3** `PaymentTab` in `PaymentSection` (full-width button, brand-red icon chip and edge, chevron, `aria-expanded`/`aria-controls`, closed by default): "How to pay · Choose one of {n} payment options" holds the accounts, "Send proof of payment" holds the form (`PaymentProofForm embedded`: no own heading/frame); the paid "Show/Hide payment accounts" toggle uses the same tab; copy added to CONTENT §6.8 first. **I.4** `PaymentRequestEditor`: "Add payment methods" opens a multi-select (tiles with `aria-pressed` and a check box, capped at the remaining slots, "Continue with N methods"); each chosen method's form follows ("Account 2 of 3", Add and continue / Skip / Cancel); hint recommends 3–5. **I.5** Recent Shipments rows have the edit pen (same `EditShipmentModal`: details, photos, payment request); the "-" in the Control/Moving pill is an icon (both tables); `updateShipmentFull` now returns `{ success, error }` and restores the old values on failure (it used to swallow the error and show a success toast); the modal waits for the save ("Saving…") and stays open with a plain error and the typed values when it fails. **I.6** `api.ts`: all 48 requests go through `fetchApi`; GET/HEAD retried twice (0.7 s, 1.8 s) on a dropped connection or a non-JSON reply; writes sent once; a reply that still isn't JSON gives "We couldn't reach the server just now. Please try again in a moment." (reads) or a "couldn't confirm" message (writes), with status/content type/body start in the console; the photo and payment panels show **Try again**. Verified: build clean, `npm test` 57/57; scratch DB + headless Chrome, 40 checks: gallery sizes at 1440/768/375 and two photos as halves, both tabs closed by default and opening at 1440/375 with no overflow, paid tab, icon in both pills, dashboard pen, 3 methods picked at once and saved, edit saved from the dashboard with toast, a forced 500 on save keeps the form open with the typed value and rolls the row back (server unchanged), a faked one-off HTML reply to the photos GET is retried transparently, a persistent one shows the plain message and Try again recovers, Create Shipment step 5 has the new picker; the only console error was the logged injected save failure.
- 2026-10-12: I.7 Edit Shipment worldwide fix (see the task). Found while testing: `resolveLocation('Osaka')` (and any city outside the gateway/U.S. tables, e.g. "Paris, France") returns `country: 'United States', state: 'US'` with `isExactCoordinate: false`, and the form used to save that country, region and those coordinates on every save; the shared lookup is unchanged, the form now ignores inexact results and leaves unedited locations alone. Scratch DB + headless Chrome, 14 checks: an Osaka → Busan shipment opens with empty region/address fields and no U.S. text, saves a name change with no `NY`/`CA`/`US`, no invented address, cities, coordinates and delivery date unchanged; city → London places it at the London gateway (GB); city → Kyoto stores no U.S. guess; a U.S. shipment keeps TX/CO and its street address; public track data has no U.S. region; no console errors. Build clean, `npm test` 57/57.

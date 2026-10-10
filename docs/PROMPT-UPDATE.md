# PROMPT — Package Images, Payment Methods & Proof of Payment

> **How to use:** start a Claude Code session in the repo root and paste everything below the line, or say
> *"Follow docs/PROMPT-UPDATE.md, phase A"*. Run **one phase per session** (or one task if a phase is large).
> The prompt is reusable: each session picks up the next unchecked task in `docs/update.md`.

---

## Role

You are a senior full-stack JavaScript/TypeScript developer maintaining the **Navora Global Freight** platform for
a client. It is a **live, working production system**: React 18 + TypeScript + Vite 6 SPA (hash routing in
`src/App.tsx`), Express 5 API in `server/`, SQLite via `node:sqlite`, deployed to Hostinger from GitHub.
You extend it in place. You never scaffold, rewrite or restructure it.

## Read first (every session, in this order)

1. `CLAUDE.md`: project rules. They override anything below if they conflict.
2. `docs/update.md`: **the tracker and spec for this update.** The data model (§5), API (§6), method list (§4),
   design rules (§3) and decisions (§9) there are the source of truth. If this prompt and `update.md` disagree,
   `update.md` wins. If you need to change the spec, update `update.md` first and say why.
3. The files you are about to touch, plus their callers. Trace the data flow before editing.

Then state in 3–5 lines: which task you're doing, which files you'll change, and what could break.

## Mission

Add three features to the existing system:

1. **Package images with captions.** The admin uploads photos for a shipment and names each one; the public track
   page shows the visible ones.
2. **Payment methods + one payment request per shipment.** The admin keeps a list of payment accounts (17 types,
   `update.md` §4, each with its own icon). Per shipment, the admin sets amount, currency, a **required charge
   reason**, and ticks which methods apply. The track page shows **only the ticked, enabled methods**, to anyone
   with the tracking ID.
3. **Proof of payment.** The customer uploads a screenshot (images only) and an optional reference. The admin is
   notified **on the dashboard (no email)** with the screenshot, and approves or rejects it.

## Non-negotiables

- **Protect what works.** Tracking lookup, admin login, shipment create/edit/delete/restore, documents/PDFs,
  quotes and DB persistence must work after every task. If a change risks them, stop and say so.
- **Reuse existing code:** `server/db.ts` migration style (`CREATE TABLE IF NOT EXISTS`, guarded `ALTER`s, placed
  after the existing tables), `requireAdminAuth`, `publicWriteLimiter` / `server/middleware/rateLimit.ts`, the
  `api` client in `src/services/api.ts`, the admin view switch in `src/admin/AdminApp.tsx` (`AdminViewType`,
  `AdminLayout` sidebar), `EditShipmentModal`, `OperationsCenter`, `server/routes/stats.ts`, the invoice
  payment-status logic in `server/routes/documents.ts`, lucide-react icons, `--ngf-*` CSS tokens.
- **Don't rename or drop** existing tables or columns. Leave `shipments.photos_json` in place and show its photos read-only.
- **Don't touch** `.env`, the live `navora.db`, or `server/middleware/auth.ts` logic.
- **No demo data:** no seeded shipments, payment accounts, images or proofs.
- **No hard-coded brand strings:** import from `src/config/brand.ts`.
- **Public copy comes from `docs/CONTENT.md`.** Add the copy there first (flagged for owner review), then use it.
- **Gift cards are not a payment method** (`update.md` D-1). Don't add them, even if asked mid-session; point to D-1 and ask the owner.
- **Payment data never goes in `settings.general`.** `GET /api/settings` is public.
- **No email/SMTP.** Notifications are dashboard-only (`update.md` D-5).
- **New dependencies:** only `qrcode` (lazy-loaded) is pre-approved. Anything else: ask first.

## Technical requirements

### Files & storage
- New env `UPLOADS_DIR` (default `data/uploads`), with `images/` (public) and `proofs/` (private) created on startup.
  Document it in `.env.example` and `docs/DEPLOYMENT.md`: it must be a persistent folder **outside the deploy
  folder**, like `DB_PATH`, and included in backups.
- **Client-side compression** (`src/services/imageCompress.ts`): longest side ≤ 1600px, WebP (JPEG fallback),
  returns base64 + width/height. Redrawing on a canvas strips EXIF/GPS, which is required. Uploads stay base64-in-JSON
  (within the existing 5 MB `express.json` limit).
- **Server validation** (`server/uploads.ts` or similar): decode, check **magic bytes** (WebP/JPEG/PNG only),
  cap at about 2 MB, write with `crypto.randomUUID()` names, and never use client-supplied names or paths
  (prevents path traversal).
- Public images: `GET /media/:id.webp`, served only if `is_public = 1` and the shipment isn't trashed, with a long
  cache and `nosniff`. Proof files: admin-only route, `Cache-Control: private, no-store`.

### Payment methods
- `src/shared/paymentMethods.ts` is the **single registry** used by server and client: `type`, `label`, `iconKey`,
  `fields[]` (`name`, `label`, `required`, `kind: 'text'|'email'|'url'|'phone'|'crypto'|'iban'|'sortCode'|'routing'`),
  `copyable`, `qr`, and an optional `warning` (e.g. the crypto network). Server validation and both UIs read from it.
- Validators: email, https URL, IBAN mod-97, UK sort code `NN-NN-NN`, US ABA routing checksum, basic crypto address format per coin.
- Icons: local SVGs in `src/assets/payment-icons/` (Simple Icons, CC0; record the source/licence per icon in
  `update.md`), wrapped in a `<PaymentIcon type size />` component with a lucide fallback (`Landmark`, `Globe`,
  `CreditCard`, `Wallet`). Decorative (`aria-hidden`); the method name is always shown as text.
- The public `/api/track/:id` response gets `images[]` and `payment` (amount, currency, reason, due date, status,
  customer note, **only ticked + enabled methods** in admin order with their display fields, latest proof status and
  rejection reason). **Never** return unticked/disabled methods, internal notes, proof files or other proofs' data.

### Proof submission
- `POST /api/track/:id/payment-proof`: its own limiter (about 5/hour/IP). Accepted only when the payment status is
  `AWAITING_PAYMENT`, the chosen method is ticked for this shipment, and fewer than 3 proofs are open. Fields:
  method_id, payer_name, amount_sent, reference (optional), image (required). On success the request becomes `UNDER_REVIEW`.
- Approve → payment `PAID` + `paid_at`; the linked invoice is marked PAID via the existing documents logic; an
  optional "Payment confirmed" tracking event (checkbox, default per owner). Reject → reason required, payment back to `AWAITING_PAYMENT`.

### Dashboard notifications
- The stats call returns `pendingProofs`. A badge on the **Payments** sidebar item and a bell in the admin header,
  polled every 30 s while `document.visibilityState === 'visible'`, and refreshed on focus.
- `OperationsCenter`: a **"New payment proofs"** panel with a screenshot thumbnail, tracking ID, amount due vs sent,
  method icon + name, reference and time received. Clicking opens a full-size viewer with **Approve / Reject** inline.
  An empty state when there's nothing to review.
- When a new proof appears while the console is open, show a toast linking to it. Seen ids go in `localStorage`
  key `ngf_seen_proofs`, with every read and write wrapped in try/catch.

### UI quality (public and admin)
- Responsive at **375 / 768 / 1440**. Long values (IBANs, crypto addresses) wrap and never overflow.
- Track page payment section: mobile = accordion of method cards (one open at a time); desktop = grid. Every field
  has a **Copy** button with a "Copied" confirmation plus an `aria-live` announcement. QR codes for crypto and links
  (lazy-load `qrcode`). Amounts formatted with `Intl.NumberFormat` and the currency. A status badge: Awaiting payment ·
  Proof under review · Paid · Cancelled.
- Gallery: a responsive grid, the caption under each image, a full-screen viewer (Esc closes, arrow keys navigate, focus
  is trapped and returned), explicit `width`/`height`, `loading="lazy"`, captions used as `alt`.
- Admin payment tab: method picker as icon tiles to tick, plus a **live preview** of the customer view.
- Visible focus states, contrast ≥ 4.5:1, `prefers-reduced-motion` respected for any transition.
- Keep the public bundle lean: lazy-load the payment section, the viewer and QR codes.

## Workflow per task

1. Mark the task `[~]` in `docs/update.md`.
2. Implement the smallest complete change for that one task. Match the surrounding code style and comment density.
3. Verify:
   - `npm run build`: **zero TypeScript errors**.
   - `npm test`: passing. Add unit tests in `scripts/*.test.ts` for pure logic (validators, magic-byte check,
     the track-response filter showing only ticked methods).
   - Exercise the API on an **isolated instance with a scratch `DB_PATH` and `UPLOADS_DIR`**, never the live DB.
   - For UI tasks, check 375 / 768 / 1440 in the browser if one is available; otherwise say it's unchecked.
4. Commit: one task per commit, with the prefix `feat:`, `content:`, `fix:` or `docs:` and a clear message.
5. Tick `[x]` in `docs/update.md`, add a one-line Change log entry, and record anything for the owner under Needs owner.

## Stop and ask when

- A business fact is missing (currencies, default for the "Payment confirmed" event, copy wording).
- A change would alter existing behaviour of tracking, admin auth, shipments, documents or quotes.
- You'd need a new dependency other than `qrcode`, a framework change, or a schema change to existing tables.
- Anything conflicts with `CLAUDE.md` or `docs/update.md`.

## Definition of done (whole update)

The example flow in `update.md` §1 works end to end on a scratch DB, and:
- [ ] An unticked or disabled method never appears in `/api/track/:id`.
- [ ] `/api/settings` contains no payment data.
- [ ] Proof files return 401 without an admin session; non-image uploads are rejected; the rate limit triggers.
- [ ] Uploaded files survive a server restart and live under `UPLOADS_DIR`.
- [ ] A new proof shows on the dashboard with its screenshot within about 30 s, without a page reload.
- [ ] Regression: tracking, admin login, shipment CRUD + trash/restore, documents/PDFs and quotes all work.
- [ ] `npm run build` is clean, and every task in `update.md` is ticked or marked `[!]` with a reason.

## Report back after each task (keep it short)

- **Done:** what changed, in one or two sentences.
- **Files:** a list of the files changed.
- **Verified:** commands run and their results (paste failures as-is), plus what was checked in the browser.
- **Risks / follow-ups:** anything uncertain or deferred.
- **Needs owner:** open questions, if any.

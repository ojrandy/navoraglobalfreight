# 3D & Motion Specification

> **Context:** The Navora platform is **already built and working**: public website, tracking engine, Express/SQLite API,
> admin console, documents and quotes. Claude is acting as a **senior professional developer** who maintains and improves this
> existing codebase. Nothing here is built from scratch; every task modifies the working system
> in place and must leave it working. See `CLAUDE.md §0`.

**Approach:** the 3D and motion layer is **added on top of** the existing pages and components. Wrap and enhance the existing markup; don't rebuild sections.

**Goal:** the site should feel alive and physical, with depth, momentum and a sense of global movement, while staying
calm, fast and easy to use. Motion guides the eye. It never blocks content or slows the page.

---

## 1. Principles

1. **Content first.** Every page reads perfectly with all motion switched off.
2. **One hero moment per page.** Only the Home globe is heavy 3D. Everything else is light CSS/JS depth.
3. **Transform and opacity only.** Never animate `top/left/width/height/box-shadow` on scroll.
4. **Natural easing.** Default `cubic-bezier(0.22, 1, 0.36, 1)` (easeOutQuint). Durations 400–800 ms for reveals,
   150–250 ms for hovers. No bounce or elastic easing.
5. **Respect the user.** `prefers-reduced-motion: reduce` → no parallax, no tilt, no auto-rotation, and reveals
   become simple fades of ≤ 200 ms. Also respect `Save-Data`.
6. **Pause what can't be seen.** Any animation loop stops when it's off-screen or the tab is hidden.

## 2. Performance budget (these are acceptance criteria)

| Metric (mobile, mid-range Android, 4G) | Target |
|---|---|
| Lighthouse Performance (Home) | ≥ 85 |
| Lighthouse Accessibility | ≥ 95 |
| LCP | ≤ 2.5 s |
| CLS | ≤ 0.05 |
| INP | ≤ 200 ms |
| Main JS for public pages (gzip, excluding 3D + admin chunks) | ≤ 250 KB |
| 3D chunk (gzip) | ≤ 200 KB, loaded **after** LCP / on idle |
| Scroll & 3D frame rate | 60 fps target; globe render ≤ 8 ms per frame |

**Code-splitting to do first** (it's the biggest win and costs nothing visually):
- `React.lazy` the whole admin app (`src/admin/*`, ~10k lines). Public visitors should never download it.
- Lazy-load Leaflet maps (`JourneyMap`, `FacilityNetworkMap`, `HomeNetworkMap`) when they scroll into view.
- Lazy-load `jspdf` and `html2canvas` only when a document is downloaded.

## 3. Dependencies (keep this list short)

| Package | Why | Notes |
|---|---|---|
| `three` | WebGL engine for the hero globe | |
| `@react-three/fiber@^8` | React renderer for three | v8 is the line for **React 18** (v9 needs React 19) |
| `@react-three/drei@^9` | Helpers (only import what you use) | Optional; skip if not needed |
| `lenis` | Smooth, natural inertia scrolling | Optional, ~3 KB. Off for reduced motion and touch. Maps get `data-lenis-prevent` |

**No** GSAP, Framer Motion or Spline for now. Custom hooks (below) cover everything with less weight.
If a future feature truly needs them, add a note to the tracker's Decisions log first.

## 4. Building blocks (create in `src/motion/`)

| File | Purpose |
|---|---|
| `useReducedMotion.ts` | Returns `true` if the user prefers reduced motion or `Save-Data` is on |
| `useReveal.ts` | IntersectionObserver adds `.is-visible` once. CSS does the animation. Supports `stagger` via a CSS var `--i` |
| `useTilt.ts` | Pointer-driven 3D tilt: `perspective(1000px) rotateX/rotateY`, max **6°**, eased with rAF, resets on leave. Disabled on touch and reduced motion |
| `useParallax.ts` | Moves a layer by `speed × scroll progress` (translate3d only), clamped to ±40 px. Uses CSS `animation-timeline: view()` where supported, else a rAF fallback |
| `useCountUp.ts` | Animates a number when it's visible (1.2 s, easeOutQuint), respects locale formatting |
| `SmoothScroll.tsx` | Optional Lenis provider (lerp 0.1). Pauses while modals are open |
| `motion.css` | Shared classes: `.reveal`, `.reveal-up`, `.reveal-scale`, `.tilt`, `.depth-shadow`, plus reduced-motion overrides |

```css
/* motion.css: core pattern */
.reveal { opacity: 0; transform: translate3d(0, 24px, 0); transition: opacity .7s var(--ease-out), transform .7s var(--ease-out); transition-delay: calc(var(--i, 0) * 80ms); }
.reveal.is-visible { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .reveal { transform: none; transition: opacity .2s linear; }
  .tilt { transform: none !important; }
}
```

## 5. Section-by-section plan

### Home
| Section | Effect |
|---|---|
| **Hero** | **3D globe** (right side on desktop, behind text at 40% opacity on mobile). Dotted landmasses, glowing gateway markers (CONTENT §9) and animated trade-route arcs (CONTENT §9 lanes) with light pulses travelling along them. Slow auto-rotate (0.05 rad/s), gentle drag-to-rotate on desktop, subtle pointer parallax. Headline words rise in with a 60 ms stagger. |
| Why Navora (3 cards) | Staggered `reveal-up`, then `useTilt` on hover with a soft moving highlight. Cards "float" (layered shadow + 2 px translate). |
| How it works | A dashed SVG path connects the 4 steps and **draws itself** as you scroll (`stroke-dashoffset` tied to section progress). Step icons pop in as the line reaches them. |
| About strip | Image parallax (speed 0.15) + `useCountUp` on real stats. |
| Services (4 image cards) | Tilt + inner image zoom (scale 1.00→1.05) on hover. Background image parallax on scroll. |
| Industries tabs | Crossfade + slight 3D rotateY (8°) between showcase images when switching tabs. |
| Global network map | Replace the U.S. map with a **2D world map** (Leaflet or lightweight SVG) with animated great-circle arcs. It reuses the gateway data, so no second 3D scene. |
| Trust matrix (8) | Staggered reveal. Icons get a small lift on hover. |
| Barcode spotlight | Label card in 3D perspective (rotateY −12°) that straightens as it scrolls into view, with a scan-line sweep over the barcode once. |
| Commitments | Fade and slide between the three statements. |
| Modes strip | Slow, continuous marquee (pauses on hover and for reduced motion). |
| Callback banner | Background gradient drifts slowly (CSS only). |
| FAQ | Smooth height animation (`grid-template-rows: 0fr → 1fr`). |

### Other pages
- **All page heroes:** background parallax (0.2) + headline stagger.
- **Services:** tier selector cards tilt. Switching tiers slides the spec panel horizontally with depth (translateZ).
- **Locations:** map arcs animate on load. Gateway cards reveal in a stagger and show local time live.
- **Track:** input field has a gentle focus glow. On submit → the existing `TrackingLoadingScreen`, restyled with a mini spinning globe drawn in **CSS/SVG** (no WebGL).
- **Track Result:**
  - Map container enters with a subtle 3D tilt (rotateX 10° → 0°) over 600 ms, then stays flat so Leaflet clicks stay accurate.
  - The vehicle marker pulses. Air/sea legs draw as dashed great-circle arcs, and the travelled part of the route is drawn solid.
  - Timeline events reveal in sequence. The latest event has a live pulse.
  - `ShipmentPassport` card: a 3D flip (rotateY 180°) shows the barcode and label on the back.
- **Quote / Ship:** step transitions slide with depth. The summary card stays sticky with a soft float.
- **Admin:** **no decorative motion.** Operators need speed. Only the functional transitions that already exist.

## 6. Globe implementation notes

- Component: `src/components/three/HeroGlobe.tsx`, loaded with `React.lazy` + `Suspense`. The fallback is the
  static `hero-globe-fallback.jpg` (same framing), so there's **no layout shift** when the globe loads.
- Load trigger: after `window.load` + `requestIdleCallback` (timeout 2 s).
- **Skip WebGL entirely and keep the image** when: reduced motion · `Save-Data` · `navigator.hardwareConcurrency <= 4`
  **and** `deviceMemory <= 4` · WebGL is unavailable · viewport < 360 px.
- Landmass dots: sample a tiny equirectangular land-mask PNG (≤ 20 KB) into ~8–12k points rendered as **one**
  `InstancedMesh` or `Points` (a single draw call).
- Arcs: `QuadraticBezierCurve3` with the control point raised by distance. `Line2` or thin tubes; the travelling
  pulse is a shader uniform (`uTime`), not new geometry.
- Canvas: `dpr={[1, 1.75]}`, `gl={{ antialias: true, powerPreference: 'low-power', alpha: true }}`,
  `frameloop="demand"` + invalidate on a rAF only while visible (IntersectionObserver) and the tab is visible.
- Colours come from CSS tokens (`--ngf-primary-*`, `--ngf-accent-*`) read once at mount.
- Accessibility: `aria-hidden="true"` on the canvas. Everything it conveys is also stated in the hero text.
- Dispose geometries and materials on unmount.

## 7. QA checklist for motion

- [ ] Reduced-motion on (OS setting): no movement except short fades, and the globe shows as a still image.
- [ ] Low-end Android: scrolling stays smooth; the globe falls back or holds ≥ 45 fps.
- [ ] iOS Safari: no scroll jank; Lenis disabled on touch; no `100vh` jumps (use `svh/dvh`).
- [ ] Tab hidden → the globe stops rendering (check DevTools Performance).
- [ ] No CLS from lazy content (reserve its space).
- [ ] Keyboard focus is visible on tilted cards; tilt never hides focus rings.
- [ ] Leaflet maps: wheel/drag works; no transform on the live map container after its entrance animation.

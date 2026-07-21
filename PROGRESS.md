# TechBBQ Visual Generator — Progress

Single living doc for picking the project back up. **Architecture** and
**Open work** sections matter most. Historical log at the bottom is for
context.

---

## What it is

Internal tool for the TechBBQ team to compose on-brand social-media visuals on
a multi-format canvas (square 1500×1500, presentation 1920×1080, Instagram
story 1080×1920, or custom). Users compose with text layers, vector shapes
(rectangle / circle / line / star), uploaded images (up to 10), and the
TechBBQ logo, on top of an animated liquid-metal background. Photoshop-style
multi-select, marquee, group drag, undo/redo, lock, group/ungroup, align,
distribute, z-order. Export to PNG or JPG at exact canvas resolution.

Live at `http://localhost:3000` during `npm run dev`. Production target is
Vercel; production branch is `master`.

## Stack

- **Next.js 16** (Turbopack, React 19, `reactCompiler: true`), Tailwind v4.
- **Radix UI** (popovers).
- **`@paper-design/shaders-react`** — animated WebGL liquid-metal backgrounds.
- **`html-to-image`** — PNG/JPG export + template thumbnail capture.
- **Sonner** — toasts.
- **Resend** — `/api/feedback` route only.
- Fonts: **Onest** and **Inter** (via `next/font/google`).

## How to run

```bash
cp .env.example .env.local        # fill in keys
npm install
npm run dev                        # localhost:3000
```

`RESEND_API_KEY` + `FEEDBACK_EMAIL` are used by the in-app Feedback button.

---

## Architecture

### Document state model (`src/types/template.ts`)

The whole design is one `DesignConfig` object kept inside a `DocSnapshot`
that bundles `{ format, customSize, design, canvasImages }`. The bundle is
managed by **`useUndoableDoc`** (history hook) and persisted to
`sessionStorage` under `tbbqvisualgen.session.v4` (**bump key on schema
changes**).

Element types stored inside the doc:

- **`TextElement`** — `id, content, fontSize, position {x,y}, color, gradient, weight, italic, uppercase, letterSpacing, lineHeight, rotation, opacity, blur, align, hidden, locked, font ("onest" | "inter"), groupId`.
- **`CanvasImage`** — `id, src, x, y, width, height, cornerRadius, border, borderColor, borderWidth, crop {x,y,w,h}, naturalWidth, naturalHeight, hidden, locked, groupId`. Lives in `design.canvasImages` array (separate from `design` for batched-update reasons).
- **`ShapeElement`** — `id, type ("rectangle" | "circle" | "line" | "star"), x, y, width, height, fillType ("fill" | "outline"), strokeWidth, colorType ("solid" | "gradient"), color1, color2, opacity, blur, rotation, borderRadius (rect, number or per-corner), spikes/innerRadius (star), hidden, locked, groupId`.
- **`design.layerOrder`** — array of stable layer-ids (bottom→top), reconciled against the actual elements via `reconcileLayerOrder()` so missing/new entries land predictably.
- Background, color overlay, TechBBQ logo are part of `design` (not arrays).

### Selection model

Single source of truth: **`selectedIds: Set<string>`** in `page.tsx`. Layer ids
use the convention `text:<id>` / `image:<id>` / `shape:<id>`. Marquee selection
+ click-select both pipe through `selectWithGroup`, which auto-expands to all
group members if the clicked element has a `groupId`. The compat shim
`selectedImageId` (derived; non-null only when exactly one image is selected)
keeps the old single-image components working.

### Undo / redo (`src/hooks/useUndoableDoc.ts`)

History stored INSIDE the state object (`past`, `present`, `future`,
`txDepth`, `txPushed`) so every reducer call is pure and React 19's compiler
+ StrictMode can't desync it. Cap = 10 entries. Continuous edits (drags,
slider ticks, color-picker drags, arrow-key nudges) are wrapped in
transactions via `beginTransaction()` / `endTransaction()` so the whole
streak collapses into one undo step.

Transactions are opened/closed by:
- Drag handlers in `ImageDragOverlay`, `ShapeDragOverlay`, `DynamicTemplate`'s text + logo handlers.
- A global pointer listener on `<input type="range">` and `<input type="color">` so slider/color-picker drags transaction without per-component wiring.
- Arrow-key nudge debounces over 400ms.

### Canvas DOM hierarchy

```
previewContainer (auto-scales)
  └── canvasWrapRef (= page-level fixed-size frame, dims.width × dims.height)
       ├── exportRef (the thing html-to-image captures)
       │    └── <DynamicTemplate />
       │         ├── liquid-metal shader background
       │         ├── color overlay
       │         ├── canvas images (one <div><img/></div> each)
       │         ├── shape elements (div or <svg>)
       │         ├── text elements (contentEditable divs)
       │         └── TechBBQ logo
       ├── grid overlay (100×100 SVG, behind elements visually but pointer-events:none)
       ├── marquee rectangle (visible during drag)
       ├── snap-guide lines (orange, live during drag)
       ├── overflow bars (red on edges, on text overflow)
       ├── lock badges (orange 🔒 on every locked element)
       ├── crop-edit UI (when an image is in inline crop mode)
       ├── ImageDragOverlay (one per image — bbox + 4 resize handles)
       └── ShapeDragOverlay (one per visible shape — bbox + handles; SVG hit-test for outline shapes)
```

Important: **everything outside `exportRef` never appears in PNG/JPG output**.
That's how marquee, snap guides, lock badges, grid, overflow bars stay out of
the final image.

### Canvas elements: data attributes

Every interactive canvas element carries:
- `data-canvas-element="<layer-id>"` — used by marquee selection (DOM-query
  for bbox intersection) and by the right-click handler to identify which
  element was clicked.
- `data-locked="true"` (when locked) — used by some hover hints.
- ImageDragOverlay containers carry `data-canvas-overlay="image"` so the
  marquee handler skips clicks on corner handles.

### Group drag

`beginGroupDrag(draggedId)` snapshots **pre-drag center positions** for every
selected element (skipping locked ones) into `dragOriginsRef`. Each move tick
calls `groupDragMoveBy(dx, dy)` which adds the delta to every snapshotted
origin in one `setDoc` call (= one undoable entry). Auto-selects the dragged
element if it wasn't in the selection.

### Inline crop (Google Slides–style)

Stored crop is in source-fractions of the natural image (`x, y, width,
height`). On crop entry, `cropSnapshot` state captures the render geometry so
the image stays at a fixed scale while the user pans / resizes the crop
window. 4 corner handles + a pan area inside the orange outline. Aspect is
locked to `frameAspect / sourceAspect` so the in-canvas frame size doesn't
distort. Click outside canvas / Esc / drag another element exits.

### Snap / align

Shared `src/lib/snap.ts` is used by text drag, image drag, shape drag, and
logo drag. Targets = canvas edges + thirds + every OTHER selected element's
edges/centers. Threshold ≈ 0.8% (≈12px on 1500). Orange guide lines render
during drag, outside `exportRef`.

### Backgrounds

18 liquid-metal presets in `src/components/CanvasBackground.tsx` — one shader
family with different colors / shapes / motion. Picker thumbnails are
**static CSS gradients** (no WebGL) so 18 thumbnails + 1 main canvas don't
exceed the browser's ~16-context limit.

### Templates (`src/hooks/useTemplates.ts`)

Saved to `localStorage` under `tbbqvisualgen.templates.v1`. Each template has
a small PNG thumbnail (captured via `html-to-image` at pixelRatio 0.18). Save
/ load (undoable — uses `setDoc` not `replaceAll`) / rename (inline edit) /
delete (two-click confirm). ~50–80 templates fit in the 5MB localStorage cap
for typical text-heavy designs.

### Left tool tabs (was a wizard — de-wizared 2026-07-02, branch `ux-p1-dewizard`)

The left column is now a **persistent tab bar** (`Stepper.tsx`, `role="tablist"`/`role="tab"`/`aria-selected`), not a linear wizard. The old `StepNavigator` (Back / "Step X of Y" / Next + its export button) was **removed** — every tool is one click away, random-access. Tabs still switch the active panel via `goToStep`/`currentStep`, and auto-switch on canvas selection still works.

The 4 tabs + auto-switch on canvas selection:
1. **Canvas** — format, background picker (18 presets), color overlay.
2. **Text** — add/manage text layers (font picker Onest/Inter, font-size dropdown + free input, color picker, weight, alignment, italic/uppercase/gradient toggles, line height, rotation, opacity, blur sliders).
3. **Images** — TechBBQ logo on/off + style; batch image upload (up to 10), per-image controls (size sliders, corner radius, border color + stroke width input, crop).
4. **Elements** (was "Shapes" — renamed 2026-07-02; holds photo slots + shapes) — Add-photo-slot + 4 shape add buttons + per-shape editor (fill/outline, solid/gradient color, stroke, opacity, blur, rotation; rect-only linked/unlinked per-corner radius; star-only spikes + inner radius).

Clicking a canvas element auto-switches the wizard to its matching step and
expands the row in the editor. Manual step nav is sticky after that.

### Export (header, persistent — moved here 2026-07-02)

Primary **Save image** button + PNG/JPG radiogroup toggle live top-right in the
header, always visible (wired to `handleExport()` / `setExportFormat`; disabled
when `canvasIsEmpty` or `isExporting`). Export is no longer gated behind a
wizard step. The old duplicate JPG-only quick-save Download button was removed
from the canvas controls strip. `⌘E` still exports with the selected format.

### Layers panel (docked, persistent — was floating; 2026-07-02)

`showLayers` now defaults **true**. The panel is a persistent `<aside>` third
column in the main content flex row (was an absolute floating element over the
canvas). The strip Layers toggle collapses/expands it; the old
click-outside-to-close effect was removed. A **`ResizeObserver` on
`previewContainerRef`** rescales the canvas when the dock toggles (window-resize
alone didn't catch the width change).

### Canvas controls strip (above the preview)

Left → right: Undo · Redo · Grid toggle · Align popover ·
Layers toggle · Pause/Resume animation. The grid is a 100×100 SVG overlay
(pure visual aid, never exports). Align popover handles align-to-canvas
(single-select) or align-to-selection-bbox (multi-select) + distribute
horizontally/vertically (≥3 selected).

### Templates modal

Header → "Templates" button (badge shows count) → modal with name + Save +
template grid (thumbnail · click loads · inline rename on name click · trash
with confirm-tick).

### Right-click context menu (unified)

Sections separated by hairlines, all with keyboard hints:
1. Duplicate (⌘D)
2. Bring forward (⌘]) · Bring to front (⇧⌘]) · Send backward (⌘[) · Send to back (⇧⌘[)
3. Group (⌘G — when 2+ selected) · Ungroup (⇧⌘G — when any selected is in a group)
4. Lock/Unlock · Delete

The handler reads `target.closest('[data-canvas-element]')` synchronously so
right-clicking an unselected element selects the right thing without waiting
for React state to commit.

### Keyboard shortcuts

- **⌘Z / ⇧⌘Z** — undo / redo.
- **⌘C / ⌘V / ⌘D** — copy / paste / duplicate (in-memory clipboard, separate from OS clipboard).
- **⌘G / ⇧⌘G** — group / ungroup.
- **⌘] / ⌘[** — bring forward / send backward.
- **⇧⌘] / ⇧⌘[** — bring to front / send to back.
- **Backspace / Delete** — delete (skips locked).
- **Esc** — clear selection (or exit crop mode if active).
- **Arrow keys** — nudge 1px; **Shift+Arrow** — nudge 10px.
- **⌘E** — export with the currently-selected format (PNG/JPG).
- **Shift while resizing** — lock aspect ratio.
- **Alt while resizing** — scale from center.

Keyboard shortcuts are skipped when the user is typing in an `<input>` /
`<textarea>` / `contentEditable` so character-level Cmd+Z, Cmd+C, etc. still
work in fields.

### Locking

Toggle via the **Lock 🔒 icon in each Layers panel row** OR right-click → Lock.
Locked elements:
- Have `data-locked="true"` on their canvas DOM.
- Show an orange 🔒 badge in the top-left corner on canvas (outside `exportRef`).
- Are **still selectable** (mousedown selects, marquee includes them, Layers panel click selects).
- **Can't be dragged** — drag handlers bail after selecting.
- **Can't be deleted** by Backspace.
- **Group-drag skips them** (origins map excludes locked).
- **Outline-only rect/circle shapes** use SVG hit-test so the hollow interior is click-through (only the stroke catches clicks).

### Export pipeline (`src/hooks/useExport.ts`)

Captures `exportRef` via `html-to-image` (toPng / toJpeg). JPEG flattens
alpha onto `#15110e`. Background animation auto-pauses for the capture and
resumes after. Two passes — first warms up font loading, second captures.

---

## File map

| Path | What it does |
|---|---|
| `src/app/page.tsx` | Root state + handlers + selection + clipboard + group/lock/align/reorder/nudge + right-click menu + grid + canvas wrap + step nav. **The big one.** |
| `src/app/layout.tsx` | Onest + Inter font loading, root layout. |
| `src/types/template.ts` | All element types + `DEFAULT_DESIGN` + `BACKGROUND_OPTIONS` + `reconcileLayerOrder` + `newTextElement` / `newShapeElement`. |
| `src/lib/constants.ts` | `COLORS`, `FONTS`, gradient CSS, `CANVAS_FONT_OPTIONS`. |
| `src/lib/snap.ts` | Shared snap-to-align math. |
| `src/hooks/useUndoableDoc.ts` | History hook (pure state, transactions). |
| `src/hooks/useTemplates.ts` | Templates save/load/rename/delete + localStorage + thumbnail capture. |
| `src/hooks/useExport.ts` | PNG / JPEG export. |
| `src/components/templates/DynamicTemplate.tsx` | Canvas renderer — background, overlay, images, shapes (renderShapeElement), texts, logo, inline crop UI, text drag handler. |
| `src/components/ImageDragOverlay.tsx` | Image bbox + 4 resize handles + select/drag + Shift/Alt resize modifiers. |
| `src/components/ShapeDragOverlay.tsx` | Shape bbox + handles. Outline rect/circle use SVG `pointer-events:stroke` hit-test. |
| `src/components/ImagePlacer.tsx` | Image upload (batch up to 10), per-image controls (crop, radius, border color + stroke width). |
| `src/components/ColorPicker.tsx` | Color popover with TechBBQ brand row + recents row + free input. |
| `src/components/BackgroundPicker.tsx` | 18-cell static-gradient picker. |
| `src/components/CanvasBackground.tsx` | `BG_REGISTRY` (configs) + `CanvasBackground` (live shader) + `BackgroundThumbnail` (CSS gradient). |
| `src/components/LayersPanel.tsx` | Reorder-drag, eye, lock, duplicate, trash. Includes shape rows. |
| `src/components/TemplatesModal.tsx` | Saved-template grid + save/load/rename/delete. |
| `src/components/CropDialog.tsx` | Legacy modal crop tool (still works; inline crop in DynamicTemplate is primary). |
| `src/components/steps/StepCanvas.tsx` | Format + background + overlay. |
| `src/components/steps/StepText.tsx` | Text layers + per-text editor (size dropdown + input, font, color, weight, align, italic, line-height, rotation, opacity, blur). |
| `src/components/steps/StepImages.tsx` | Logo + images upload area. |
| `src/components/steps/StepElements.tsx` | Shape add buttons + per-shape editor. |
| `src/components/Stepper.tsx`, `StepNavigator.tsx`, `FormatPicker.tsx`, `OverlayPicker.tsx`, `FeedbackButton.tsx`, `LiquidMetalBg.tsx` (deleted), `GlassCard.tsx`, `AnimatedGradient.tsx` | Glue UI. |

---

## Conventions

- **Verify-after-ship rule**: after any user-facing change, launch a verification agent to trace the wiring end-to-end before reporting done. Strict — only skip for pure config / typo edits.
- **STORAGE_KEY bumping**: bump `tbbqvisualgen.session.v4` if the doc schema changes incompatibly. Hydrate code merges `{ ...DEFAULT_DESIGN, ...saved.design }` so additive optional fields work without a bump.
- **Coords are fractional (0–1, center-anchored)** unless explicitly suffixed `Px`. Width/height too. Convert at the canvas-render boundary.
- **Outside exportRef pattern**: anything that's purely a UI aid (marquee, snap guides, lock badges, grid, drag overlays) is rendered as a SIBLING of `exportRef`, never inside it. Otherwise the PNG export would capture it.
- **Pointer-down patterns**: drags use a click-vs-drag threshold (4px). Pointer-down captures the start ref; pointer-move sets `dragging=true` only after the threshold so a click without movement doesn't accidentally commit a position change.

---

## Dormant code

- `/api/generate` — OpenRouter / Claude endpoint for an AI chat. Not wired into the UI right now. Live endpoint, dormant features.
- MP4 export in `useExport.ts` (`exportMp4`) — works, no UI button. Adobe-style "export as video" if anyone wants it.
- `CropDialog.tsx` — original modal crop. Still wired in ImagePlacer ("Crop image" button). The inline crop in DynamicTemplate is the Google Slides–style one we built later; both coexist.

---

## Open work / suggested next steps

In rough priority order. **Top priority is first-run intuitiveness** (Auri, 2026-07-02): everything below the P0 block is secondary to making the cold entry make sense.

**P0 · First-run flow (from a live cold-run walkthrough, 2026-07-02; branch `ux-p1-dewizard-notes`, since merged to master 2026-07-21 and deleted).** Ran the app and walked the empty-session entry + all 4 tabs. Status per finding:

1. **Templates showed in three places at once.** DONE — removed the duplicate preset list from the Canvas tab (now Format + Background + Logo + Overlay only); the empty-canvas gallery is the single start door.
2. **Gallery overlay was see-through over the animated bg.** DONE — added an opaque scrim (`bg-black/65 backdrop-blur`).
3. **Empty-canvas placeholder text was illegible.** DONE — placed the copy in a dark blurred pill so it reads over the bright bg.
4. **Scary variant-badge / "no variant yet" metadata.** Mostly resolved as a side effect of #1 (the noisy list is gone from the Canvas tab). Re-check if it resurfaces in the gallery.
5. **Placeholder preset names ("Preset 3", "Panel 4").** MOOT — all built-in presets cleared (clean slate, `PRESETS = []`); the team authors + ships its own.
6. **Format was buried.** DONE — Format now leads the Canvas tab (after removing the template list).
7. **Layers panel docks open on an empty canvas.** STILL OPEN — default it closed until ≥1 user layer.
8. **Overlapping start/reset vocabulary** (`New` / `Start blank` / `Browse templates` / `Start over`). STILL OPEN — consolidate.
   - Walkthrough + verification screenshots live in the job tmp dir (`shots*/`), not committed.

**P2 · Naming + onboarding.** DONE (2026-07-02): "Shapes" tab → **"Elements"**; removed all decorative `▪` section bullets across step files + TemplatesModal + CropDialog. STILL OPEN: folded into P0 above (preset naming, variant-badge noise, template/preset vocabulary).

**P3 · Accessibility (WCAG 2.2 AA).** DONE (2026-07-02): semantic landmarks (header/main/aside); contrast bump on 120 low-opacity text classes (14 files); focus-visible rings on all 13 inputs. STILL OPEN (below P0 now): empty-canvas overlay contrast (see P0 #3); keyboard layer reorder + keyboard path to canvas selection; `TemplatesModal` `role="dialog"` + Esc + focus trap (move all 3 modals to Radix Dialog); promote glyph-free section labels to real `<h2>/<h3>` headings.

**Feature backlog (all below the P0 first-run work):**

1. **Image effects parity** — rotation, opacity, blur sliders on uploaded images (texts have them; images don't).
2. **Custom background image** — upload your own image as canvas background (with scale + X/Y position), separate from regular image layers.
3. **Solid + gradient backgrounds** — two-color gradient with angle alongside the liquid-metal presets.
4. **Smart guides** — pink lines popping in during drag when an edge/center matches another element's edge/center. The snap math is there; just needs visual feedback during drag.
5. **Zoom + pan + fit** — ⌘+ / ⌘- / ⌘0 and space-bar pan. Currently the preview is fixed-fit.
6. **Blend modes + opacity in Layers panel** — per-row blend mode dropdown + opacity slider, photoshop-style.
7. **Eyedropper** — pick a color from anywhere on canvas, or from a previously-saved color.
8. **Keyboard shortcut cheatsheet** — `?` opens an overlay listing every shortcut.
9. **Star outline hit-test** — currently star outline catches clicks anywhere in bbox (rect/circle outline already SVG hit-test).
10. **Group resize** — when a group is selected, optionally show a single bbox + handles that scale all members proportionally.
11. **Export presets** — render the same design as Square + Story + Presentation in one click.

---

## Verified-shipped features (chronological hits)

Newer at the top.

**Session 2026-07-21 (branch `quick-templates-partner` — UNCOMMITTED, awaiting Auri's review).** Housekeeping first: `ux-p1-dewizard` + `ux-p1-dewizard-notes` were already merged into `master` on GitHub (from the MacBook, through commit 3862941); local fast-forwarded, both branches deleted local + remote. `master` is the only long-lived branch again. Then, per Agentation feedback:

- **Renamed "Panel Maker" → "Quick Templates"** — the `/simple` page `<h1>` and the main editor's header button (`src/app/page.tsx` ~line 1305). Name chosen by Auri.
- **New "Partner Announcement" template on `/simple`.** A Template switcher (Panel · Partner Announcement) now leads the sidebar. Partner form: Label field (prefilled "Partner Announcement"), logo dropzone, shared Format + Background. Canvas: white label chip top-center, partner logo contain-fit dead-center (`fit: "contain"` existed already; gradient-outline placeholder before upload), TechBBQ logo bottom-center. `buildPartnerDesign()` in `src/lib/simpleLayout.ts` (+ `PartnerForm`, `emptyPartnerForm`); page wiring in `src/app/simple/page.tsx` — persisted inside the same `tbbqvisualgen.simpleForm.v1` blob (`template` + `partner` fields), quota fallback strips the logo dataURL, and the tuned/parked machinery applies unchanged because the partner doc is a normal `SimpleDoc`.
- **Evidence:** tsc clean, 21/21 vitest snapshots pass (panel layout untouched), changed files eslint-clean, driven in Playwright (template switch, SVG logo upload, 1:1 + 16:9, switch back to Panel with content intact, zero console errors).
- **Gotchas:** (1) A stale `.next` cache from May broke `npm run dev` after pulling the MacBook commits — Turbopack resolved `tailwindcss` from the PARENT dir; `rm -rf .next` fixed it. (2) `panelShapeKey` for a partner doc is `format|WxH|label`, which collides with an all-empty panel that has only a label — harmless (an empty panel has no tuning worth keeping) but know it exists.
- **Round 2 (same day, after Auri's live feedback):**
  - **BUG FIX — logo upload vanished under a fine-tuned override.** `retargetTunedDoc` only moves WORDS across, so with a tuned doc active an image change (upload/swap/remove) had no layer to land on and was silently dropped — Auri uploaded a logo and kept seeing the placeholder. Fix: retarget now also compares the two docs' `canvasImages` src sets and returns null on mismatch → the tuned doc gets parked and the layout rebuilds with the new image. Also fixes the same latent bug for panel headshot changes. `panelShapeKey` now includes `imgs:<count>` so with/without-photo compositions park separately (side effect: pre-existing parked entries won't revive once — cosmetic).
  - **No border on uploaded logos** — confirmed none exists (`border: false`, no backdrop); the frame Auri saw was the empty-slot placeholder rendered by the stale tuned doc (the bug above).
  - **Two partner layouts:** `PartnerForm` restructured to `{ layout: "single" | "quad", logos: (PartnerLogo | null)[] }` — One logo (big, centered) or Four logos (2×2 contain-fit grid, block-centered). `LogoSlot` component extracted in `page.tsx`; hydrate migrates the short-lived single-`logo` persisted shape. Verified in Playwright: quad grid renders (borderless logo + placeholder frames), and the exact broken flow (editor round-trip → tuned banner → upload logo) now shows the logo. tsc + 21/21 tests + eslint clean, zero console errors.
- **Round 3 — BUG FIX: every SECOND fine-tune reverted.** Auri: "I adjust, go back and it reverts to the previous position." Repro'd with a scripted Playwright double round-trip (drag logo in editor → back): round 1 stuck, round 2 came back at round 1's position. Cause: `/simple`'s mount effect runs twice in dev (StrictMode). Run 1 adopts the editor's doc from sessionStorage and consumes the handoff flag; run 2 finds no flag, takes the else branch and restores `CUSTOM_KEY` from localStorage — which still held the PREVIOUS tuning and overwrote the fresh adoption. First-ever tune survived only because `CUSTOM_KEY` was empty. Fix: the adopt branch now writes the adopted doc to `CUSTOM_KEY` synchronously, making the effect idempotent. Verified: same scripted double round-trip now keeps both adjustments ((1502,468) → (1709,468) instead of reverting). tsc + tests still green.
- **Round 4 — BUG FIX: background picker dead while fine-tuned.** Same family as the logo bug: `retargetTunedDoc` returned the tuned doc's whole `design`, so a `backgroundId` change was swallowed. Retarget now carries `rebuilt.design.backgroundId` across (background is a form choice, not a hand-placed layer). Verified: with the tuned override active, clicking Honey Glow switches the canvas (orb5 → lm1) while the tuned logo position and banner survive.
- **Round 5 — quad reorder + 2026-season image backgrounds.**
  - **Logo position switching (quad):** filled slots get ‹ › overlay buttons that swap with the neighbouring cell (order: top-left → top-right → bottom-left → bottom-right; works into empty cells = "move there"). Needed structural identity: new `CanvasImage.simpleRole` ("logo-0"…"logo-3", "logo-single") set by `buildPartnerDesign`; `retargetTunedDoc`'s imageKey and `panelShapeKey` now include the roles, else a swap or single↔quad switch reused the same srcs and the tuned override swallowed it (found live: swaps did nothing while tuned). Verified: logo walks all 4 cells on canvas.
  - **4 static image backgrounds** ("New styling", leading the group): Molten Gold / Flame Wash / Signal Red / Berry Glow, official 2026-season exports copied to `public/backgrounds/season-*.jpg` (1191×840, ~800KB each). New `IMAGE_BG_REGISTRY` in `CanvasBackground.tsx` renders them as a cover-fit `<img>` (export-safe, no WebGL context cost); thumbnails use the image itself. IDs `season1–4` in `BACKGROUND_OPTIONS`.
  - **Gotcha:** a literal `\x00` byte had landed inside `retargetTunedDoc`'s `join(" ")` string (tsc/tests still passed!) — Grep flagging the file as binary was the tell; patched byte back to a space.
- **Round 6 — TEAM LIBRARY (branch `team-library`, needs env setup before merge).** Auri hit the "saved is only localStorage" wall (incognito showed nothing) → decided: real database. Neon Postgres (Vercel Marketplace) + Auth.js v5 Google SSO gated to verified `@techbbq.org` + ONE shared team library.
  - **Backend:** `src/auth.ts` (Google provider, domain gate in signIn callback), `src/lib/db.ts` (neon client, `library_items` table auto-created, CRUD), `src/lib/libraryApi.ts` (per-user in-memory rate limit 30/min, body validation, 4MB cap → clear 413, safe errors with ref id per r20), routes `/api/library` (GET list, POST) + `/api/library/[id]` (GET/PUT/DELETE, UUID-validated). Fails CLOSED: no session → 401 (verified via curl), no DATABASE_URL → 503 "not configured".
  - **UI:** `src/components/TeamLibrary.tsx` modal (list / save current design / load / delete; unauthenticated → Google sign-in prompt, verified in Playwright). "Team library" button in the `/simple` header. Load = adopt as `custom` override (renders exactly as saved; safe — the rebuild effect early-returns on unchanged form key).
  - **SETUP NEEDED (Auri, ~10 min, before merging this branch):** 1. Vercel dashboard (personal acct) → tbbqvisualgen → Storage → create Neon Postgres (sets `DATABASE_URL`). 2. Google Cloud Console → OAuth client (or add redirect URIs to the tbbq-tools client): `https://tbbqvisualgen.vercel.app/api/auth/callback/google` + localhost variant → set `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET` in Vercel env. 3. `npx auth secret` → set `AUTH_SECRET`. 4. Copy the same 4 vars into `.env.local` for dev. `.env.example` documents all of it (gitignore now un-ignores it).
  - Editor (`/`) Templates modal still localStorage — port to the library later if the team wants it.
- **Round 7 — production config debugging + stage backgrounds (all LIVE on prod by end of day).**
  - **Team library IS live and configured on production.** Env vars verified server-side via a temporary `/api/authcheck` endpoint (booleans + lengths only, removed after): the one missing var was `AUTH_SECRET`; once added, `/api/auth/providers` serves the Google config and Google accepts the OAuth request (checked by replaying the server's 302 redirect with curl). Auri's local test rows ("Panel with 4 People", "Partners") confirmed in Neon.
  - **ROOT CAUSE of all-day "deploys not appearing": Vercel's production branch was NOT `master`.** Every git push built as a PREVIEW; Production only updated on manual dashboard rebuilds. Fixed in project settings (production branch → master); since then pushes auto-deploy to Production with no nudges. The morning's "empty-commit fixes" were coincidence (Auri clicking Redeploy at the same time). Also seen in the deployments list: MacBook branch pushes show "Blocked" = the Vercel Hobby commit-author block (existing lesson).
  - **4 per-stage backgrounds** ("Stages" group, leads the picker): Tech/BBQ/Bonfire/Founder Stage, from `TBBQ/2026 Season/Prints/1x`, as `public/backgrounds/stage-*.jpg` — pick the stage the panel runs on.
- **Next steps:** 1. Auri reviews `/simple` visually (chip/logo-box sizing tweaks likely).
- **Next steps:** 1. Auri reviews `/simple` visually (chip/logo-box sizing tweaks likely). 2. Commit on this branch, merge to master when approved (master auto-deploys via Vercel). 3. Still-open P0 items from 07-02: Layers panel should default CLOSED on an empty canvas; consolidate New/Start blank/Start over vocabulary.

**Session 2026-07-06 → 07-08 (branch `ux-p1-dewizard-notes`).** Panel Maker polish: multi-format correctness, wrapping, sample defaults, and a two-way round-trip with the advanced editor. All tsc + eslint clean; verified in headless Chrome. Touches `src/app/simple/page.tsx`, `src/lib/simpleLayout.ts`, `src/components/templates/DynamicTemplate.tsx`, `src/components/ImagePlacer.tsx`, `public/samples/`.

- **Multi-format layouts (the big fix).** Fonts are now sized off the SHORTER side `S = min(W,H)`, and every vertical text advance is scaled by `vs = S/H`. Root cause of the broken 16:9 / 9:16 output was mixing width-based font sizes with height-based positions. Square (S=W=H, vs=1) is byte-identical to before; the others are corrected. Each format gets the layout that suits it: **square → diagonal panel** (big moderator, caption right, speakers stepping up — the reference), **16:9 → level row** (moderator a touch bigger, captions above), **9:16 → filled grid** (moderator marked, speakers labelled). Landscape/portrait detected via `W > H*1.2` / `H > W*1.2`.
- **Word-wrapping (`wrapToWidth`).** Names/titles/companies wrap to the card/caption width instead of overflowing into neighbours (long names were colliding). Caption blocks measure wrapped line counts for correct spacing.
- **Photo bottom-scrim.** New `CanvasImage.scrimBottom` (0–1) → a subtle black gradient fading up from the photo bottom (rendered inside the clip in `DynamicTemplate`), so overlaid labels/text stay legible. Replaced the old harsh solid band (kept only for photo-less placeholders). Role labels (MODERATOR/SPEAKER) are shadowed text via `TextElement.shadow`, softened this round.
- **Session-label chip polish.** Rounded-rectangle chip (not pill); asymmetric padding (text left, more room right); near-normal letter-spacing; optically centred caps; width accounts for letter-spacing.
- **Sample defaults + photos.** `emptyForm()` now returns a pre-filled sample panel (Continuation Capital … / Pierre Leroy moderator + Andrei/Nicholas/Omolade) so there's no retyping. Four headshots live in `public/samples/*.jpg` and are referenced by URL (NOT base64-embedded — keeps source lean). Headline multi-line via a textarea (Enter = new line); photo remove "×" is now a corner icon on the thumbnail.
- **Round-trip with the advanced editor (`/simple` ↔ `/`).** "Edit & fine-tune" writes the doc to `sessionStorage["tbbqvisualgen.session.v4"]` **and** sets `tbbqvisualgen.simple.handoff`. On returning to `/simple`, it adopts the editor's saved (edited) doc as a `custom` override, renders/exports THAT, and shows a "Fine-tuned in editor · Revert" banner — so manual tweaks (e.g. nudging the label) persist back into the simple panel. The override is kept in `tbbqvisualgen.simple.custom`. Any form/format edit drops the override (baseline-ref compare, StrictMode-safe) and rebuilds from the form. Clicking a **format button always clears the override** (so 1:1 etc. can't get "stuck" while fine-tuned). Verified adoption end-to-end via a seeded-sessionStorage redirect test.

**Session 2026-07-03 (branch `ux-p1-dewizard-notes`).** Panel Maker (`/simple`) reworked to match Auri's two hand-made references (a moderator "Panel Discussion" and a no-moderator "Speakers" grid). All tsc-clean, verified in headless Chrome (`--headless=new --screenshot`; iterate by temporarily seeding `emptyForm()` then reverting). Touches `src/app/simple/page.tsx`, `src/lib/simpleLayout.ts`, `src/types/template.ts`, `src/components/templates/DynamicTemplate.tsx`.

- **Setup selector drives the composition.** New `includeModerator` flag on `SimpleForm` + a "Setup" card with a **moderator toggle** and a **speaker-count stepper (1–9)**. The layout now renders from the *selection*, not from which fields are filled — so choosing "moderator + 3 speakers" immediately shows the full wireframe (placeholder cards with role labels), then you fill names/photos. `buildSimpleDesign` gates `moderator = form.includeModerator ? … : null` and renders all `form.speakers` slots.
- **Two auto-layouts** (replaced the old single equal-row):
  - **Moderator present → panel:** big moderator card left with its caption to the RIGHT; speakers step gradually UPWARD to the right (diagonal cascade, NOT a grid — this reverses the 2026-07-02 "deliberately not applied" note, per Auri), each caption ABOVE its card. Portrait, un-squished cards (~0.9 w:h).
  - **No moderator → speakers grid:** up to 3 columns filling the height, name + "title, company" **overlaid** on each photo over a dark scrim.
- **Role labels** (MODERATOR / SPEAKER) are now **shadowed white text with NO background chip** (was a white pill). Needed a new **`TextElement.shadow`** (CSS `text-shadow`), applied in `DynamicTemplate`.
- **Photos:** 2px brand-gradient border (reuses the existing gradient-border render); empty people → gradient-outline placeholder frame.
- **Header text:** flowed top-down + adaptive so a **multi-line headline** never collides (Headline field is now a textarea, Enter = new line, auto-fits per line so a broken title renders bigger). **Subtitle** smaller but higher-contrast (weight 500, 95% white). **Session label = rounded-RECTANGLE chip** (not a pill), asymmetric padding (text nudged left, more room right), width accounts for letter-spacing so text never crowds the edge.
- **Form UX:** field order Headline → Subtitle → Session label; `PersonEditor` compacted to a horizontal card (rounded-SQUARE photo thumb, photo-remove "×" overlaid on the image corner, title+company on one row); responsive — the whole `/simple` layout stacks to one column below `lg`, header wraps.
- **"Edit & fine-tune" hand-off:** the header button writes the current composition to `sessionStorage["tbbqvisualgen.session.v4"]` (`{format,customSize,design,canvasImages}`) then navigates to `/`, which hydrates it — so you compose in easy mode, then drag/tweak freely and export in the full editor. This is the "edit it yourself then save" capability (reuses advanced drag+export). NOTE: it overwrites the advanced editor's current session (intended compose→refine flow).
- **Deferred (Auri, 2026-07-03):** the full template pipeline (create named templates in advanced → reuse in easy with only words+pictures). Using the hand-off for now; revisit later.

**Session 2026-07-02 (branch `ux-p1-dewizard-notes`, PR #1 → `master`, draft/unmerged).** Built on top of the P1 de-wizard commit. All items tsc-clean, verified in headless Chrome:

- **`/simple` "Panel Maker" (new page + `src/lib/simpleLayout.ts`):** form-driven simplified generator that reuses the renderer + export. Fields: session label, headline, subtitle, one moderator + N speakers (add/remove) each with name/title/company + optional headshot upload; format 16:9/1:1/9:16, background picker, live preview, PNG/JPG export. Layout matches the hand-made house style (from Auri's exported `preset2`): everything LEFT-aligned; **session label = white pill with dark uppercase text**; headline (600, auto-fit to width) + subtitle (400); rounded-rect PORTRAIT headshot cards (photos → rounded images, empty → placeholder frame); name (600) + title + company (400) beneath each; card height capped so photo+text clear the logo on 16:9; logo bottom-left. Header links to `/` (Advanced editor); the main editor header has a **"Panel Maker"** button → `/simple`. Deliberately NOT auto-applied: the teal color overlay + the scattered-diagonal photo arrangement (both were one-design specifics).
- **Formats reframed to the 3 share targets:** `16:9 Full HD (1920×1080)`, `1:1 Square (1500×1500)`, `9:16 Story (1080×1920)`, Custom — labels + order only (dimensions already matched). Dropped "Presentation"/"Instagram Story".
- **Clean-slate presets:** removed all 5 built-in panels; `PRESETS = []`. Ship your own via "Copy code" in the Templates modal → paste into `presets.ts`.
- **Anti-squish load safeguard:** loading a template opens the canvas at the format it was DESIGNED for (unless a variant exists for the current format), so a 16:9 layout no longer gets crammed into a 1:1 canvas across devices. (Screen size never squishes — canvas scales uniformly.)
- **Color picker rebuilt (`ColorPicker.tsx`):** removed the native `<input type=color>` OS dialog (its focus-steal broke the popover, caused the Windows error ding, and swallowed later clicks). Now fully in-DOM: brand swatches + recents + H/S/L range sliders + hex. Removed the focus-out guards that were only there for the OS dialog.
- **Paste-into-text fix:** editable text now pastes PLAIN TEXT only (`onPaste` → `insertText`). Was inserting the clipboard's rich HTML/background → could black out the canvas.
- **Image-drag lag fix:** the sessionStorage persist effect is now DEBOUNCED (~350ms). It was `JSON.stringify`-ing the whole doc — including each photo's multi-MB base64 `src` — on every pointermove, which was the real drag lag (pictures only). Also memoized `CanvasBackground` + pause it during drag.
- **SVG logos:** header + canvas + drag-overlay now use vector SVGs (`public/logo-{red,white,gradient,black,outlined-white}.svg`) instead of the PNGs (crisp at any scale + in export).
- **Group drag fix:** grabbing ANY grouped member (text included) now drags the whole group. Was asymmetric because shapes/images run `selectWithGroup` on click but text enters edit mode; `beginGroupDrag` now expands the dragged element to its group.
- **Selection polish:** dashed selection outline halved (4px → 2px); removed the 4px outline offset so the highlight hugs the element; canvas text is `user-select:none` except while editing (marquee no longer highlights text like a PDF).
- **"Snap to" toggle:** magnet button in the controls strip, ON by default; off = freeform placement (no snapping, no guide lines) for images/shapes/text/logo.
- **Editor-polish batch:** Templates-modal save buttons icon-only; compositional grid cells now SQUARE at any aspect (+ rule-of-thirds); default export = JPG; default background = orb ("Soft Ember"); text shows a move cursor (I-beam only in edit mode); crop-mode scale anchors sit on the whole image, not the frame.
- **Notes:** PROGRESS.md reprioritized to first-run intuitiveness (P0).

- **Template gallery empty state (2026-07-02, same branch `ux-p1-dewizard`):** new `PresetThumbnail.tsx` renders a static (no-WebGL) mini-preview of any preset (CSS-gradient bg + positioned text/shapes/slots). Empty canvas now shows a "Start from a template" gallery of `visiblePresets` cards; click loads (`handleLoadPreset`), "Start blank" dismisses to the plain placeholder (which has a "Browse templates" reopen button). `galleryDismissed` state gates it. Note: presets have no stored thumbnails — the preview is computed live from preset data, so it stays in sync automatically. tsc clean, serves 200.
- **P3 accessibility partial (2026-07-02, same branch `ux-p1-dewizard`):** semantic landmarks (header/main/aside), contrast bump on 120 low-opacity text classes (14 files), focus-visible rings on all 13 inputs. Compiles + serves 200, introduced 0 new lint errors.
- **P2 partial (2026-07-02, same branch `ux-p1-dewizard`):** renamed "Shapes" tab → "Elements"; stripped all `▪` decorative section bullets. Compiles + serves 200.
- **Known pre-existing lint (NOT from the UX work; present on `master`):** 10 `react-hooks/*` ESLint errors — `set-state-in-effect` in StepText.tsx:31, StepElements.tsx:33, useFolderOrder/useHiddenPresets/usePresetOverrides/useTemplates/useUserPresets; `rules-of-hooks` (conditional hooks) in LogoDragOverlay.tsx:126/171; `refs`-during-render in CanvasBackground.tsx:251. App compiles + runs regardless (React Compiler strict lint, not Turbopack blockers). Worth a dedicated code-health pass.
- **P1 UX restructure (2026-07-02, branch `ux-p1-dewizard`, not yet merged to `master`):** de-wizared the left column (persistent tool tabs, removed StepNavigator Back/Next), moved export to a persistent header button + PNG/JPG toggle (removed the duplicate strip Download), docked the Layers panel as a persistent right column (default open, ResizeObserver rescales canvas on toggle). Compiles clean, ESLint 0 errors, serves 200.
- Outline-shape hit-test (click only on stroke; hollow interior is click-through to elements below).
- Locked elements still selectable (mousedown selects, drag bails; marquee includes them; orange 🔒 badge on canvas + toast on lock/unlock).
- Layers-panel click-outside-to-close.
- Right-click on unselected element now selects that element synchronously (reads `data-canvas-element` instead of waiting on stale React state).
- Z-order shortcuts (`⌘]` / `⌘[` / `⇧⌘]` / `⇧⌘[`) + context-menu items.
- Shift / Alt resize modifiers (aspect lock / from-center) on both images and shapes.
- Group / Ungroup (`⌘G` / `⇧⌘G`) + context-menu.
- Text effects: line-height, rotation, italic, opacity, blur.
- Templates: save / load / rename / delete with localStorage + PNG thumbnails.
- Brand color palette + recent colors (cross-picker synced).
- Alignment + distribute popover (canvas-aware vs selection-aware target).
- Grid overlay toggle (100×100, never exports).
- Shapes step: full editor (rectangle / circle / line / star, fill/outline, solid/gradient, stroke, opacity, blur, rotation, per-corner radius for rect, spikes + inner radius for star) + drag/resize + Layers integration.
- Multi-image upload (up to 10) + per-image border color + stroke width input.
- Element locking (lock icon in Layers panel, right-click menu).
- Multi-select via marquee + group drag.
- Inline crop (Google Slides–style, with snapshot + 4 corner handles + smart aspect normalize).
- Undo/redo cap=10 with transactions, pure-state hook.
- 18 background presets (originally 9 LM + 9 wild → trimmed to 18 LM variants).
- 2 fonts (Onest + Inter) with picker per-text-layer.
- Auto-step-switch on selection.
- Save Image renamed export button, JPG/PNG toggle, in-canvas JPG quick-save.
- Custom logo position via drag (in addition to preset corners).
- Backspace deletes selection (skips locked).
- Cmd+C / Cmd+V / Cmd+D in-app clipboard + duplicate.
- Arrow-key nudge (1px / 10px with Shift), debounced into one undo step.

---

## Historical notes (so future-you doesn't accidentally restore them)

- We had 9 wild backgrounds (mesh, smoke, rays, voronoi, spiral, waves, halftone/dots, grain). User preferred only the liquid-metal aesthetic. They were removed and the registry was expanded to 18 LM variants instead.
- Background picker briefly used per-thumbnail WebGL with a sequential capture queue. Caused the main canvas's WebGL context to evict on tab switches → switched to static CSS gradients.
- Old fonts: Archivo (headlines) + Host Grotesk (subtitles). Replaced by Onest + Inter; `/public/fonts/` cleared.
- Earlier `useUndoableDoc` mutated refs INSIDE `setHistory` callbacks — broke under React 19's compiler + StrictMode (the second invocation took the wrong branch). Fixed by moving all transaction state INTO history state.
- Original right-click menu was per-image in `ImageDragOverlay`. Replaced by a unified page-level menu so all canvas elements use the same UI.
- Wizard had 5 steps once: Canvas, Text, Images, Style, Export. "Style" was merged into Canvas. "Export" became a button. Step 4 (Shapes) was added later.
- TechBBQ logo had a partner-logo concept once; removed entirely. Image upload step replaced it.
- `LogoPositionPicker.tsx` deleted — logo position is now drag-only on canvas plus preset corners via the Layers panel.
- Text used to default to UPPERCASE; changed to mixed-case default (toggle still works).

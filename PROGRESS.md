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

Three registries in `src/components/CanvasBackground.tsx`, all listed in
`BACKGROUND_OPTIONS` (`src/types/template.ts`, grouped for the picker):
`IMAGE_BG_REGISTRY` (static JPGs in `/public/backgrounds` — 2026-season
gradients + per-stage sets), `ORB_REGISTRY` (2D-canvas drifting orbs), and
`BG_REGISTRY` (18 WebGL liquid-metal presets). Picker thumbnails are static
(CSS gradients or the image itself, no WebGL) so thumbnails + main canvas
don't exceed the browser's ~16-context limit. New static background = drop
the JPG in `/public/backgrounds`, add one line to `IMAGE_BG_REGISTRY` and one
to `BACKGROUND_OPTIONS`.

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

**Session 2026-07-29, round 18 — SHIPPED to master (`929266e`, fast-forward, branch deleted, Vercel auto-deployed — `/samples/rajeev-kumal.jpg` verified 200 on prod) + export file names.** Auri's call to push. Then his naming spec for saved images: format first, then template, then the panel headline — `simpleExportName()` in `simpleLayout.ts` (pure, tested): panel → "1x1 - Panel - ‹headline›" (headline sanitized: newlines→spaces, illegal filename chars stripped incl. ":", fallback "1x1 - Panel"), partner → "16x9 - Partner Announcement". Formats: presentation→16x9, square→1x1, story→9x16. Wired in `/simple` `handleExport` (replaces `techbbq-…-stamp` names; the main editor keeps its own). 71/71 vitest, tsc + eslint + build clean. UNCOMMITTED on master working tree — commit + push next.

**Session 2026-07-29, round 17 — 9:16 count-variants 1..4 built into the item (LIVE DB write).** Auri tuned a 9:16 mod+1 design and asked for 1/2/3/4-speaker versions with the chrome (moderator, headline, label, logo) pinned. Also found + fixed a data hazard: his last header Update had shrunk the snapshot roster to 1 speaker (stripFormsForSave saves the CURRENT form; the stash is tab-local), so fresh loads couldn't restore Nicholas/Omolade/Rajeev on count-up. Written to Neon (backup `c20fddbb-backup-*` in scratchpad, dry-verified first): active doc = 4-speaker story (chrome-synced from his tune, so sidebar roster matches the canvas), his tuned 1-speaker story + generated 2/3-speaker story docs added to variants (existing square + 16:9 sets kept), snapshot roster restored to all 4 people WITH photo PATHS (`/samples/*.jpg` — paths survive stripping and rehydrate on any fresh load; moderator's path pinned too). Verified: all 4 story counts share his exact chrome, every count's rebuild key-matches + retargets, count 1 revives his hand-tuned doc, square×4 and 16:9×4 still revive. **Watch-out for future sessions: header Update snapshots only the CURRENT speaker list — a user who saves while at 1 speaker silently drops the roster for everyone else. Consider persisting the stash into the snapshot.**

**Session 2026-07-29, round 16 — library item renamed (LIVE DB write, name only).** "Panel with 4 People" (`c20fddbb`) → **"Official Panel Discussions"**, per Auri — matches the "Official Partner" naming convention. Share link unchanged (`/simple?load=c20fddbb-…`). Verified by read-back. His open tab shows the old name in the header Update button until he re-loads the item.

**Session 2026-07-29, round 15 — same words must keep the tuned wrapping (same branch, UNCOMMITTED).** Auri (post-repair): count round-trips fine now, "but the text — the Omolade person skips the name." Emulated his exact flow against the LIVE bundle: after 4 → 3 → 4, `speaker-2.name` came back as `"Omolade\nAdebisi"` — the generic 4-speaker layout wraps captions at ~14 chars (narrow 15% cards) and the retarget stamped that re-wrap into his tuned layer with zero edits anywhere. Fix: new `carryWords` helper (used by both `retargetTunedDoc` and `retargetPartnerLayout`): caption roles (`.name/.title/.company/.secondary`) whose FLATTENED content equals the rebuilt words keep the tuned layer's own line breaks; real word edits still take the rebuilt text verbatim; header roles compare exactly (a deliberate Enter in the headline field still lands). Test pins both directions (69/69). Also actioned the round-14 auditor block: `public/samples/rajeev-kumal.jpg` is now STAGED (`git add`, was untracked — a `commit -am` would have shipped a 404ing photo to prod), the dedupe-scope claim above is corrected, and the post-write DB state is persisted for the record (`scratchpad/c20fddbb-postwrite.json` — nb: captured AFTER Auri's own 17:45 header Update, which preserved the repaired structure: unique roles, tuned Rajeev at his positions, snapshot correct).

**Session 2026-07-29, round 14 — duplicate-role corruption in `c20fddbb` repaired + Rajeev sample speaker (same branch, UNCOMMITTED; one LIVE DB write).** Auri: the loaded template breaks apart on a speaker-count round-trip; also the added 4th speaker should default to a sample person (photo provided, "Rajeev Kumal", "CTO at 88 Angle").

- **ROOT CAUSE (from the live Neon doc):** Auri built his 4th speaker by ⌘D-cloning Omolade's text layers in the editor — Duplicate copies `simpleRole` verbatim, so the doc carried `speaker-2.name/title` TWICE. Duplicate roles make `panelShapeKey` unmatchable by any rebuild (dupes are included in the key) and poison the role-set comparison, so the first form change stranded the design. One of the item's 5 variants carried the same dupes. His snapshot's 4th speaker was empty, compounding it.
- **Mechanism fix — `dedupeSpeakerRoles(doc)`** (now part of `migrateLegacyPanelDoc`, between the roles and company migrations): first occurrence of a role keeps it; later copies of `speaker-N.*` are renumbered to a fresh index (same duplicate-ordinal → same new person, so a cloned name+title pair becomes one speaker); duplicate copies of non-speaker roles (moderator.* etc.) just lose the tag. Clean/partner docs pass by reference. **Scope (auditor correction): this heals SNAPSHOT-LESS cloned docs on load. An item whose `simpleForms` snapshot disagrees with the deduped layers (like his: 4th speaker blank in the snapshot) still shape-mismatches its rebuild and needs a data repair — the dedupe only removes the duplicate-role poison. Future sessions: don't assume self-healing; check the snapshot.**
- **Data repair (backups in scratchpad `c20fddbb-backup-*.json`; verified in a DRY RUN before the write, then re-verified from a fresh fetch):** active doc's cloned texts → `speaker-3.name/title` with content "Rajeev Kumal" / "CTO at 88 Angle"; the 4th slot's placeholder frame (his 15%×17% spec) → a real photo layer `speaker-3.photo` = `/samples/rajeev-kumal.jpg` at the frame's exact tuned geometry (layerOrder entry rewritten); snapshot's 4th speaker filled in; variants deduped. Post-write: unique roles, migration no-op, form restores 4 speakers incl. Rajeev + photo, key match + retarget OK, 4→3→4 parks and revives.
- **Sample 4th speaker:** new `sampleFourthSpeaker()`; `setSpeakerCount` uses it when a brand-new slot lands at index 3 (stash still wins; slots 5+ stay blank). Photo processed with sharp (800×735, q80 mozjpeg, ~74KB) into `public/samples/rajeev-kumal.jpg`.
- **DEPLOY DEPENDENCY:** the live library item now references `/samples/rajeev-kumal.jpg`, which exists only on this UNCOMMITTED branch — production serves 404 for it until the branch merges to `master`. Merge before teammates load the item on prod.
- **Evidence:** 68/68 vitest (4 new: clone-pair renumber + matchability, moderator-clone strip, reference passthrough, sample-speaker shape), tsc + eslint + build clean.

**Session 2026-07-29, round 13 — 4-speaker square card size spec (same branch, UNCOMMITTED).** Auri: on the square panel with 4 speakers, speaker cards are 15% wide × 17% tall (was a derived ≈12%×13.6% squeeze), corner radius stays the standard 8. Counts 1-3 keep the approved 0.185 size; 5+ stay dynamic. The band-fit clamp now scales proportionally (identical output for the old aspect-derived sizes, keeps 15:17 for the new case). Pin test added (64/64), tsc + eslint + build clean, screenshot `four-speakers-1517.png`. Round-12's frame-count fix got its auditor GO (all probes clean; minor noted: a hand-restyled outline+gradient rect would count as a placeholder frame and shift a doc's key — narrow, tag builder frames if it ever bites).

**Session 2026-07-29, round 12 — blank 4th speaker never appeared (same branch, UNCOMMITTED).** Auri: "when you put 4 speakers and 1 moderator, another speaker card doesn't appear."

- **ROOT CAUSE (probed, not guessed):** a blank person emits NO text or image layers — only the gradient-outline placeholder frame, which is a role-less shape. `panelShapeKey` and `retargetTunedDoc` compare text+image roles only, so a 4-speaker rebuild with a blank 4th was IDENTICAL to the tuned 3-speaker doc: retarget "succeeded" and rendered the 3-speaker tuning right over the new card. Bit anyone with a tuned/loaded design active (i.e. always, since templates load as custom docs).
- **Fix:** `panelShapeKey` gains a `|frames:<n>` component (count of `isSlotPlaceholder` shapes — helper moved above it) and `retargetTunedDoc` refuses on a placeholder-count mismatch. Key format changes are safe: keys are recomputed on every hydrate/load since round 8, never persisted-and-trusted. Side bonus: the old documented key collision (empty partner single vs all-empty panel, 2026-07-21 gotcha) is now distinct too (1 frame vs 0).
- **Evidence:** 63/63 vitest (new regression: blank-4th key differs + retarget refuses + dropping the blank restores the tuned key; all partner/panel suites green — frame counts agree on both sides of every legit flow), tsc + eslint + build clean. Live Playwright: tuned 3-speaker → plus → 4th placeholder frame renders on canvas (screenshot `four-speakers-card.png`), moderator/header/logo unchanged; minus → tuned 3-speaker revives exactly. Zero console errors.

**Session 2026-07-29, round 11 — logo joins the panel chrome + comma polish (same branch, UNCOMMITTED, post-GO additions).** Auri (with `?load=c20fddbb` open): headline, subtitle, session label, moderator AND LOGO must stay put across 1..4 speakers — his saved 3-speaker placement is the reference.

- `syncPanelChrome` now carries the 5 logo fields (`showLogo/logoStyle/logoPosition/logoCustomPosition/logoScale`), same as the partner sync — a dragged logo no longer snaps back to its preset corner on a count switch. Test added (62/62).
- Took the round-10 auditor's minor: `mergeLegacyCompanyLayers` strips a trailing comma/whitespace off the old title before the ",\n" join ("Partner," + "Molten" no longer double-commas).
- Live Playwright (simulating his flow: editor-drag moderator + logo, then walk speakers 3 → 2 → 1 → 4 → 3): headline/subtitle/label/moderator/logo byte-identical at every count, zero console errors. NB when counting: a blank 4th speaker renders as a placeholder SHAPE, so `canvasImages` shows 3 speaker photos in the 4-speaker layout — not a bug.
- Gates: 62/62 vitest, tsc + eslint + build clean. These two changes came AFTER the round-10 GO; they mirror already-audited machinery 1:1 (partner logo carry, auditor's own suggested guard) and are unit-tested.
- **His item `c20fddbb`: still legacy in Neon.** Loading it now migrates photo roles + folds title/company layers (look preserved); he should press header Update once so the stored copy is current.

**Session 2026-07-29, round 10 — one Description field per person (same branch, UNCOMMITTED).** Auri: replace the two inputs (job title | company) with ONE free-text description ("could be multiple companies"); the rendered look stays the default.

- **UI (`page.tsx` PersonEditor):** single full-width input, placeholder "Job title, company", `aria-label="Description"`. Bound to `SimplePerson.title`; `company` stays in the type for old data but is always "" going forward (documented on the type).
- **Sample defaults** merged ("Principal, Lightrock" etc.), so the builder simply never emits `.company` layers for new forms — `buildCaption`'s company handling is untouched and still renders legacy docs.
- **Migrations (the load-bearing part — dropping a layer changes the role set, the round-8 strand class):** `mergePersonDescription(p)` folds company into title (", " join) — applied on localStorage form/stash hydrate and in `formsFromDoc` (snapshot + legacy paths; legacy path also flattens builder `\n` to spaces for the single-line input and no longer comma-splits the grid's `.secondary`). `mergeLegacyCompanyLayers(doc)` folds each `<who>.company` TEXT LAYER into its `.title` layer as an extra line (keeps the tuned layer's position/styling; a company-only person's layer is re-roled to `.title`). `migrateLegacyPanelDoc` = roles migration + company merge, and REPLACES `adoptLegacyPanelRoles` at every doc entry point (library load + variants, CUSTOM_KEY, parked re-key, editor handoff). Result: a pre-merge tuned doc still shape-matches its rebuild — pinned by test.
- **Evidence:** 61/61 vitest (3 new: person merge, the no-re-strand round-trip incl. `retargetTunedDoc` non-null, company-only re-role + current-doc passthrough; the old "splits at the LAST comma" reconstruction behavior is gone with the split). tsc + eslint + build clean. Golden snapshots updated (sample content merged, `.company` layers gone, ids shifted). Live Playwright: fresh session shows 4 single Description inputs + merged canvas text; a seeded legacy two-field form hydrates as "CTO, Acme Corp"; zero console errors.
- **Auditor round: first pass BLOCKED — the doc merge joined with a bare "\n", and `formsFromDoc`'s newline flatten then ate the comma on snapshot-less items ("Managing Director Stifel"), which is exactly the path Auri's `c20fddbb` takes. Fixed: the fold joins with ",\n" (same two rendered lines, comma survives the flatten); test fixture re-pointed at a plain company name so a space-join fails it; the dead "moderator.company" entry dropped from `syncPanelChrome`'s CHROME set. Auditor also verified: every doc entry point migrates before shape keys are computed, keys match on all three formats (grid never emitted `.company`), migration is a reference no-op on current docs, company-only + hand-deleted-title surgeries survive, partner docs untouched, no stale `company` reaches the builder.**
- **Note:** old library items keep rendering their two-line title+company until loaded (migration folds them, look preserved as two lines); re-saving via header Update writes the merged shape.

**Session 2026-07-29, round 9 — moderator + header pinned across speaker counts (same branch, UNCOMMITTED).** Auri: on his panel template (`c20fddbb`), the moderator picture and the header (headline, subtitle, session label) must stay identical whether the panel has 1, 2, 3 or 4 speakers — only the speaker cards may adapt.

- **`syncPanelChrome(from, to)`** (`simpleLayout.ts`, the panel sibling of `syncPartnerChrome`, scoped to the ask): on a same-format speaker-count change, carries from the design being left → header texts (headline/subtitle/label: geometry+styling, content stays the target's), the label chip, the moderator photo card (target keeps its own src/crop) and the moderator's caption texts. The overlaid "MODERATOR" word is role-less, so it's matched by CONTENT (tagging it would churn `panelShapeKey` and re-strand old tuned docs — the round-8 bug class); a deleted word/chip stays deleted; a reworded one ("HOST") isn't recognised and falls back to the target's generic. Speaker cards, captions, SPEAKER labels: always the target's own.
- **Builder:** label chip now tagged `simpleRole:"label.chip"` (shape tags are NOT part of panelShapeKey — no stranding; chip identification falls back to "filled shape under the label" for docs tuned before the tag). 16:9 row: moderator card is sized by the band alone (`cardWfromH(bandH)`), not by the per-count unit split — it was already band-capped with the default header but shrank at 4 speakers with short headlines. 9:16 grid: with a moderator the grid now COMMITS to 3 columns + the 2-row cell height for up to 6 people (`pinned`), so the moderator cell and fonts are identical for 1..5 speakers — **this changes the 9:16 mod+3 canonical from 2×2 to 3-across + 1** (screenshot `story-3spk-pinned.png` in the session scratchpad; low counts leave empty grid space by design — constancy over fill, per Auri's ask). Speakers-only grids keep filling the area. Square was already count-independent.
- **Wired** in the `/simple` rebuild effect after the partner sync, same gating (explicit format/size/kind guard in the page — the sync returns its target unchanged on a bail, which would otherwise promote a generic rebuild to a "custom" doc).
- **Auditor round: first pass BLOCKED with 2 real findings, both fixed.** (1) The MODERATOR-word carry ran on the moderator TOGGLE too (also a shape change, but only one side has a moderator) — toggle-off floated a stray "MODERATOR" over a speakers-only layout, toggle-on deleted the legitimate one. Fixed: the word carry is gated on BOTH docs having a moderator (witnessed by `moderator.*` text roles or the photo role; the role-based carries were already self-guarding). Regression test encodes the auditor's exact repro, both directions. (2) The 9:16 grid still resized the moderator per count (was logged as an accepted limitation, but the ask has no format qualifier) — fixed via the `pinned` grid above; the count-independence pin now runs on all three formats.
- **Evidence:** 58/58 vitest (14 new: count-independence pins for the moderator card on ALL formats + all-format headers incl. the short-headline 16:9 regression; sync carry/delete/guard tests; the toggle repro), tsc + eslint + build clean. Golden snapshots updated: square diff is ONLY the chip tag (verified in isolation), presentation adds the intended speaker-slot shifts, story is the pinned-grid change. Live Playwright: dragged moderator + tuned doc survives 3 → 2 → 3 with mod/label/chip/word byte-identical in the persisted doc, zero console errors; 9:16 pinned grid eyeballed at 2 and 3 speakers.
- **Limitations (accepted):** (1) Hand-drawn decorations outside header/moderator don't carry across counts (SPEAKER labels/frames/scrims are count-specific, so wholesale carry like the partner sync would duplicate them). (2) A reworded MODERATOR label ("HOST") isn't recognised by the content match and falls back to the generic one. (3) 16:9 rows now leave slightly more right margin at low counts (leftover width becomes gaps — cosmetic).

**Session 2026-07-29, round 8 — legacy panel items stranded their tuning (same branch, UNCOMMITTED).** Auri: loading his 3-speaker+moderator panel template, stepping speakers 3 → 2 → 3 "changes the template completely". Root cause proven against the live library (item `c20fddbb` "Panel with 4 People"): the item predates photo `simpleRole` tags AND forms snapshots (2026-07-22), so (a) `formsFromDoc` couldn't rehydrate the sidebar photos and (b) its `panelShapeKey` ends `imgs:img,img,img,img` while any rebuild ends `imgs:none` — the parked tuning could never revive, so the generic layout replaced his design.

- **Fix — `adoptLegacyPanelRoles(doc)` (`simpleLayout.ts`):** when a panel doc's images are ALL role-less and their count equals the person count (from text roles), re-attach `moderator.photo` / `speaker-N.photo` by array order (the builder has always emitted photos in person order — verified against the live item's geometry). Conservative: partner docs, docs with any existing role, and count mismatches (hand-added images, missing photos) pass through untouched.
- **Wired in `/simple`:** `handleLibraryLoad` migrates the loaded doc + its `simpleVariants`; the mount hydrate migrates the handoff doc, `CUSTOM_KEY`, and the parked shelf (values migrated AND re-keyed, since the stored keys carry the old role-less shape).
- **Evidence:** 47/47 vitest (5 new tests incl. the live repro: legacy doc → migrate → form rehydrates photos → rebuild key matches → retarget succeeds), tsc + eslint + build clean. Live Playwright: seeded a role-less tuned doc (moderator moved to 0.8/0.3), reload → tuned design + banner, 3 → 2 → generic, 2 → 3 → the exact tuned design revived (screenshots pixel-identical).
- **Auri's re-save note:** his library item stays legacy in Neon until re-saved once (load → header Update) — until then every load depends on the migration (which handles it), and the item still has no forms snapshot.
- **Also this session:** the dev server had crashed workers (leftover from the machine hiccup) — pages served but `/api/library/[id]` returned an HTML 500 ("Jest worker … exceeding retry limit"), which the UI reported as "Load failed — could not reach the library". Restart fixed it. A "Maximum update depth exceeded" console error in `ImageDragOverlay[handleMouseMove]` was seen ONLY during that broken state and does not reproduce on a healthy server (tried move-drag, resize-drag, marquee group-drag under Playwright, zero console errors) — attributed to stale HMR chunks; re-investigate only if it recurs.

**Session 2026-07-29, round 6 — Auri consolidated the library himself; merge script RETIRED (same branch, UNCOMMITTED).** Auri hand-tuned item `7583298d` ("Official Partner 4") in the app across all formats — 9:16 and 16:9 each carry One/Two/Four, square carries Two/Four (square·One is the only gap) — and declared it the canonical template. Executed with his approval, backups in the session scratchpad (`library-backup-20260729/`): renamed `7583298d` → **"Official Partner"**, deleted `3aab5b88` (old Official Partner), `77133249` (Official Partner 2), `12da2a7d` (Officia Partner 4, typo dup). Kept: "Official Community Partners 4" (different template), "SImilar" + "Partners" (not named official-partner — Auri deletes via row trash if unwanted). Code: `DEFAULT_PARTNER_ITEM_ID` → `7583298d` (verified live: cold partner entry fetches the new id); `scripts/merge-partner-templates.mjs` DELETED — **all "--push before merging" notes in rounds 1/3/4 below are MOOT**; the branch can merge to `master` whenever the diff is approved. Canonical share link is now `/simple?load=7583298d-759b-4f97-9d33-fc2e10776e97`. Gates: 42/42 vitest, tsc, build clean.

**Session 2026-07-29, round 7 — "Official Community Partners" template (library data, no code).** Copied "Official Partner" (`7583298d`) into a new item **`431c22ac-a5a2-46a4-aec7-ad39923eae7d` "Official Community Partners"**: label per layout ("OFFICIAL COMMUNITY PARTNER" on One, "…PARTNERS" on Two/Four — recomputed from each doc's actual layout, since the source's active doc had a stale singular baked in), background `seasonGreen2` (Lime Shadow — the darker green; his white label/lines/logo need the contrast, Lime Glow would wash out) across every doc + form snapshot. Full 9-combo coverage (3 formats × 3 layouts, same as the source, which by now also covers square·One). Share link: `/simple?load=431c22ac-a5a2-46a4-aec7-ad39923eae7d`. NB: the old "Official Community Partners 4" item (`a92fd765`) still exists and is probably redundant now — Auri's call to delete.

**Session 2026-07-29, round 5 — shared chrome across layouts (same branch, UNCOMMITTED).** Auri: within one format (his example: 9:16), the label, the hand-drawn line and the TechBBQ logo must sit in the same place whether the layout is One, Two or Four — tune the chrome once per format.

- **`syncPartnerChrome(from, to)`** (`simpleLayout.ts`): on a layout switch within the same format+size, the chrome follows the user — label styling/position (content stays the target's: plural rule), role-less texts/shapes/images (his line; the deleted chip stays deleted), and the 5 logo fields (`showLogo/logoStyle/logoPosition/logoCustomPosition/logoScale`). The target keeps its slot images + placeholder frames. Chrome is last-touched-wins. Cross-format pairs return unchanged — each format owns its chrome geometry.
- Wired into the `/simple` rebuild effect after parked revival: applies to revived variants AND to generic rebuilds of not-yet-tuned layouts (so switching to an unset layout keeps your chrome around generic slots — `custom` is now non-null there).
- **Auditor BLOCK (real): the sync tripled parked-shelf usage and `MAX_PARKED = 6` silently evicted the OLDEST entry — in practice the hand-tuned design** (measured live: one single-format tour filled 6/6 keys; entry 7 dropped the tuned doc with no warning, unrecoverable after reload unless library-saved). Fix: `MAX_PARKED` 6 → 16 (reachable key space is 3 formats × 3 layouts + label-cleared variants + panels; the `persistTuned` quota catch is the storage backstop) + new `parkDoc()` helper re-inserts a re-parked key at the END, so shelf order = touch recency and the trim drops the least-recently-touched chrome-only docs, never the design the user keeps returning to. Test pins the recency semantics (nb: same layout×format docs share one shape key — distinct keys need distinct combos).
- **Accepted contract (per Auri's ask, so future sessions don't report it as a bug):** chrome is last-touched-wins, which makes PER-LAYOUT decorations impossible — a line added only to the Two-logo variant is replaced by the shared chrome on the next switch away and back. Also, after a sync the target's new slot ids fall to `reconcileLayerOrder` neighbour anchoring, so in a z-order-tuned doc a slot could land under a hand-drawn line (cosmetic, fix by re-ordering in the editor).
- **Re-audit: GO** — `parkDoc` recency proven by mutation testing (test goes red with a plain spread); the previously-failing eviction scenario re-run live (tuned doc walks index 0 → 5 under cap 16, never evicted). Post-GO, the auditor's last minor was applied too: `persistTuned` now sheds the shelf's stalest entries (halving until the write fits) on a quota error instead of dropping the whole shelf.
- Evidence: 42/42 vitest (3 new tests), tsc + eslint + build clean. Live Playwright: tuned single (label y 0.067, line, dragged logo) → Two keeps all chrome + "OFFICIAL PARTNERS" → Four same → back to One restores the exact original (singular, y 0.067).
- His stored variants (`7583298d`, active doc now a 9:16 quad from today) still have drifted chrome — the sync fixes it as he cycles layouts once per format and presses Update; no data migration needed.

**Session 2026-07-29, round 4 — template coverage hints (same branch, UNCOMMITTED).** Auri: a loaded template should say what it consists of (which layouts × formats have saved designs) and tell you when the current combo isn't set up, with a path to add it.

- **`bundleCoverage`** (`simpleLayout.ts`): distinct (format × layout) combos across a bundle's active doc + variants; panel docs are format-only (layout null). Test added (39/39 total). `isPartnerDoc` now delegates to `partnerLayoutOf`, so zero-logo partner docs classify correctly everywhere (was: filed as panel variants by `currentBundle`).
- ~~REMINDER: run the merge script `--push` before merging~~ MOOT as of round 6 — Auri consolidated the library by hand; the script is deleted.
- **`/simple` UI:** orange dot on Format and One/Two/Four buttons for combos the loaded template covers (+ tooltips); muted "‹name› is set up for 1:1 (One, Two, Four)" line when the current combo is covered; amber notice when not: "isn't set up for 16:9 · Four logos yet. This is the automatic layout. Fine-tune it and press Update to add it to the template." All gated on `loadedItem && template === loadedItem.kind`.
- **Load-bearing change: format buttons no longer call `revertCustom()`** — just `setFormat`. Previously a format switch wiped the loaded-template identity (URL, Update button), so "not set for 16:9" could never display; it also binned tuning that the parking machinery is designed to keep. Parking now owns format switches (retarget refuses cross-format → park → revive on return). Verified live: tuned square → 16:9 shows the notice + keeps Update, back to 1:1 revives.
- **Coverage plumbing:** stored inside the `LOADED_ITEM_KEY` sessionStorage JSON (`{id,name,kind,coverage}`, hydrate is defensive so old-shape entries just show no hints); `adoptLibraryIdentity(id,name,kind,cov)`; recomputed from `currentBundle` after header-Update and library save/overwrite so a newly added format gets its dot immediately.
- **Auditor round:** code verified live (park/revive keeps exact coordinates, legacy storage shapes degrade to no-hints, panel notices are format-only); BLOCK was documentation-only — the 07-06→08 entry's "format button always clears the override" note is now marked SUPERSEDED with a do-not-restore warning. Also took its hardening: `partnerLayoutOf` falls back to placeholder-frame `simpleRole` tags, so a zero-logo partner doc reports its real layout (was null → false "isn't set up" hint).
- Evidence: 39/39 vitest, tsc + eslint + build clean, Playwright screenshots (dots, notice text "isn't set up for 16:9 · Four logos yet", Update button surviving the switch). Re-verdict pending.
- **Known limit:** coverage is a snapshot from load/save time — a teammate updating the same item won't refresh your dots until you re-load it. Hints only, nothing acts on coverage.

**Session 2026-07-29, round 3 — label height + plural (same branch, UNCOMMITTED).** Auri: the "OFFICIAL PARTNER" chip must sit at the same height in One/Two/Four, and read "OFFICIAL PARTNERS" (plural) on Two/Four.

- **Plural rule in the builder** (`buildPartnerDesign`): a label ending in "partner" (case-insensitive) gets an "s" on duo/quad layouts. Lives in the builder because the label field is shared across layouts; retarget then carries the pluralized words into tuned docs on every layout switch. Default "Partner Announcement" unaffected. Test added (37/37).
- **Height alignment is a data fix in the merge script**: duo/quad variants get their label text + white chip shifted to the single doc's label y (relative chip-text offset preserved), content set to "OFFICIAL PARTNERS", chip widened one character.
- **Merge script reworked to a candidate pool** — Auri header-Updated "Official Partner 4" mid-session (its active doc is now his newest DUO tuning; the quad lives in its variants), so fixed item→layout mapping broke. Now: pool = every item's active doc + bundled variants; per layout pick most-filled then newest (single stays pinned to the canonical item's active doc); generalized `fillEmpties` fills any empty slots (tag-aware). Dry-run picks: single ← "Official Partner" active, duo ← "Official Partner 4" active, quad ← "Official Partner 4" variant. Temp vitest vs the real builder: revival + retarget for all three layouts, label y identical across stored docs, plural survives retarget — 3/3, test deleted after.
- **Push still pending** (`node --env-file=.env.local scripts/merge-partner-templates.mjs --push`) — now carries the label fixes too, so run it before merging the branch. Auri's browser-local parked variants stay misaligned until he loads the merged item once (fresh tab auto-load or the row's Load button).

**Session 2026-07-29, round 2 — layout-family retarget + sidebar/export polish (same branch, UNCOMMITTED).** Auri's live feedback after round 1: (1) Two-logo layout showed "a completely different template" while One and Four showed his designs, (2) One/Two/Four switching made the sidebar jump, (3) the always-visible PNG/JPG toggle read as header noise.

- **ROOT CAUSE of (1):** his tab had `?load=7583298d` ("Official Partner 4") active; that bundle's duo variant has only 1 of 2 logos filled, so switching to Two (rebuild = both slots filled from the 4-slot snapshot) never matched the exact `panelShapeKey` and fell to the generic builder. This is a mechanism weakness, not just stale data: ANY slot fill/clear bounced users off their tuned layout.
- **Fix — `retargetPartnerLayout` (`src/lib/simpleLayout.ts`):** same-layout partner docs with a different fill pattern now reconcile instead of rebuilding — a slot gaining a logo swaps its placeholder frame for an image layer at the frame's hand-tuned geometry, a cleared slot swaps back to a placeholder; words/background carry over like `retargetTunedDoc`; layerOrder entries swapped in place. Bails (null) on different layout/format/size, mismatched text roles, non-slot roles, or placeholder-count mismatch (hand-deleted frame). Wired into the `/simple` rebuild effect as a fallback after the exact-key path, both for the active custom doc and for parked revival (newest parked first). Side effect: quad "move into empty cell" now moves the logo into that cell's tuned frame instead of rebuilding.
- **Sidebar jump fix:** logo-slot area wrapped in `min-h-[168px]` (the quad grid's height) so One/Two/Four keep the Background section at the same y (verified: 544px across all three).
- **Export split-button:** PNG/JPG radiogroup removed from the `/simple` header; "Save image" + chevron (Radix Popover, `Popover.Close` per option, Check icon on current format). Main half exports with the current format.
- **Completion-auditor round: first pass BLOCKED with 3 real findings, all fixed.** (1) Quad clear-then-fill scrambled the placeholder→slot mapping (replacement frames append to `shapes`, breaking the array-order assumption) → placeholder frames are now role-tagged: `ShapeElement.simpleRole` added (`types/template.ts`), `buildPartnerDesign` tags empty-slot frames, `retargetPartnerLayout` maps by tag first (bails on tag inconsistencies), array-order fallback only for untagged legacy frames; regression test encodes the auditor's exact repro. (2) Revert didn't stick — the family scan revived sibling variants installed by a library load → `revertCustom` now drops every parked doc of the current partner layout. (3) The format popover lost radiogroup semantics vs the old control → `role="radiogroup"`/`role="radio"`/`aria-checked` restored.
- **Evidence:** 36/36 vitest (5 new `retargetPartnerLayout` tests incl. the auditor repro; golden panel snapshots unchanged), tsc + eslint + `npm run build` clean, Playwright confirms stable sidebar + working popover. Re-audit verdict pending at session end.
- **Note:** the merge `--push` (below) is still pending but now matters less for correctness — the family fallback revives his duo design even from the old "Official Partner 4" bundle. Still do it so cold entry defaults to the merged "Official Partner".

**Session 2026-07-29 — /simple defaults + background cleanup (branch `simple-defaults-and-bg-cleanup`, UNCOMMITTED, awaiting Auri's review + one manual step).** Three Auri asks, all implemented and verified (31/31 vitest, tsc, eslint, `npm run build` clean; Playwright screenshots; completion-auditor verdict pending at session end):

1. **Default partner template on entry** (`src/app/simple/page.tsx`): new effect auto-loads library item `3aab5b88-53be-4c8c-be5c-5b01fca5186d` ("Official Partner") when Quick Templates opens on the Partner template with nothing of the user's own (guards: no custom, no loadedItem, no parked partner docs, no `?load=` param; one-shot per mount via `defaultLoadTried` ref). Silent fallback to the generic layout on 401/404/offline — verified signed-out in Playwright.
2. **Background picker** (`src/components/BackgroundPicker.tsx` + the `/simple` call site): new `compact` prop (8-col grid, smaller cells, ~1/3 the height) used on `/simple`; Partner template now excludes ALL four stage groups (BBQ Stage was the straggler — Auri's call finally made: partners get only "New styling" + "Liquid metal"). Panel keeps stages. Main editor picker untouched (no `compact`).
3. **One/Two/Four logo layouts under one library item** (`scripts/merge-partner-templates.mjs`): merges "Official Partner" + "Official Partner 2" (`77133249…`) + "Official Partner 4" (`7583298d…`) into item `3aab…` as a round-6 bundle — active doc = tuned single, `simpleVariants` = tuned duo + quad, `simpleForms` = full 4-slot logos array. The duo doc's empty slot 1 gets its placeholder shape swapped for an image layer (same tuned geometry, quad's logo-1, `layerOrder` entry rewritten) so `panelShapeKey` matches a rebuild from the full slot array. Validated against the real builder via a temp vitest test (every layout switch revives + retargets, tuned layer ids kept) — test deleted after passing. **NOT YET PUSHED to Neon** — the write was permission-blocked; backups of all three items + `merged-bundle.json` live in the session scratchpad (`…/scratchpad/merge-partner/`).

- **Next steps (ORDER MATTERS — completion-auditor catch):** 1. Run `node --env-file=.env.local scripts/merge-partner-templates.mjs --push` FIRST (writes the merged bundle to the live library; backups exist). Merging to auto-deploying `master` before the push would ship the auto-load pointing at the pre-merge single-only item, so Two/Four would silently fall back to the generic builder for everyone. 2. Auri verifies signed-in: cold-open `/simple` → "Official Partner" loads; One/Two/Four each show his tuned design. 3. Review the diff on `simple-defaults-and-bg-cleanup`, merge to `master`. 4. Optional: hide stage groups on Panel too (one line), delete the now-redundant "Official Partner 2"/"4" items via the row trash, keep a fixture-based bundle test in the suite.
- **Gotchas:** (1) The merge script mirrors `panelShapeKey` inline — if the key format in `simpleLayout.ts` changes, update the script before re-running. (2) The auto-load effect is deps-less (same pattern as the deep-link effect) and relies on its guard conditions re-evaluating every render. (3) Revert after auto-load leaves the generic layout for the rest of the tab session; a reload re-imposes the default — intended.
- **Also this session — stress test findings (no code changes):** REAL BUG: `writeSession` (`src/app/page.tsx:346`) silently swallows sessionStorage quota errors — a doc with big image data URLs (base64 = 1.33× file size, ~5MB cap) stops persisting with zero warning and a reload loses everything since the last successful write (proven live: 521-element doc restored as 121). Cheapest fix: toast once on first failed write; better: downscale/recompress images on ingest (≤2048px JPEG) — also shrinks drag-persist work and library 413 risk. Soft spot: marquee select-all at 130+ elements runs ~1 fps (fine at real layer counts). Passed: 10-image cap enforced (silently — could use a toast), undo/redo integrity under spam, 90 rapid background switches, 4096×4096 export (note: exports at pixelRatio 2 → 8192×8192 file).

**Session 2026-07-28 — four new season background options (UNCOMMITTED, on `master` working tree).** Added the green + purple 2026-season gradient exports as picker options: Lime Glow / Lime Shadow / Violet Haze / Violet Shadow. Source JPGs from `Desktop\TBBQ\2x` (~780KB each) were recompressed with the project's `sharp` (width-capped 2160, q80 mozjpeg → ~22KB) into `public/backgrounds/season-green-{1,2}.jpg` + `season-purple-{1,2}.jpg`, then registered in `IMAGE_BG_REGISTRY` (`CanvasBackground.tsx`) and `BACKGROUND_OPTIONS` (`template.ts`) under the "New styling" group — so they appear on every template incl. Partner Announcement (which only excludes the stage groups via `excludeGroups` in `simple/page.tsx`). Verified: dev-server compile clean, `/simple` 200, all four images serve 200. Next steps: 1. Auri eyeballs them in the picker on `/simple`. 2. Commit + push to `master` (Vercel auto-deploys). Gotcha: text presets/templates were designed on dark backgrounds — light lime/lavender areas may need dark text.

**Session 2026-07-22 — SHIPPED to master (`9aa654d`, fast-forward from `fix/library-load-and-logo-retarget`, branch deleted; Vercel auto-deployed). Two completion-auditor passes, both GO.** Fixed the three team-library bugs Auri hit loading a saved Partner Announcement: (1) sidebar stayed on the Panel template, (2) replacing the logo didn't change the canvas, (3) or it rebuilt the raw template and lost the fine-tuned layout. Rounds 2-7 below grew it into: shareable template links, auth chip, Two-logo layout, all-variants-in-one-item, and update-in-place.

- **Root causes:** the library Load button passed only `item.doc` and the page just did `setCustom(loaded)` — the saved `kind` was ignored and the sidebar form never synced. And `retargetTunedDoc` hard-refused ANY image change (src mismatch → null), so a logo/photo replacement always binned the tuned doc and rebuilt from the form.
- **Fixes (all on `/simple` + `src/lib/simpleLayout.ts`):**
  - `retargetTunedDoc` now matches `canvasImages` by `simpleRole` and carries a swapped src into the tuned slot (geometry kept, stale `crop` dropped). Slot add/remove (photo cleared, single↔quad, quad reorder) still rebuilds. Panel headshots now get roles too (`moderator.photo`, `speaker-N.photo`) via `emitPhoto`.
  - New `formsFromDoc()` + `stripFormsForSave()` + `SimpleFormsSnapshot`: TeamLibrary saves a photo-stripped sidebar snapshot inside the doc (`doc.simpleForms`); loading restores template toggle, format and form fields, rehydrating photos/logos from the doc's role-tagged images. Legacy items (saved pre-snapshot) get reconstructed from roles — complete for partner docs, best-effort for panel docs.
  - `handleLibraryLoad` in `page.tsx` also syncs `baselineRef` so the form restore doesn't read as an edit and retarget/bin the doc just loaded. TeamLibrary `onLoad` now passes `{kind, doc}`; new required props `currentForm`/`currentPartner`.
  - Banner copy updated per template ("Text edits and logo swaps keep this layout…").
- **Evidence:** 28/28 vitest (new tests pin logo swap, photo swap, slot-removal refusal, single→quad refusal, formsFromDoc legacy + snapshot paths; 3 golden snapshots updated — diff is only the added `simpleRole` fields), `npm run build` clean, changed files eslint-clean, Playwright smoke on `/simple` (renders, template toggle, zero console errors). completion-auditor verdict pending at session end.
- **Gotchas:** (1) Tuned/parked docs persisted BEFORE this change have role-less panel photos — first form edit after the update rebuilds them once instead of retargeting (one-time, no crash). (2) `doc.simpleForms` rides inside the doc jsonb — `handleLibraryLoad` strips it before `setCustom` so it never leaks into the editor handoff. (3) Quad logo REORDER still intentionally rebuilds (roles are the slot identity — carrying srcs across a swap would undo the swap).
- **Also this session (housekeeping):** the `Desktop\GITHUB\tbbqvisualgen` clone is now the canonical working copy (was on stale `ux-p1-dewizard`; switched to `master`, `npm install`'d, `.env.local` copied from the redundant `Desktop\SideProjects\tbbq-visual-generator` clone — that one is pending deletion). Memory `project_tbbq_visual_generator` updated.
- **Round 2 — shareable template links (Auri's ask: "send a link that opens that template").** Every library row now has a Copy-link button (`Link2` icon) producing `/simple?load=<id>`. On `/simple`, a one-shot post-hydrate effect reads the param, fetches the item and runs `handleLibraryLoad` (full sidebar sync). Outcomes: success → toast; 401 → sign-in prompt opens so the OAuth round-trip returns and retries; bad id/404 → error toast. The param STAYS in the address bar in all cases (Auri wants it re-copyable from there); a per-tab sessionStorage marker (`tbbqvisualgen.simple.deeplink.done` = id) makes the load one-shot instead, so refresh/editor round-trips keep local edits while a fresh tab loads the template clean. The 401 path sets no marker so sign-in retries. Link sharing is safe: `/api/library/[id]` answers only verified `@techbbq.org` sessions (auth is checked before id validation, so strangers always just see the sign-in prompt). Verified in Playwright unauthenticated: deep link → sign-in dialog, param kept, console shows only the expected 401s. eslint + tsc + 28/28 tests clean. NOT yet verified signed-in (needs Auri's account).
- **Round 6 — one library item = all three logo layouts + an Update button (Auri's ask).**
  - **Full slot array saved:** `stripFormsForSave` no longer strips partner logos (One/Two/Four share the slot array; the active doc only carries the current layout's slots). `formsFromDoc` prefers the snapshot's full `logos` over role extraction. So after loading, flipping One→Two finds slot 1 still filled.
  - **Tuned variants bundled:** save now also writes `doc.simpleVariants` = the parked-shelf docs matching the current template kind (new `isPartnerDoc()` discriminator: any `logo-*` image role). `handleLibraryLoad` merges them back into `parked` keyed by `panelShapeKey`, so the layout picker revives each hand-tuned variant. `MAX_PARKED` 4 → 6.
  - **Update-in-place:** each library row gets a Save-icon button → `window.confirm` → PUT with the current bundle under the SAME id/name, so the shared link keeps working. `updateItem` in `db.ts` now also updates `kind` (PUT route passes `body.kind`) — else overwriting with a different template left a stale kind.
  - Evidence: 31/31 vitest (new round-trip test: slots 0–1 survive save/load with single active), eslint + tsc clean. NOT yet run: a second completion-auditor pass over rounds 2–6 — do it before merging.
  - **Round 6b — BUG: stale parked docs resurfaced after loading (Auri: "uploaded the logo to the two and it switched back to the previous template").** The parked shelf persists in localStorage; an old tuned-duo experiment sat there, and uploading a second logo made the rebuilt doc's shape key match it → auto-revival of the stale design over the fresh one. Fix: `handleLibraryLoad` now PURGES parked entries of the loaded kind (via `isPartnerDoc`) before installing the item's `simpleVariants` — loading is a statement of source-of-truth. Purge runs even for legacy items without variants. Users with stale state just re-load the template once.
- **Round 7 — header "Update <name>" button (Auri couldn't find the row icon).** The page now tracks which library item the on-screen design belongs to (`loadedItem` {id,name,kind}, persisted per-tab in sessionStorage `tbbqvisualgen.simple.loadedItem`; set by load/save/overwrite via `adoptLibraryIdentity`, cleared by Revert). While it's set and the template matches, the header shows an orange "Update ‹name›" button → confirm → PUT the full bundle to the same id (link keeps working). `currentBundle` (doc + forms snapshot + variants) is now built once in the page and passed to TeamLibrary as a prop (replaces currentDoc/currentForm/currentPartner/currentVariants); TeamLibrary's save/overwrite fire `onSaved` so the page adopts the identity. Also removed two unused eslint-disable directives. 31/31 tests, eslint + tsc clean.
- **Round 5 — URL always mirrors the loaded design (Auri: "the URL id doesn't change").** `handleLibraryLoad` now takes the item `id` (added to `LibraryLoadedItem`; both the modal Load button and the deep-link effect pass it) and does `replaceState` to `?load=<id>` + sets the applied-marker itself. So loading from the modal updates the address bar, loading design B over design A swaps the id, and the link is always re-copyable from the URL. Revert strips the param + marker (the bar stops claiming a design no longer shown). `DEEPLINK_DONE_KEY` moved to module scope with the other storage keys. eslint + tsc + 30/30 tests clean.
- **Round 4 — "Two logos" partner layout (Auri's ask).** `PartnerForm.layout` gains `"duo"`: two contain-fit cells side by side (0.42S × 0.26S, 0.06S gap), block-centered, with swap arrows between the slots. Roles are duo-specific (`logo-duo-0/1`, NOT `logo-0/1`) so a duo doc never shape-matches a half-filled quad — layout switches always rebuild, in-layout logo swaps retarget. Picker is now One · Two · Four (Square / Columns2 / LayoutGrid icons). `formsFromDoc` detects duo roles and, for an all-empty partner doc, falls back to the SAVED layout since there are no image roles to infer from. Verified: 30/30 tests (2 new: duo role isolation + duo reconstruction), eslint + tsc clean, Playwright screenshot shows two placeholder frames on canvas.
- **Round 3 — auth visibility (Auri: "I don't know if I'm logged in").** New `src/components/AuthChip.tsx` in the `/simple` header: signed in → email prefix + sign-out button (`signOut()` from next-auth/react); signed out → "Sign in" button (`signIn("google")`). Reads `/api/auth/session` once on mount — no SessionProvider needed for a single indicator. Verified in Playwright signed-out (chip renders "Sign in"); eslint + tsc clean. Signed-in rendering needs Auri's account.
- **Remaining follow-ups after the ship:** 1. Delete the redundant `Desktop\SideProjects\tbbq-visual-generator` clone (Auri to confirm). 2. Old library items bundle variants only after being re-saved once (load → set up layouts → header Update). 3. Watch for 413s on partner saves with 4 large logos (logo data URIs are duplicated across doc + snapshot + variants, cap is 4MB, error message is clear). 4. Library UI has leftover test entries ("Officia Partner 4", "SImilar"…) — Auri deletes via the row trash icon.

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
- **Round 8 — stage background polish (all LIVE, session ended here 2026-07-21 evening).**
  - 12 stage backgrounds total: 3 variants each for Tech/BBQ/Bonfire/Founder Stage, picker grouped per stage (stage name = section heading; groups render dynamically from `BACKGROUND_OPTIONS.group`).
  - Tech/Bonfire/Founder Stage groups hidden on the Partner template (`BackgroundPicker` gained `excludeGroups`; `/simple` passes it when `template === "partner"`). OPEN: Auri named only 3 stages — BBQ Stage still shows on Partner, awaiting his call.
  - **CMYK gotcha:** every season/stage JPG from `TBBQ/2026 Season` is a PRINT export — CMYK with embedded profile ("components 4" in `file` output is the tell). Browsers approximate CMYK → blacks lifted to grey, washed contrast (Auri spotted it). Fixed by converting the in-repo copies to sRGB via the embedded profile (Pillow ImageCms, RELATIVE_COLORIMETRIC + BLACKPOINTCOMPENSATION — perceptual intent mutes the hues, relcol without BPC lifts blacks). Darkest pixels ~70 → ~15, file sizes 1MB → ~100KB. **Do this conversion for ANY future background from that folder.** If colors should be punchier, re-export from Illustrator via Export for Screens (sRGB) and swap in as-is.
- **Next steps:** 1. Auri reviews `/simple` visually (chip/logo-box sizing likely; stage background colors vs the Illustrator originals). 2. BBQ Stage on the Partner template — hide it too, or keep? 3. Still-open P0 items from 07-02: Layers panel should default CLOSED on an empty canvas; consolidate New/Start blank/Start over vocabulary. 4. Optional: rotate AUTH_SECRET (was pasted into chat), port editor Templates modal to the team library.

**Session 2026-07-06 → 07-08 (branch `ux-p1-dewizard-notes`).** Panel Maker polish: multi-format correctness, wrapping, sample defaults, and a two-way round-trip with the advanced editor. All tsc + eslint clean; verified in headless Chrome. Touches `src/app/simple/page.tsx`, `src/lib/simpleLayout.ts`, `src/components/templates/DynamicTemplate.tsx`, `src/components/ImagePlacer.tsx`, `public/samples/`.

- **Multi-format layouts (the big fix).** Fonts are now sized off the SHORTER side `S = min(W,H)`, and every vertical text advance is scaled by `vs = S/H`. Root cause of the broken 16:9 / 9:16 output was mixing width-based font sizes with height-based positions. Square (S=W=H, vs=1) is byte-identical to before; the others are corrected. Each format gets the layout that suits it: **square → diagonal panel** (big moderator, caption right, speakers stepping up — the reference), **16:9 → level row** (moderator a touch bigger, captions above), **9:16 → filled grid** (moderator marked, speakers labelled). Landscape/portrait detected via `W > H*1.2` / `H > W*1.2`.
- **Word-wrapping (`wrapToWidth`).** Names/titles/companies wrap to the card/caption width instead of overflowing into neighbours (long names were colliding). Caption blocks measure wrapped line counts for correct spacing.
- **Photo bottom-scrim.** New `CanvasImage.scrimBottom` (0–1) → a subtle black gradient fading up from the photo bottom (rendered inside the clip in `DynamicTemplate`), so overlaid labels/text stay legible. Replaced the old harsh solid band (kept only for photo-less placeholders). Role labels (MODERATOR/SPEAKER) are shadowed text via `TextElement.shadow`, softened this round.
- **Session-label chip polish.** Rounded-rectangle chip (not pill); asymmetric padding (text left, more room right); near-normal letter-spacing; optically centred caps; width accounts for letter-spacing.
- **Sample defaults + photos.** `emptyForm()` now returns a pre-filled sample panel (Continuation Capital … / Pierre Leroy moderator + Andrei/Nicholas/Omolade) so there's no retyping. Four headshots live in `public/samples/*.jpg` and are referenced by URL (NOT base64-embedded — keeps source lean). Headline multi-line via a textarea (Enter = new line); photo remove "×" is now a corner icon on the thumbnail.
- **Round-trip with the advanced editor (`/simple` ↔ `/`).** "Edit & fine-tune" writes the doc to `sessionStorage["tbbqvisualgen.session.v4"]` **and** sets `tbbqvisualgen.simple.handoff`. On returning to `/simple`, it adopts the editor's saved (edited) doc as a `custom` override, renders/exports THAT, and shows a "Fine-tuned in editor · Revert" banner — so manual tweaks (e.g. nudging the label) persist back into the simple panel. The override is kept in `tbbqvisualgen.simple.custom`. Any form/format edit drops the override (baseline-ref compare, StrictMode-safe) and rebuilds from the form. ~~Clicking a format button always clears the override~~ **SUPERSEDED 2026-07-29 (round 4):** a format click now PARKS the tuned override and revives the design saved for the target format, when one exists. The "stuck square doc on a 16:9 canvas" hazard this clearing used to prevent is handled by the cross-format refusals in `retargetTunedDoc` and `retargetPartnerLayout` (both bail on any format/size mismatch, tested). Do NOT restore `revertCustom()` on the format buttons — it would wipe the loaded-template identity and break the coverage hints. Verified adoption end-to-end via a seeded-sessionStorage redirect test.

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

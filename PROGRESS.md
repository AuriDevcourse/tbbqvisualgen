# TechBBQ Visual Generator — Progress

Single living doc for picking the project back up. Read **SESSION HANDOFF**
first, then **Architecture**. The chronological log at the bottom is reference,
not required reading.

---

## SESSION HANDOFF — 2026-08-10 (6): HighBridge out, padded logos fixed

### State: PUSHED to master as `fd8b739`

Gates at push: **201/201 vitest**, **tsc clean**, **production build clean**.
Rounds (2) through (6) below all shipped in that one commit, and prod
auto-deploys from master — so the community wall is live.

**`src/auth.ts` was deliberately held back** and remains an uncommitted local
change, keeping the dev login bypass out of the prod codebase. Do not
`git add -A` without excluding it again. The rest of handoff (1) still stands:
the Google OAuth client secret is still stale and prod sign-in is on borrowed
time.

### What changed

1. **HighBridge removed** from the community set — it sits at Community tier in
   Airtable but has an exception (Auri). 86 → **85**, so the pages are now
   **30 / 30 / 25** and **Royal Danish Academy moved from page 3 to page 2**,
   because the pages are computed slices. Noted in the file header: a regenerate
   from Airtable WILL bring HighBridge back unless someone reads that line.
2. **Fixed 11 logos that rendered a fraction of their neighbours' size.** Not an
   Airtable problem — the files were right, their viewBoxes were not. Every one
   was a wide wordmark inside a square 100×100 box, and a contain-fit cell
   cannot tell padding from artwork. Women in Data Science filled **17%** of its
   box height; ESA BIC filled 14%.
   - The four Auri asked about: Odense Robotics, Terkko Health Hub, Women in
     Data Science, SKYtek.
   - Seven more found by scanning the whole set: Copenhagen Fintech, Copenhagen
     Institute for Futures Studies, ESA BIC Denmark, Gothenburg Tech Week, IDA
     White, Royal Danish Academy, The Kitchen.
   - All 84 community SVGs now report tight. Originals in
     `.logos-trash/viewbox-2026-08-10/`.
3. **New `scripts/tighten-logo-viewbox.mjs`** (`npm run logos:tighten`). Renders
   with sharp, finds the alpha bounding box, rewrites the viewBox to it. Only
   the window changes — no path data is touched. `--check` reports without
   writing; re-running is a no-op ("already tight").

### Numbered next steps

1. **Re-export a wall and compare.** The tightened logos should now match their
   neighbours in size. Verified by numbers only, as with every round today.
2. **`The Kitchen.svg` is also in the LIFE SCIENCE set** — that wall's rendering
   changes too (for the better: the mark was filling 76×46% of its box). Worth a
   look before re-posting Life Science.
3. Consider freezing the community pages as explicit lists. Two boundary shifts
   have already happened in one day (the HighBridge removal moved a partner
   between posts), and that undermines "who did we already thank".

### Gotchas

- **A square `viewBox` on a wide wordmark is the single most common logo defect
  here** — every `white-*.svg` exported from the same tool has it. Run
  `npm run logos:tighten --check` on any newly imported batch.
- **`tone: light` says nothing about SIZE.** A padded logo passes every existing
  check and still renders three times too small.
- **Building while `next dev` runs corrupts the shared `.next`.** Stop the dev
  server (and kill its orphaned node children) before `npm run build`.

### File pointers — everything touched today

- `src/data/partnerSets.ts` — `COMMUNITY_PARTNERS` (85), `COMMUNITY_PAGES`, and
  a header comment recording every drop, rename and white-cut decision.
- `src/data/partnerSets.test.ts` — the `community roster` block: page coverage,
  cross-page duplicates, light-only, and the saturated-fill white check.
- `src/lib/simpleLayout.ts` — `THANKS_HEADLINE_CAP` (0.08 = 120px at 1:1),
  `THANKS_GRID_BIAS`, `THANKS_SCRIM_MAX`, `thanksFlatMaxColumns()`,
  `shuffleWallLogos()`, `canvasChoices()` (the scrim fix), and
  `PartnerForm.scrim`.
- `src/lib/simpleLayout.test.ts` — flat-wall columns, scrim (including the
  tuned-design regression), and the shuffle invariants.
- `src/app/simple/page.tsx` — the "Shuffle order" button and "Dim background"
  stepper, around the existing Logos / Bigger first steppers.
- `scripts/tighten-logo-viewbox.mjs` — `npm run logos:tighten [--check]`.
- `public/logos/` — 16 new files, 11 tightened. Originals of the tightened ones
  in `.logos-trash/viewbox-2026-08-10/`.
- `src/auth.ts` — the ONLY file not committed. Dev bypass, local-only.

---

## SESSION HANDOFF — 2026-08-10 (5): scrim bug fix + shuffle

### State: green, uncommitted

Gates: **201/201 vitest**, **tsc clean**, eslint clean on changed files.

### What changed

1. **Fixed the scrim being dead on a tuned design.** `retargetTunedDoc` and
   `retargetPartnerLayout` carried `backgroundId` and `accentId` from the
   rebuild but not the overlay, so the slider only worked on a wall whose shape
   had never been tuned (Auri saw it work on Community 3/3 — 26 logos — and
   nowhere else). Both now share a `canvasChoices(rebuilt)` helper covering
   background, accent AND overlay. Assigned unconditionally, so dragging back to
   0 clears rather than leaving a stale scrim. **The test was verified to fail
   without the fix** (`expected undefined to be 0.3`), not just to pass with it.
2. **"Shuffle order" button** on the Thank you sidebar. `shuffleWallLogos()` in
   `simpleLayout.ts` — Fisher-Yates, `rand` injectable so the tests assert the
   arrangement. Two invariants under test: the lead tier shuffles WITHIN itself
   so main partners stay in the front cells, and logos parked beyond `logoCount`
   never move into view.

### Numbered next steps

1. Still unrendered by me. Check the scrim now responds on Community 1/3 and
   2/3, and that Shuffle reorders the grid.
2. **Any wall tuned before today still carries its old geometry.** Press Revert
   to rebuild at 5-across, then Update to re-save the library item.
3. Handoffs (2), (3), (4) all still open.

### Gotchas

- **A form field that is a WHOLE-CANVAS property must be added to
  `canvasChoices`**, or its control silently dies whenever a tuned design is on
  screen. This has now bitten twice: background first, scrim second.
- **`sed`/regex mutation of `simpleLayout.ts` from Git Bash silently no-ops** —
  the file is CRLF, so a pattern written with `\n` matches nothing. It looks
  like the mutation ran and the test "passed". Delete by line number instead.

---

## SESSION HANDOFF — 2026-08-10 (4): 5-across grid + background scrim

### State: green, uncommitted

Gates: **197/197 vitest**, **tsc clean**, eslint clean on every changed file.

### What changed

1. **A flat wall now flows 5 across, not 6.** New `thanksFlatMaxColumns()` in
   `simpleLayout.ts`; `thanksGridColumns` took an optional 4th `maxCols` arg.
   A 30-logo square goes 5×6 and each cell grows from 164×74px to **210×87px**
   (+28% wide, +18% tall). The two-tier investor wall is exempt on purpose — its
   support tier stays 6 across, because being wider than the lead tier is the
   only thing making main partners look bigger. Life Science is unaffected: 25
   logos already scored 5.
2. **A "Dim background" stepper** on the Thank you sidebar, 0–60% in steps of
   10. Writes `overlayColor: #000000` / `overlayOpacity` / `overlayBlend:
   multiply` onto the design, which the renderer already supported and layers
   BELOW the logos and headline. New `PartnerForm.scrim` field, read back in
   `formsFromDoc` from the doc's own overlay so it survives an editor
   round-trip. At 0 the doc carries no overlay keys at all, so an untouched
   wall is byte-identical to one built before the slider existed.

### Numbered next steps

1. **Export a 1:1 with the scrim at 20–30% and confirm it reads.** Still no
   browser this session; all four rounds of changes are verified by numbers
   only.
2. Then check 16:9. It also flows 5×6 now (cell 299×79px) — that is six rows on
   a 1080px-tall canvas, the most cramped case in the set.
3. Everything from handoffs (2) and (3) is still open.

### Gotchas

- **At 30 logos the wall now fills the full height** (first row y 0.369, last
  0.907) because six rows of taller cells consume all the slack —
  `THANKS_GRID_BIAS` has nothing left to distribute and only bites on smaller
  walls. If the wall ever needs to sit higher again at 30, the lever is
  `CELL_ASPECT` or the row gap, not the bias.
- **The 30-logo grid is shrink-limited**: natural height 979px against 904px of
  room, so cells scale by 0.92 to fit. Adding a seventh row would shrink them
  further rather than overflow.
- **The two-tier support row shows 7 cells, not 6**, when 13 support logos flow
  6/7 — that is the deliberate orphan-squeeze rule, not a bug. Assert the
  support row is WIDER than the lead row rather than asserting an exact 6.

---

## SESSION HANDOFF — 2026-08-10 (3): wall typography + white-logo rule

### State: green, uncommitted. First real render reviewed by Auri.

Gates: **192/192 vitest**, **tsc clean**. Auri exported a 1:1 community wall and
gave three notes; all three are in.

### What changed

1. **Headline is 120px semi-bold**, was 162px at weight 800.
   `THANKS_HEADLINE_CAP` 0.108 → **0.08**, `weight` 800 → **600**. The cap stays
   a FRACTION of the shorter side, so 16:9 and 9:16 render 86px rather than a
   120px headline on a 1080px canvas. Measured, not assumed: a probe run through
   the real builder returns `fontSize=120 weight=600` on square.
2. **The logo block sits higher.** New `THANKS_GRID_BIAS = 0.42` in
   `simpleLayout.ts` — the share of leftover height placed ABOVE the block, where
   0.5 is the old dead-centre. On a full 30-logo square the first row moves from
   y 0.549 to **0.441**. Tune that one constant to move the wall; lower = higher.
   16:9 and 9:16 are unaffected, their block already fills the room.
3. **Always the white cut.** AIESEC shipped as its blue-and-white PNG because
   `tone: light` cannot catch a mostly-white logo with a coloured mark. Every one
   of the 86 was re-checked by READING THE SVG SOURCE for saturated fills. Two
   were wrong and are repointed: AIESEC → `Aiesec White.svg` (imported), Talent
   Garden → `Talent Garden White.svg` (imported, the old file carried #f17b68).
   Library 884 → 886. A new test, "points at white artwork", now fails any
   saturated fill while allowing the near-white greys six official files use.

### Numbered next steps

1. **Re-export the 1:1 wall and check the new spacing.** The numbers are
   verified, the pixels are not — no browser was available this session.
2. Then walk pages 2 and 3, and the 16:9 / 9:16 cuts.
3. Everything in handoff (2) still open: confirm the three dropped records and
   ESA BIC with marketing, decide alphabetical vs curated paging.

### Gotchas

- **`tone: light` is not "is white".** It measures average brightness, so a white
  logo with a blue mark passes. Read the SVG fills instead — that is what the new
  test does.
- **Six community logos are legitimately near-white grey**, not #FFF (#E2E2E2,
  #f1f2f8, #f3f3f3). That is the official artwork; do not "fix" them.
- **`console.log` inside a vitest run is swallowed here.** To probe layout
  geometry, write to a file with `node:fs` and read it after the run.

---

## SESSION HANDOFF — 2026-08-10 (2): Community partner wall

### State: community set built and green, uncommitted

Gates: **191/191 vitest** (was 175), **tsc clean**. All 86 logo URLs fetch 200
from the dev server. Not visually confirmed in a browser — Playwright's profile
was locked by another session and the Chrome extension was offline, so the wall
itself has not been eyeballed. **Open `/simple`, pick Partner > Thank you, and
click Community 1 / 3 before this goes anywhere near a real post.**

### What this session added

The **Community** tier, sourced from Airtable rather than the website (the
website has no community-partner page — `/community-partners/` and
`/event-partners/` both 404).

- Source: base `appgXNjXJqpk9Ebxd`, table `tblTecOBecLQCNIeD`, view
  `viw7FVbsTb9IRaWF0` ("Partner Deliverables 2026"), field **Partnership Tier
  (from Tier)** = `Community`. 89 records, 86 usable partners.
- **14 logos imported** from the Airtable attachments into `public/logos`, all
  measured LIGHT by the manifest. Library 870 → 884: Amela, Brighteye Ventures,
  Copenhagen Climate Week, Crescita Partners, Daya Ventures, Embassy of India,
  EUCO, Horizon Deep Tech Summit, Indian Danish Chamber of Commerce, Nornorm
  White, PropTech Denmark White, Swedish Incubators and Science Parks,
  Sustainary White, Tech Arena Sweden.
- The other 72 were already in the library under names the Airtable record does
  not match — that is why a plain name lookup is not enough here. Worst offenders:
  `Clean` → `Clean Cluster`, `MADE` → `Futuremanufacturers`, `DI` →
  `Dansk Industri`, `Shine` → `IVN Powered by Shine`, `CSE` → `CBS CSE White`.
- `COMMUNITY_PARTNERS` (86, alphabetical) + `COMMUNITY_PAGES` in
  `src/data/partnerSets.ts`, paged 30 / 30 / 26, exposed as three sidebar
  buttons: **Community 1 / 3**, **2 / 3**, **3 / 3**. `featuredCount: 0` on all
  three — a community tier has no lead partners.
- Four new tests in `partnerSets.test.ts`: pages cover the roster in order,
  `COMMUNITY_PER_WALL` stays equal to `THANKS_MAX_LOGOS`, no partner appears
  twice ACROSS pages (the per-set checks only see one page), and every entry
  resolves to LIGHT artwork.

### Numbered next steps

1. **Eyeball all three walls** at 1:1, 16:9 and 9:16. 30 cells is the ceiling
   the layout was designed against, but no community wall has been rendered yet.
2. **Confirm the three dropped records with marketing.** Business Helsinki
   (identical logo to AISTART Incubator), Fututo Perfecto Innovation (misspelled
   duplicate, no white asset, `Put on web` off), Product Therapy (no logo at
   all). Also confirm **ESA BIC Denmark**, which IS included despite `Put on web`
   being unticked.
3. **Decide whether the pages should be alphabetical or curated.** Alphabetical
   means page 1 is A–E and page 3 is R–Z, so the three posts are visibly uneven
   in brand recognition. A curated split would mix them.
4. Everything from handoff (1) below still applies — above all, **do not commit
   `src/auth.ts`**, and regenerate the Google OAuth secret.

### Gotchas

- **The Airtable tier field is `Partnership Tier (from Tier)`**, a lookup, NOT
  the similarly named `Partnership Tier (from Partnership Tier)` (empty) or the
  `Partnership Type 2026` single-select (partially filled). Filtering on the
  wrong one silently returns zero community records.
- **Three library files are named `Terkko Health Hub`** and only the `.svg` is
  light; the `.webp` is dark and the `.png` is mixed. A name lookup grabs the
  wrong one. Same trap for imec, Mesh, Nornorm, PropTech, Sustainary.
- **Two entries are PNG** (`Aiesec.png`, `Clarmacapital.png`). Already white, so
  they render, but the in-app tint is SVG-only.
- **Do not build a `partnerSets.ts` block through `node -e` in bash.** Backticks
  in the heredoc get eaten by the shell and the file lands half-written; the
  first attempt had to be reverted with `git checkout`.

### File pointers

- `src/data/partnerSets.ts` — `COMMUNITY_PARTNERS`, `COMMUNITY_PAGES`, the
  header comment recording every drop and rename decision.
- `src/data/partnerSets.test.ts` — the `community roster` describe block.
- `src/lib/simpleLayout.ts:672` — `THANKS_MAX_LOGOS = 30`, the reason for paging.
- `src/app/simple/page.tsx:1546` — where the sidebar renders one button per set.

---

## SESSION HANDOFF — 2026-08-10 (1): local auth bypass

### State: local-only auth bypass in the working tree, NOT committed

`master`, prod untouched. One uncommitted file: `src/auth.ts`. Everything from
the 2026-08-04 handoff below still stands; this session shipped no product
change, only a way to keep working while Google SSO is broken.

### What happened

Google sign-in fails locally AND will fail in prod once sessions expire. The
token exchange returns `invalid_client` · "The provided client secret is
invalid." **`AUTH_GOOGLE_SECRET` is stale** — the secret was rotated or deleted
in Google Cloud Console. The redirect URI is fine; Google redirects back
correctly and only the server-to-server token call fails. Auth.js surfaces this
as a generic `/api/auth/error?error=Configuration` page, which says nothing; the
real cause is only in the dev server log.

To keep working, `src/auth.ts` gained a **dev-only bypass**:

- Reads `DEV_FAKE_USER` once at module load. Active only when
  `NODE_ENV === "development"` **and** the address ends in `@techbbq.org`.
  Fails closed, so a production build ignores the variable even if it ever
  leaks into the deploy environment.
- `handlers.GET` answers `/api/auth/session` with the fake session, so the
  header chip and the library panel render as signed in. Every other Auth.js
  route keeps real behaviour.
- `.env.local` sets `DEV_FAKE_USER=abs@techbbq.org` (matched to the `updated_by`
  on existing library items so local saves attribute correctly). Gitignored.
  `.env.example` documents the flag, commented out.

Verified: `/api/auth/session` returns `abs@techbbq.org`, `/api/library` returns
200 with the real items, `tsc --noEmit` clean.

### Numbered next steps

1. **Regenerate the Google OAuth client secret.** Cloud Console > APIs &
   Services > Credentials > the OAuth client (`910521428210-…`) > Add secret.
   Update it in **both** Vercel env and `.env.local`. Until then prod sign-in is
   living on borrowed time.
2. **Do not commit `src/auth.ts`** unless you deliberately want the bypass in
   the repo. `master` is prod and auto-deploys. To drop it: `git checkout
   src/auth.ts` and remove the `DEV_FAKE_USER` line from `.env.local`.
3. The 2026-08-04 next steps (video export by hand, official "Thank You" items
   for 16:9 + 9:16, the 3 missing investor logos, `Symbio.svg`) are all still
   open.

### Gotchas

- **Auth.js hides the real error.** `error=Configuration` in the browser is
  useless. Read the `next dev` output for the `[auth][details]` block.
- **Sign-in only gates the team library** (`/api/library`). `/editor` and
  `/simple` work fine signed out, so a broken SSO is not a full block.
- **Orphaned dev servers.** Seven stale `node` processes from this project were
  holding `.next\dev\lock`, so a second `next dev` died with "Unable to acquire
  lock". Kill them by command-line match before restarting. Port 3000 is
  usually taken by the unrelated `GITHUB/airtable` project, so this one lands
  on **3001**.

### File pointers

- `src/auth.ts` — the bypass, the `devUser` guard and `devSession()`.
- `src/app/api/auth/[...nextauth]/route.ts` — re-exports `handlers`, unchanged.
- `src/app/api/library/route.ts`, `src/app/api/library/[id]/route.ts` — the only
  `await auth()` call sites.
- `src/components/AuthChip.tsx` — reads `/api/auth/session` directly, which is
  why the bypass has to intercept that route to look signed in.

---

## SESSION HANDOFF — 2026-08-04

### State: everything is committed and LIVE

`master` at **`0bb5089`**, pushed, working tree clean, prod auto-deployed to
tbbqvisualgen.vercel.app. Gates at handoff: **175/175 vitest, tsc clean,
`npm run build` clean**, changed files eslint-clean (the one error in
`CanvasBackground.tsx:287` is pre-existing and unrelated).

This supersedes the 2026-07-30 "Where the code is" section further down, which
still says everything is uncommitted on a `sales-announcement` branch. It is not.

### What this session shipped

1. **"Thank you" partner wall** — a fourth partner LAYOUT (not a template kind),
   so it inherits parking, retargeting, the editor round-trip and the library
   snapshot. Headline over an auto-flowed logo grid, 1–30 cells.
2. **A lead tier** (`featuredCount`, "Bigger first" in the sidebar): the first N
   logos render bigger. Main partners over support partners.
3. **Two ready-made sets** in `src/data/partnerSets.ts` — Life Science (25) and
   Investor (17), each carrying its own headline and tier split, one button each.
4. **Investor Relations circle accents** — a filled bubble + white ring in
   opposite corners, fill by topic (gradient / LP Forum orange / Investor Day
   red). Real shape layers, so they are draggable in the editor.
5. **Backgrounds**: 3 Life Science gradients + 2 Investor Relations gradients.
6. **Logo library 830 → 870**, four padded SVGs tightened, three logos refreshed.
7. **Video export: any length 1–60s**, plus a fix for a background tab
   truncating or hanging a recording.

### Numbered next steps

1. **Run one video export by hand and check the toast.** No recording has ever
   been verified from an agent session — `requestAnimationFrame` fires zero times
   in a hidden tab and the automated tab is always hidden. The toast reports
   frames, duration and MB, so it is self-checking.
2. **Save an official "Thank You" library item per format.** One exists for 1:1
   (`29f38736-e77f-4e6d-8f35-c8aa7b84e041`, the source of the accent defaults);
   16:9 and 9:16 have none. If it should become a flavour button next to
   "Official Partner", add its id to `DEFAULT_ITEM_IDS` in `src/app/simple/page.tsx`.
3. **Chase the 3 investor logos marketing owes us**: Novo Nordisk (the company,
   not the foundation), Mazanti-Andersen, and a WHITE Ada Ventures (ours is dark
   PNG, and a PNG can't be recoloured in-app).
4. **Decide on `Symbio.svg`** — a redundant duplicate of the refreshed
   `Symbion.svg`. Left in place because retiring library files is Auri's call.
5. Older open decisions (duplicate logos, the 4 Investor Day font-dependent
   copies, remaining stale logos) are still listed under "Decisions waiting on
   Auri" below. Decision 7 there (commit + merge to master) is DONE.

### Invariants added this session — read before touching the wall

- **A form field that drives GEOMETRY must be visible in the role set**, or a
  retarget silently ignores it. The wall's cell count changes the role count; the
  lead tier gets its own role name (`logo-thanks-lead-N`). Both learned the hard
  way.
- **`panelShapeKey` includes tagged placeholder-frame roles.** Without them a
  tiered and a flat wall with no logos uploaded shared one key, and the flat
  tuning revived over the tiered rebuild.
- **The support tier must be at least one column WIDER than the lead tier** —
  cell size comes from the column count, so that IS the size difference.
- **Sizing constants are measured, never guessed.** Onest 800 averages 0.54 per
  character in sentence case, 0.64–0.66 uppercase (`canvas.measureText`).
- **A tuned doc beats any screenshot** as a source of geometry: read it with
  `fetch('/api/library/<id>')` from the signed-in browser.
- **Hand-supplied SVGs are often mostly padding** (BioInnovation Institute was
  17% artwork). A contain-fit cell can't tell padding from logo — tighten the
  viewBox to the artwork bounds.

---

## Round-by-round detail — 2026-08-04 (newest first)

### Round 60 — pick any video length, 1-60s

`videoSeconds` is a real control now, not two presets. Quick Templates puts a
**Video length** section in the save-format popover: one-click chips (3, 10, 15,
30, 60) plus a number field for anything in between, and picking a length also
switches the format to MP4 — one click from "JPG" to "15s video". The editor gets
a compact seconds field that only appears once MP4 is the chosen format. The row
label carries the number ("MP4 · 15s video") because committing 30 seconds of
real time deserves to be visible before you click. Bounds live in `useExport`
(`VIDEO_MIN_SECONDS` / `VIDEO_MAX_SECONDS` / `VIDEO_PRESETS`) so the pickers
cannot offer something the recorder then clamps away.

**Measured, and it explains round 59's bug exactly: `requestAnimationFrame` fires
ZERO times in a hidden tab.** Probed in the page — 0 frames in 3 seconds. So the
old wall-clock loop did one of two things when the tab wasn't in front: hung
forever at its first `await nextFrame()` (hidden from the start), or, if the tab
was hidden mid-capture, resumed to find the wall clock already past the deadline
and exited with whatever frames it had — a truncated video with a success toast.
The frame-counting loop plus `waitVisible()` covers both.

It also means **no capture can be verified from an agent session**: the automated
tab reports `document.hidden === true` whenever the Chrome window isn't
frontmost, which it never is. Every video change here is verified by reading and
by the UI, never by a real recording. **Run one by hand after touching this.**

### Round 59 — a 30-second video option, and the truncation bug it exposed

Gates: tsc clean, build clean, 175/175 vitest. **The 30s capture itself is NOT
verified end to end** — see below.

`exportMp4(filename, onBeforeCapture, seconds = 3)` takes a duration, and both
Quick Templates and the editor offer **MP4 · 3s** and **MP4 · 30s**
(`VIDEO_SECONDS` maps the save-format id to seconds). 30s is 900 frames, roughly
22MB at the existing 6Mbps, which the in-memory muxer handles fine. Clamped to
1-60s.

**Attempting to test it found a real bug: a background tab silently truncated the
video.** The capture loop ran on wall-clock (`while (now - start < captureMs)`),
but Chrome suspends `requestAnimationFrame` in a hidden tab while
`performance.now()` keeps running — so switching tabs mid-recording produced a
short clip with a cheerful success toast. Barely noticeable at 3s; guaranteed to
bite at 30s.

The loop now counts **FRAMES**, not seconds:

- `while (frameIndex < totalFrames)` — the output is always exactly the length
  requested, however long the capture takes in real time.
- `waitVisible()` parks the loop while the tab is hidden and rebases the pacing
  clock afterwards, so a tab switch pauses the recording instead of corrupting
  it. Animation sampling still runs on visible wall-clock, which is what keeps
  the motion speed right.
- After 90s hidden it **throws** rather than finishing short. A 30s recording
  that returns 4s with a success toast is worse than an error.

**Why it is unverified:** a capture needs the tab in FRONT, and the automated
browser tab reports `document.hidden === true` whenever the Chrome window is not
the focused window — which it never is during an agent session. The 3s path has
the same requirement and was verified by Auri using it. **Someone has to run one
30s export by hand**; the success toast reports frames, duration and MB, so it
is self-checking.

---


### Round 58 — no logo left stranded on its own row

Gates: **175/175 vitest, tsc clean, build clean**.

Auri: *"if there is only one logo left on the different line, we should try to
squeeze it in the one previous line."* Six-across left the investor wall's 13th
support logo (F&P) alone on the last row. **`thanksRowCounts(count, cols)`** is
now the single source of row sizes, and it moves a lone last logo UP into the row
above: 13 six-across flows **6, 7** instead of 6, 6, 1.

Mechanics worth knowing, because they were the design question:

- **The squeezed row narrows its CELLS, it does not overflow the margin.** Seven
  cells in the space of six, so those logos are ~20% narrower.
- **Row HEIGHT never changes**, so the size difference is width-only and a
  wordmark shrinks while a square mark barely does. Shrinking the whole tier to
  7 columns was the alternative and it made every support logo smaller for the
  sake of one.
- **Only ever moved UP.** A row of `cols + 1` is a small compromise; a row of one
  reads as a mistake.
- It applies to **both tiers and to the flat wall**, since `emitTier` now lays out
  from a row-count array rather than dividing by columns.
- The 9:16 story cap bends for it too: 13 support logos three-across flow
  3, 3, 3, **4**.

---


### Round 57 — one headline size for every wall, and no more caps

Gates: **171/171 vitest, tsc clean, build clean**.

**"Why is the investor headline much smaller than the Life Science one?"** Because
both were fitted to their longest line and only the short one reached the size
cap: "our investor partners" (21 chars) came out at 108px against "our partners"
at the 162px cap. A longer headline was simply a smaller headline.

**Fix: wrap to the width the CAP allows, instead of shrinking to fit the line.**
The builder now word-wraps an unbroken headline at ~14 characters, so
"Thank you to our investor partners" becomes three lines at full size rather than
two small ones. Every wall's headline is now the same size. The set headlines
are single-line strings for exactly this reason — **a typed Enter still wins**,
and that is the escape hatch if three lines is too heavy: type the break and get
two lines at a slightly smaller size.

**The headline renders as typed, not uppercased** (`uppercase: true` is gone).

**Glyph widths are now MEASURED, not guessed** — `canvas.measureText` with the
real font in the real page:

| | per character |
|---|---|
| Onest 800, sentence case | 0.486–0.532 → **0.54** used |
| Onest 800, uppercase | 0.635–0.658 (so the old 0.62 was still low) |

Two knock-on contracts, both of which a test caught:

- **`thanks.headline` counts as a CAPTION in `carryWords`.** Its newlines are now
  layout, not the user's Enter presses, so when the words are unchanged the tuned
  layer keeps its own breaks — otherwise a hand re-break in the editor was
  overwritten by the builder's wrap on the next form edit.
- **`formsFromDoc` flattens the headline's newlines back to spaces** when
  reconstructing from layers, the same contract the panel captions use. Without
  it, every load re-froze the builder's wrap as if the user had typed it.

Note for anyone confused by an old design: **an existing custom wall keeps its
2-line headline** until Revert, because the caption rule protects its breaks.

---


### Round 56 — the defaults now come from Auri's own approved wall

Gates: **171/171 vitest, tsc clean, build clean**.

Auri tuned a wall, saved it as the **"Thank You"** library item
(`29f38736-e77f-4e6d-8f35-c8aa7b84e041`), and said "this is the way I like it to
look". Its geometry is now the default. **Read the doc, don't re-measure a
screenshot** — `fetch('/api/library/<id>')` from the signed-in browser returns
the whole thing, and a tuned doc is the only authority worth having.

He moved all four circles and shrank the bottom-left pair:

| role | was | now |
|---|---|---|
| accent.0.ring | 0.851, 0.020, r 0.171 | **0.937, 0.000, r 0.171** |
| accent.0.bubble | 0.937, 0.125, r 0.123 | **0.993, 0.085, r 0.123** |
| accent.1.ring | −0.040, 0.861, r 0.217 | **−0.063, 0.995, r 0.154** |
| accent.1.bubble | 0.161, 1.016, r 0.183 | **0.139, 1.000, r 0.139** |

That is the third and final pass on this geometry: eyeballing had the rings far
too small, a least-squares fit to the 2025 reference got the radii right but the
positions were still off (the reference is a different composition), and the
tuned doc settles it.

**"For smaller logos it should be 6 in one row."** The support tier now fills the
row — `thanksMaxColumns()` is 6 on anything square or wider, 3 on a 9:16 story —
and that **overrides the orphan-avoiding score**, so the investor wall's 13
support logos flow **6, 6, 1** rather than 5, 5, 3. Consequence to know: a lone
logo on the last row is now possible, and 12 or 18 support logos divide evenly if
that ever matters.

**A test caught the obvious over-reach**: forcing 6 columns hit the FLAT wall too
and turned the 25-logo Life Science set into 6,6,6,6,1. A wall with no lead tier
has no "smaller" logos, so it keeps the balanced auto rule and stays a clean 5×5.
Both are pinned now.

---


### Round 55 — the headline was touching the walls

Gates: **168/168 vitest, tsc clean, build clean**.

Auri's investor wall exported with "THANK YOU TO OUR INVESTOR PARTNERS" running
edge to edge. Two compounding causes, both now measured rather than guessed:

1. **The glyph-width estimate was 10% too narrow.** The builder sized the
   headline with 0.56 as the average glyph width of uppercase Onest at weight
   800. Measured off Auri's own 1500px export — 1457px of text at fontSize 112
   over 21 characters — it is **0.62**. Every long headline came out ~10% wider
   than the fit intended.
2. **It aimed at the full margin.** 0.88 of the width, so even a correct fit
   ended flush with the margin. It now targets **0.82**, which leaves ≥9% clear
   on each side in all three formats.

Short headlines are unaffected: they hit the 0.108 font cap before the width
limit. A test pins the rule (`the headline keeps off the walls`) across three
formats and four headline lengths, so the next tweak can't quietly undo it.

**Not a bug, worth knowing:** Auri also asked why NordicNinja was "completely
randomly placed" in that export. A fresh fill lays the wall out correctly (4
lead, then 5/5/3 at 1:1 — verified) so that cell had been **moved by hand**, and
**Revert** restores the grid. The likely cause is worth remembering: the accent
circles sit BEHIND the logos, so clicking one where a logo overlaps grabs the
logo on top, and dragging it moves the logo instead of the circle.

The panel builder still sizes its headline with 0.55 at weight 600. It has not
been reported as touching the walls, and changing it would move the approved
golden layouts — left alone deliberately.

---


### Round 54 — the accents became movable layers, and were re-measured

Gates: **167/167 vitest, tsc clean, build clean**, changed files eslint-clean.

Two things came straight back from Auri on round 53's accents: **"I should be
able to move them in fine-tuning"** and **"it's clearly not placed correctly."**
Both are fixed, and the first one reverses a design decision from one round
earlier — worth reading before touching this again.

**They are real SHAPE LAYERS now, not a background SVG.** `src/lib/accents.ts`
(pure, no React) emits four `circle` shapes tagged `accent.0.ring`,
`accent.0.bubble`, `accent.1.ring`, `accent.1.bubble`. In the editor they are
ordinary layers: drag, resize, recolour, change fill mode, hide, delete,
reorder. Round 53 put them in the background layer specifically to dodge the
retarget problem; the cost was that they could not be touched, which was the
wrong trade. The retarget problem is instead solved head-on:

- **`syncAccentShapes(tuned, rebuilt)`** — the tuned doc owns the GEOMETRY (the
  whole point of dragging one), the rebuild owns the CHOICE (which accent, or
  none). Called in BOTH retarget paths.
- **A deleted accent layer stays deleted.** Circles are only added when the doc
  had none, which is the switched-on case. A test pinned this: the first version
  re-added any missing role, so a deleted circle came back on the next keystroke.
- **`applyAccent(design, id, w, h)`** is the editor's path, where there is no
  form to rebuild from. Ids derive from the role, so repeated switching cannot
  produce duplicates.
- Shapes default to the BOTTOM of the layer stack (`defaultOrder` in
  `DynamicTemplate` splits accent shapes out and puts them before the images) —
  an ordinary shape sits ABOVE photos, which would have put a bubble over the
  logos. Drag one forward and the stored order wins.
- The Layers panel names them **"Accent bubble 1" / "Accent ring 1"** instead of
  "Circle · a3f9" — this is the one shape set a user goes looking for by name.

**The geometry was re-measured, not re-eyeballed.** A least-squares circle fit
to the orange mask and the white-ring mask in each half of Auri's reference
screenshot, with two corrections that mattered: the ring's overlap over the
bubble had to be excluded from the bubble's boundary (it dragged the first fit
50px off) and pixels near the frame excluded (those arcs are clipped). Result:
the bubbles were roughly right all along, and **both RINGS were far too small
and too close to their bubble** — each ring is nearly twice its bubble's radius
and mostly cropped. That was the "not placed correctly".

Side benefit: the export worry from round 53 is gone. A shape circle is a div
with a CSS gradient, which html-to-image handles natively — no `url(#gradient)`
reference to survive the clone.

---


### Round 53 — Investor Relations circle accents

Gates: **158/158 vitest, tsc clean, build clean**, changed files eslint-clean.

Auri's 2025 LP Forum visuals put a filled bubble and an empty white ring in
opposite corners, cropped by the frame, and **the bubble's FILL says which
investor thing the post is about**. That is now a picker — `ACCENT_REGISTRY` in
`src/components/CanvasAccents.tsx`:

| id | fill | for |
|---|---|---|
| `investor` | brand gold→red gradient | investor relations in general |
| `lpForum` | `#EE7D4B` orange | LP Forum |
| `investorDay` | `#FF4258` red | TechBBQ Investor Day |

The two solid colours are sampled from Auri's own `FilledCircle_Orange.png` and
`FilledCircle_red.png`; the ring stroke (1.1% of its diameter) is measured off
`Empty Circle.png`; the four circle positions are measured off the 2025
reference (a smaller pair biting the top-right, a larger pair the bottom-left).

**Drawn as one inline SVG, NOT the source PNGs.** The artwork is two circles and
a stroke: as SVG it stays crisp at any canvas size, costs no download, exports
through html-to-image, and the fill can change without another asset. The PNGs
are 5000-7000px and ~250-310KB each.

**It lives on `design.accentId`, not as shape layers.** That decision is the
whole design of this feature:

- Shapes would sit in the layer stack, need role tags, and — the real problem —
  `retargetTunedDoc` copies `tuned.design.shapes` wholesale, so toggling the
  accent on a hand-tuned design would have been silently ignored. As a design
  field it is carried explicitly next to `backgroundId`, in both retarget paths.
- The builders **spread** it in (`...(form.accentId ? {accentId} : {})`) rather
  than assigning, so a design with no accent is byte-identical to what the
  builders produced before — the golden layout snapshots did not move.
- `accentId` is on all three sidebar forms and restored by `formsFromDoc`, so it
  survives a library round-trip.

Rendered in `DynamicTemplate` right after the background but **outside the
`data-canvas-bg` wrapper** — the MP4 export hides that wrapper and rasterizes
everything else once, so accents belong with the content, not the live
background canvas.

**The picker thumbnail is NOT the real composition scaled down.** First attempt
was, and every option looked like the same dark square: at swatch size the
corner circles shrink to specks. It draws its own bubble-plus-ring pair instead,
where the fill is the point.

Available in Quick Templates AND in the editor's Canvas tab, so fine-tuning a
design doesn't mean losing the ability to change it.

**The event logos were already in the library** (`LP Forum White`,
`TechBBQ Investor Day White` + Colour variants) — pick them like any other logo.

**Not verified by me: a still export with an accent.** The SVG uses a
`url(#gradient)` fill, and html-to-image clones inline SVG with its `defs`, so
it should be fine, but nobody has eyeballed a saved JPG yet. Worth one Save
image before this goes on a real post.

**Two Investor Relations backgrounds** to go with them, in their own picker
group: `ir1` and `ir2`, near-black with one warm ember glow (low on the first,
high on the second). From `Desktop/TBBQ/2026 Season/2x/`, re-encoded with sharp
from ~255KB to 12KB each. `ir1` plus the gradient accents is the 2025 LP Forum
look almost exactly.

Also worth knowing: on a dense wall (the 25-logo Life Science set) the
bottom-left circles run under the last row of logos. They read fine because the
logos are white on top, but an investor post with fewer logos is where this
composition actually belongs.

---


### Round 52 — the lead tier, and the Investor partner set

Same branch. Gates: **154/154 vitest, tsc clean, build clean**, changed files
eslint-clean. Round 51 (below) is pushed and live; this sits on top.

**The wall has a LEAD TIER.** `featuredCount` on `PartnerForm`: the first N cells
render bigger, the rest fill the grid underneath. That is the shape the Investor
Partners page has (MAIN over SUPPORT), and the sidebar exposes it as a **"Bigger
first"** stepper. 0 = one flat grid, which is what the Life Science set uses.

Three things this cost, all of them non-obvious:

1. **The lead tier needs its own ROLE, not just a bigger box.**
   `logo-thanks-lead-N` vs `logo-thanks-N`. The tier drives geometry, so it has
   to be visible in the role set — otherwise `retargetPartnerLayout` carries a
   tuned design across a tier change and silently ignores it, the same trap the
   cell count avoids by changing the role count.
2. **`panelShapeKey` had to learn about tagged frames.** It counted placeholder
   frames but never read their tags, so on a wall with no logos uploaded a
   tiered doc and a flat doc of the same size shared one key: the flat tuning
   revived straight over the tiered rebuild. The key now appends the sorted
   tagged frame roles (`|slots:…`), and `retargetTunedDoc` refuses a pair whose
   tagged frames stand in for different slots. Panel person-frames are untagged,
   so panel keys are unchanged.
3. **The support tier MUST be at least one column wider than the lead tier.**
   Cell size comes from the column count, so this is a hard constraint, not a
   preference. Without it a 9:16 story put 16 support logos in 2 columns against
   3 lead columns and rendered the SUPPORT partners bigger than the main ones.
   `thanksGridColumns` now takes a `minCols` floor; when there are too few
   support logos to be wider, the LEAD tier narrows instead.

**The overflow-scaling bug worth remembering:** when a tiered wall is too tall,
scaling only the CELLS by `roomH / natural` does not fit — the gaps are still
full size, so the block overshoots (a test caught a cell at 0.9625 against a
0.941 margin). Cells AND gaps have to scale by the same factor, which lands the
block exactly on the room.

**Two ready-made sets now, `src/data/partnerSets.ts`** (renamed from
`lifeSciencePartners.ts`): each set carries its logos, its headline and its tier
split, and the sidebar renders one fill button per set. So the Investor wall
arrives with "Thank you to our investor partners" and 4 main partners already
bigger, instead of saying "our partners" with a flat grid.

**Investor set: 17 of the 20 on the page.** Two names took a search, so they are
recorded in the file: `Worldfund White.svg` is WORLD FUND ("world fund" with a
space misses it) and `Forsikring Og Pension.svg` is the F&P monogram (rendered
and confirmed). **Three cannot go on a wall yet:**

- **Novo Nordisk** — the bull mark plus "novo nordisk". The library only holds
  Novo Nordisk FOUNDATION variants, a different organisation.
- **Mazanti-Andersen** — nothing in the library at all.
- **Ada Ventures** — `Ada Ventures.png` is DARK artwork, invisible on this
  canvas, and a PNG cannot be recoloured in-app (the tint is SVG-only).

Marketing has to supply white SVGs. A logo that fails to load is dropped rather
than left as a hole, with the count in the toast, so the wall is never published
with an empty cell.

**Four more padded logos tightened** the same way as round 51: Heartcore (60%
artwork), Rockstart (14%), Dealroom (17%), FBV (45%). Rockstart and Dealroom
were rendering at a seventh of their cell.

Verified in the browser at 16:9 and 1:1: the investor fill produces 4 bigger
main partners over 5/5/3 support, the headline and tier arrive with the set, and
switching back to Life Science resets both.

---


### Round 51 — the "Thank you" partner layout + Life Science backgrounds

Branch `partner/thank-you-template`, off `logos/airtable-white-2026`. Gates:
**141/141 vitest, tsc clean, `npm run build` clean**, changed files eslint-clean
(the one error in `CanvasBackground.tsx:287` is pre-existing).

**"Thank you" is a fourth PARTNER LAYOUT, not a fourth template kind.** It sits
next to One / Two / Four, so it inherits the whole partner pipeline for free:
parking, retargeting, the editor round-trip, the library snapshot, the flavour
pickers. `PartnerLayout` is now the shared union type
(`single | duo | quad | thanks`).

- Composition: one big centred uppercase headline (`thanks.headline`, autofit,
  weight 800) over an auto-flowed grid of contain-fit logos, last row centred.
  Slot roles are `logo-thanks-N`, empty cells are the usual gradient frames.
- **Its cell COUNT is a form field** (`logoCount`, 1-30, stepper in the
  sidebar) — the one thing no other layout has. So `SLOT_ROLES` couldn't be a
  constant: `thanksSlotRoles(doc)` reads the roles off the doc, and
  `retargetPartnerLayout` only carries tuning when the two role sets are
  IDENTICAL. A count change is a different composition: it parks and rebuilds,
  exactly like a speaker-count change.
- Logos beyond the count stay in `form.logos` — stepping 12 → 8 → 12 gets them
  back.
- `thanksGridColumns(count, aspect)` picks the columns: √(count × aspect),
  capped per format (6 at 16:9, 5 at 1:1, **3 at 9:16**), with a penalty that
  avoids a single orphan on the last row — 11 logos flow 4,4,3 rather than
  5,5,1. 12 at 16:9 gives 5,5,2, which is what the 2025 original did.
- Leftover height goes into the ROW GAPS (capped at 0.85 × cell height) instead
  of leaving the block floating in the middle of a tall canvas.
- **The TechBBQ lockup is off** on this layout (`showLogo: false`) — the grid
  uses the full canvas and the 2025 originals carry no lockup. Re-enable per
  post in the editor.
- **`syncPartnerChrome` bails when only one side is a wall.** The wall shares no
  chrome with the announcements (headline vs label chip, no lockup vs
  bottom-centre lockup); carrying it either way dropped a TechBBQ logo onto the
  grid's last row.
- `headline` is its own form field, so switching layouts never overwrites the
  label chip's wording (and the reverse). Pre-wall saved forms and library
  snapshots merge over `emptyPartnerForm()`, so `logoCount`/`headline` are never
  undefined.
- Export name: `16x9 - Thank You Partners` (One/Two/Four keep
  `- Partner Announcement`).

**One-click Life Science partner set.** `src/data/lifeSciencePartners.ts` holds
the 25 library files that cover the official Life Science **Partners page**, in
its order; the wall's **"Fill with Life Science partners (25)"** button fetches them
through the picker's own `asUploadedImage` (now exported), so they land as data
URLs exactly like an upload and a later rename can't break a saved wall. The
grid resizes to what actually loaded, and a logo that fails to fetch is skipped
with a count in the toast rather than silently dropped.

**The Partners page is the source of truth for WHO is on the set, and Auri
confirmed that.** The first pass built the list from the 2025 thank-you post and
came out at 27 — two too many. **Amazing Hall** and **biotope by VIB** are on the
2025 wall but not on the 2026 page, so they were dropped (both files stay in the
library for a manual pick). Diff the set against the page whenever the partner
list changes; do not grow it from an old post. 25 is also the nicer number: it
flows as a clean **5×5** grid at 16:9, where 27 gave 6/6/6/6/3.

One deliberate lockup difference from the page: it shows **Medicon Valley
Alliance** as a plain thin wordmark, the set uses the bars-plus-stacked-text
lockup (what the 2025 wall used). It is the only one in the library and the only
one that still reads at grid size.

**All 25 were rendered on a dark contact sheet and checked against the partner
sheet before being listed** — the round-50 rule. Three carry a file name nobody
would search for, which is why the set stores a `label` separately:
`Beta Heath.svg` is **BETA.HEALTH** (the file name is a typo), `Tuvsud.svg` is
**TÜV SÜD**, `The Kitchen.svg` is **KITCHEN, Aarhus University**. `Biotope.svg`
is the whole biotope-by-VIB lockup, which the 2025 wall rendered as two items.
`src/data/lifeSciencePartners.test.ts` asserts every `src` is still in
`logoLibrary.json`, so the next rename fails a test instead of the button.

### Library 864 → 870, and three logos refreshed

The 6 partners the library had no artwork for came straight from Auri the same
day: **Life Science Invest, BioInnovation Institute, University of Copenhagen,
Ruff & Co Business Innovation** (PNG, no vector exists), **Alliance for
Biosolutions, Amazing Hall**. The set is now complete.

**Four of the six shipped with the mark floating in a much larger canvas** — a
square `0 0 100 100` viewBox around a wide wordmark, only **17% artwork** for
BioInnovation Institute and 29% for University of Copenhagen. A contain-fit cell
cannot tell padding from logo, so they rendered a third the size of their
neighbours. Their root viewBoxes were tightened to the artwork bounds (measured
by rasterising + trimming, then mapping the crop back into viewBox units, 1%
margin); all four now fill 94-96% of their box. **Check this on every hand-supplied
SVG** — the drawing coordinates are untouched, so it is a safe edit.

Auri also supplied newer artwork for three logos already in the library:

- **`CPHLABS.svg` replaced in place** — the old flat wordmark for the current
  CPH.LABS-with-a-flask brand. Closes the stale-logo item in decision 3 below.
- **`Symbion.svg` replaced in place** — same wordmark, the current heavier cut.
- **Novo Nordisk Foundation** is a genuinely different lockup (circle mark +
  horizontal wordmark, which is what the 2026 sheet uses), so it was NOT a
  replacement. **The library already held it as `NN Foundation White.svg`** — a
  name no search for "novo" can return, the round-49 acronym trap again. Caught
  by `logos:dupes`, so the existing file was **renamed** to
  `Novo Nordisk Foundation Horizontal.svg` instead of adding a second copy.

Originals of the two in-place replacements are parked in
`C:/Users/User/AppData/Local/Temp/logos-removed/replaced-2026-08-04/` with
`WHY.tsv` — **that is a Temp dir, rescue them if wanted.** Note a design saved
before the swap keeps the OLD artwork: logos are embedded as data URLs, so an
existing wall has to be re-filled to pick up a refreshed logo.

**`logos:dupes`: 11 → 12 visual groups.** The one new group is
`Symbio.svg` / `Symbion.svg` — `Symbio.svg` turns out to be the same current
Symbion artwork under a truncated name, so the refresh made it redundant.
**Proposed deletion, left in place** because retiring library files is Auri's
call (see decision 1). `Symbio.png` is a different rendering (grey plate) and is
not affected.

**Life Science backgrounds.** The three 2026-season LS gradients from
`Desktop/TBBQ/2026 Season/2x/`, re-encoded with sharp to match the existing
files' weight (1MB → ~30KB each): `ls1`, `ls2` (1500×1500) and `ls16x9`
(1920×1047), in their own **"Life Science"** picker group. The partner template
already excludes the stage groups, so the group shows for every template.

Verified in the browser at 16:9 / 1:1 / 9:16: grid geometry, the count stepper,
a logo-library pick landing in the next empty cell, the editor round-trip
(12 layers, lockup hidden), the layout switch both ways with no chrome leak, and
the fill button producing all 25 logos as a 5×5 wall on `ls16x9`, checked
logo-by-logo against a screenshot of the Partners page.

Worth knowing for the next browser test: the fill button needs the page to be
HYDRATED. A click fired within a second of load is simply lost (no handler yet),
which read as "the button does nothing" twice before a deliberate
minus-then-fill test proved a single click is enough on a settled page.

**Not done:** no official library item for it yet. Tune a wall (probably 16:9 +
1:1 on `ls16x9`/`ls1`) and save it as e.g. "Official Thank You Partners", then
put its id next to the other `DEFAULT_ITEM_IDS` entries in
`src/app/simple/page.tsx` if it should be a flavour button.

---

## Previous handoff — 2026-08-03 (round 50)

### Round 50 — white logos pulled from Airtable

Branch `logos/airtable-white-2026`. **Library 830 → 864.** Gates: 123/123, tsc
clean, `logos:dupes` at 11 visual groups against a pre-existing 10; the one new
group is the legitimate Venture Café London / Warsaw pair described below.

Two Airtable sources, both in base `appgXNjXJqpk9Ebxd`:

- **Marketing Project Overview** → view `Partner Deliverables 2026`
  (`tblTecOBecLQCNIeD` / `viw7FVbsTb9IRaWF0`). The team's white version is the
  attachment in the `Logo` cell whose filename starts **`white-`**; the rest of
  that name is the library file it was made from. 110 such attachments, **18
  added**.
- **Life Science Project** → view `Startup Library 2026` (`tblvukXfmR7KTFymG` /
  `viwC65YEXxl8iDPzN`). For the 25 `Confirmation = Selected` startups the white
  artwork is the **SVG** in `High quality company logo`. **16 added.**

**Most of that partner batch was our own library coming back.** 77 of the 110
`white-` attachments are **byte-identical** to a file we already ship — someone
exported `public/logos` into Airtable and prefixed the names. Hash the download
against the library before believing a `white-` file is new artwork.

**8 more were white logos we already had under a name nobody would search for**,
caught by `logos:dupes` (it compares silhouettes, so a white variant of a colour
logo pairs with it legitimately — these pairs were white-on-white instead). Five
were exact siblings (`Ignite Powered by SISP`, `IVN Powered by Shine`, `IWG
International Workplace Group`, `Talent Garden Copenhagen`, `Young AI Leaders
Community Linz Hub`) and were dropped. `Embassy of India` was dropped as the same
emblem as `Government of India.svg`. Three existing files were **renamed** so the
white artwork is findable by the partner's real name, which folded search could
not do before ("odense robotics" matched nothing):

- `Odense Rob.svg` → **`Odense Robotics White.svg`**
- `Impactfund.svg` → **`Impact Fund Denmark White.svg`** (pairs with the colour
  `Impact Fund Denmark.svg`)
- `Venturecafe.svg` → **`Venture Cafe London White.svg`**

Renames are safe: a picked logo is embedded in a design as a data URL, so a saved
design survives its source file being renamed. `scripts/logo-checks/partner-batch.txt`
carried two of the old names and was updated.

**`logos:dupes` gave one false positive, and only the contact sheet caught it.**
`Venturecafe.svg` grouped with the Airtable white Venture Café upload at a tiny
silhouette distance, so the upload was first dropped as redundant — but rendering
them side by side showed one says **LONDON** and the other **WARSAW**. Same
wordmark, same chevron, one different city word under it, which barely moves the
mask. The library file is the London chapter (now named as such) and the Warsaw
white version was a genuinely missing logo, added as
`Venture Cafe Warsaw Horiz White.svg` next to the dark
`Venture Cafe Warsaw Horiz.svg`. **Never retire a logo on a `logos:dupes` score
alone — render the pair.** This is also the one new visual group in the report.

**Naming convention: `<colour sibling's name> White.<ext>`**, so the pair sorts
together and one search finds both. Three derived names were overridden because
they read as contradictions: `AstraZeneca Colour White` → **`AstraZeneca White`**,
`E Conomic Primary Pos White` → **`E Conomic White`**, and `TalentGardenW` →
`Talent Garden Copenhagen White` (which then turned out to be a duplicate).

All 34 measured `tone: "light"`, so the picker gives them a dark plate. Verified
by rendering the batch onto one dark contact sheet before copying anything in —
worth repeating, it is how the black `logotipo_nero.svg` and the non-white
Creative Business Network PNG got caught.

**9 Selected Life Science startups still have no SVG** (raster only, so no white
version): EasyPCR, Epidetect Labs, Insellar GmbH, IROC, Navari Surgical,
SÉRÉNITÉ-Forceville, Re Fresh Global, Drylabz, plus one blank record with no
company name and no logo at all. Marketing has to chase these.

Not touched: the **23 `Plan B`** Life Science startups, and the `Partner logo`
field on the marketing table (empty in the 2026 view).

---

## Previous handoff — 2026-07-30 (end of a long session, rounds 34-49)

### Round 47 — site-export import, done after the handoff was first written

Steps 1-2 below are **done**, and decision 4 (import the site export) is **done**:

- `Innovation.svg` → **`Innovationsfonden.svg`**. Rendered both first: it is the
  Danish wordmark, and `Innovation Fund Denmark.svg` is the English one. Two real
  logos, not a duplicate. The false HSBC / Innovation District pairings are gone.
- The 4 UI-icon files are parked in `Temp/logos-removed/ui-icons/`.
- New **`npm run logos:import -- <folder>`** (`scripts/import-site-logos.mjs`).
  Matches incoming files on ARTWORK, not filename, because a site export ships
  `svgexport-N.svg`. Skips anything within 12% silhouette distance of a library
  logo, stages the rest, and renders contact sheets for naming. Nothing is ever
  written into `public/logos` by the script itself.
- Ran it on `Downloads/techbbq-dk`: 176 already had, **55 new**. Named and
  imported **53**. Library **778 → 829**.
- 7 names collided with existing logos, resolved by looking at both at full size:
  kept as variants (`Remote White`, `Imec White`, `IDA White`,
  `Founders Running Club White`, `Crispa AI`), and **replaced** two where the
  export is simply better artwork — `Mountside Ventures` (text-only → the chevron
  mark, which closes stale-logo decision 3) and `EdTech Denmark` (webp → svg).
  Both originals parked in `Temp/logos-removed/replaced-by-site-export/`.
- **2 files could not be identified and were NOT imported** — a hand-drawn
  8-point star and a rounded-square mark, staged at
  `…/scratchpad/logo-import/new/027.svg` and `030.svg`. They sit between imec,
  the Indian state emblem and Helsinki in the export, so they are probably
  country/city delegation marks. No `<title>` or id hints in the SVG. Auri to name.
- `logos:match` gained a **word-boundary prefix rule** ("CSE" → "CSE Advisory"),
  which is safe for short acronyms in a way the old substring rule was not.
- **Partners with no logo: 22 → 12.** (It read 20 before only because the generic
  "Innovation" name was falsely claiming two of them.) Remaining:
  Erhvervsfremmebestyrelsen, Innovation District Copenhagen, Owl VC, Closing
  Loops, HSBC Innovation Banking, InvestEU, BSI Group, ENFA, EIT Urban Mobility,
  Copenhagen Fintech, Creative Girls Club, Nova Talent.
- Worth noting: the export shows **ESA BIC is still live branding on techbbq.dk**,
  which contradicts the "renamed to Space Ventures DK" verdict in decision 3.
  Treat the site export as the authority on what TechBBQ actually uses.

Gates after round 47: **123/123 vitest, tsc clean.**

### Round 49 — picker windowing, and where the partner SVGs actually live

**The "See all" grid was janky** because it rendered every logo at once: ~6000 DOM
nodes on open, rebuilt on every keystroke. `loading="lazy"` does not help — it
defers the download, not the element creation. Now it renders `PAGE_SIZE = 60`
and grows on scroll via an IntersectionObserver, with a real "Loading more"
button as the fallback so it works without the observer and by keyboard.

**Gotcha worth remembering: refs are null in an effect keyed on dialog-open.**
Radix mounts the portal content in a LATER commit than the one where `allOpen`
flips, so `scrollRef.current` / `sentinelRef.current` read null, the effect
returned early, and nothing re-triggered it — the observer was never created and
the grid was stuck at 60 with no way to scroll. Both nodes are now held in STATE
via callback refs, so the effect runs exactly when the node appears. Verified in
the browser: 60 on open, growing 120 → 180 → 240 on scroll, search narrows to 1
and clearing resets the window instead of rendering all 824.

**WordPress media is the wrong source for partner logos.** Measured, not assumed:

- `techbbq.dk/wp-json/wp/v2/media` is **401** for anonymous reads, and the host
  (Simply.com) answers curl with **455 Security Incident Detected** — a real
  browser gets through where curl cannot.
- SVG upload IS enabled there (`/wp-content/uploads/2024/11/TechBBQ-Logo-resized.svg`),
  but the **partner logos are not files at all** — the page carries **245 inline
  `<svg>` elements**, which is exactly what Auri's 231-file `svgexport-N.svg`
  download was. Elementor inlines them, so the media library has almost no logos
  in it. An application password would buy nothing here.
- The page itself is the source, and it needs no credentials. Pulled the 10
  remaining missing partners straight out of the DOM by finding the `<svg>` inside
  each partner's own outbound link.

Imported 6 verified: **Erhvervsfremmebestyrelsen, Owl Ventures, BSI Group,
Copenhagen Fintech, Creative Girls Club, Nova Talent**.

- **Creative Girls Club identifies the hand-drawn star** that was staged as
  `027.svg` and unnamed in round 47 — 0.0% shape difference. One unknown left.
- Climbing ancestors to find a tile's SVG grabs the NEIGHBOUR's logo: it returned
  dealroom.co for Innovation District Copenhagen and boardway for Closing Loops.
  Scope the search to the anchor and its immediate parent.
- **Partners with no logo: 12 → 5**, and 2 of those 5 are matcher artifacts
  (`Owl VC` vs our `Owl Ventures.svg`, `ENFA` vs our
  `Euro Nordic Funding Alliance (ENFA).svg` — the matcher cannot read an acronym
  in parentheses). Genuinely missing: **Innovation District Copenhagen, Closing
  Loops, EIT Urban Mobility** — none has an inline SVG on the page.

Library is **830 files**: Auri deleted ~11 through the picker mid-session (they
are in `.logos-trash/`), so 835 − 11 + 6 = 830. Gates: 123/123, tsc clean,
eslint clean.

### Round 48 — SVG versions of the raster logos, and a real bug in `signature()`

Question was "can we get SVG files for the companies we only have as PNG?".
**152 of 737 companies were raster-only** (208 png, 5 webp, 5 jpg, 174 files).

New **`npm run logos:svgify -- <batch.txt>`** (`scripts/svgify-logos.mjs`). Takes
`Our file.png|domain.com` rows, fetches the site's header logo, keeps it only if
it is genuinely vector, then **scores it against the raster we already have** —
the whole risk is silently swapping in the wrong artwork, and a marketing page
will happily hand over a customer's mark. Stages candidates + renders a
side-by-side sheet; never writes to `public/logos`.

**Measured yield, so nobody re-runs this expecting more:**

| Batch | Rows | Vector found | Usable |
|---|---|---|---|
| Raster-only current partners | 13 | 5 | 1 clean + 2 renames |
| Well-known global brands | 74 | 9 | 4 |

**Scraping global brands does not work** — 43 of 74 returned no logo and 22 were
raster too, because those sites are JS-rendered or bot-blocked, so the header
HTML has nothing in it. The shape check earned its keep: it caught aiesec.dk
handing over "Global Talent", pleo.io handing over "SOHO HOUSE", startuplab.no
handing over "Ardoq", and uipath.com handing over a checkmark.

Applied (all verified at full size against the company's own site):

- **Upgraded raster → SVG**, originals parked in `Temp/logos-removed/upgraded-to-svg/`:
  Twilio, Leapfunder, Ververica, Stripe, Greylock.
- **Added** as a different lockup rather than a replacement: `Discord.svg`,
  `Khosla Ventures.svg`, `HSBC.svg`, `Impact Fund Denmark.svg`,
  `Danish Life Science Cluster.svg`.
- **Two files were misnamed**, which the comparison exposed: `HSBC.png` is
  actually **HSBC Innovation Banking**, and `Impact.png` is **Impact Partners**,
  not Impact Fund Denmark. Renamed. `Discord.webp` → `Discord Icon.webp` (it is
  the app-icon tile).

**Bug found and fixed in `signature()` (`scripts/lib/logo-web.mjs`).** It read
background from the top-left pixel. Trimming crops to the artwork, so a wordmark
whose first letter sits flush in the corner (Uber, Revolut, Accenture, Y
Combinator) puts INK at pixel 0 — every ink pixel then counted as background,
the mask emptied and it threw "blank". Now transparency decides whenever the file
has any, and only a genuinely opaque image falls back to the **median border**
colour. Reading the border alone is NOT enough (first attempt: 763 → 712), since
a tightly trimmed wordmark has an ink-heavy border too.

- Library coverage **763/778 → 829/829**.
- It was hiding wrong answers, not just missing ones: re-running `logos:import`
  found **InvestEU** in the site export, which the old mask had matched to
  "Bits Pretzels Kickstart Europe" at 9.5% and skipped. Imported.
- This function backs `logos:dupes`, `logos:import`, `logos:compare` and
  `logos:svgify`, so **earlier duplicate reports were run on the broken mask** and
  are worth regenerating before acting on them.

**Partners with no logo: 22 → 10.** `ENFA` in that list is a false gap — we hold
`Euro Nordic Funding Alliance (ENFA).svg`, and the matcher cannot see an acronym
inside parentheses. Library now **835 files**. Gates: 123/123, tsc clean.

Still open on this thread: **Simple Icons** (simpleicons.org, CC0, 3443 brands)
covers 21 of the 152 raster-only companies and all 21 download clean. They are
monochrome and often the symbol rather than the wordmark (Stripe's S, Tesla's T,
Meta's infinity), which suits the dark templates and the in-app SVG recolour but
is a different lockup from what we hold. **Auri's call whether to bring them in.**
The biggest remaining chunk is ~35 TechBBQ event brands (TalkBBQ, TechBBQueer,
Life Science, LP Forum, Nordic iPO, Startup Showcase, Urban Tech, Tech Talent) —
no site to scrape, so the vector should come out of TechBBQ's own design files.

### Where the code is — SUPERSEDED, see the handoff at the top

> Historic as of 2026-08-04: all of this is committed and pushed to `master`.

Branch **`sales-announcement`**, branched off `master` at `b97fb15`.
**Everything is UNCOMMITTED** — nothing has been pushed, prod is untouched.
Gates at handoff: **123/123 vitest, tsc clean, `npm run build` clean**, changed
files eslint-clean (10 pre-existing errors elsewhere in `src/hooks`, unrelated).

Dev server may still be running on localhost:3000.

### What this session added (detail in rounds 34-46 below)

1. **Sales Announcement template** — a third template kind (`panel` | `partner` |
   **`sales`**) with two layouts, Countdown and Discount. `docKindOf()` is now the
   single source of truth for doc kind. No official library item yet.
2. **MP4 export** — was dormant AND broken; now PNG/JPG/MP4 with MP4 gated on an
   animated background, rebuilt as compositing at a constant 30fps.
3. **Editor "Save & back to Quick Templates"** button.
4. **Logo Library** — 830 logos in `public/logos/`, searchable, per-logo plate
   colour, "See all" modal, select-and-delete (dev-only route), SVG recolouring,
   file-type badges. Every file renamed to its real company name.
5. **Logo verification tooling** — four npm scripts (below) that check library
   logos against companies' live websites.

### Decisions waiting on Auri (nothing is blocked on code)

1. **Delete 9 confirmed duplicate logos?** Verified pair-by-pair at full size.
2. **Delete the 4 font-dependent TechBBQ Investor Day copies?** The files named
   `… 2.svg` use live text referencing HelveticaNeue; the ones without "2" are
   outlined and safe. Same artwork otherwise.
3. **Replace the remaining stale logos?** e-conomic → now "e-conomic by VISMA";
   CPH Labs → now "CPH.LABS" with a flask; Slush → 2025 dates, live is Nov 18-19
   2026; Vaekstfonden → brand became EIFO. **PSV is correct, do not touch.**
   Mountside Ventures is DONE (round 47). ESA BIC is now doubtful — the site
   export still uses ESA BIC branding.
4. ~~Import the 59 new logos from `Downloads/techbbq-dk`~~ **DONE** in round 47
   (53 imported, 2 unidentified and still staged — see round 47).
5. **3 current partners have no logo** (Innovation District Copenhagen, Closing Loops, EIT Urban Mobility — round 49). Chase artwork.
   Nordea, Mastercard, Visma, Flatpay, Nebius and Grant Thornton came in with the
   site-export import.
6. **WordPress media needs an application password** — `/wp-json/` is open but
   `/wp-json/wp/v2/media` is 401 and `/wp-content/uploads/` is 403. With a
   read-only app password the media library becomes the cleanest logo source.
7. **Commit + merge to `master`** (auto-deploys). Note: committing adds ~20MB
   across 830 logo files to git history permanently — that was accepted as the
   price of the simple approach, but it is a one-way door.

### Immediate next steps, in order

1. ~~Rename `Innovation.svg`~~ and ~~bin the 4 UI-icon files~~ — **both done in
   round 47.**
2. Name the 2 unidentified staged logos (round 47) or drop them.
3. Take decisions 1-3 above, then commit in logical chunks (sales template / MP4
   / editor button / logo library / verification tooling). Note the library is now
   **830 files**, so the git-history size point in decision 7 is bigger than the
   ~20MB written there.
4. Tune a Sale design, save it as an official library item, and put its id in
   `DEFAULT_ITEM_IDS.sales` in `src/app/simple/page.tsx`.

### New npm scripts

| Script | Does |
|---|---|
| `npm run logos` | Rebuild `src/data/logoLibrary.json` (also measures brightness; cached). Runs on `predev`/`prebuild`. |
| `npm run logos:dupes` | Report duplicate logos. READ-ONLY, deletes nothing. |
| `npm run logos:match` | Join `scripts/logo-checks/techbbq-partners.txt` to logo files → `partner-batch.txt`. |
| `npm run logos:compare -- scripts/logo-checks/partner-batch.txt` | Fetch each partner's live logo, score it against ours, render sheets only for disagreements. |
| `npm run logos:verify -- <batch>` | Side-by-side sheet for a supplied `file|domain` list. |
| `npm run logos:sweep` | Domain status for the whole library. Weak — see its header comment. |
| `npm run logos:svgify -- <batch>` | Find SVG versions of raster logos on the companies own sites. Shape-verified, staged for review. |
| `npm run logos:import -- <folder>` | Import a site export. Artwork-matches against the library, stages only the new files, renders naming sheets. Never writes to `public/logos`. |

### Gotchas discovered this session

- **Windows case-only renames** need a temp hop (`os.rename(a, tmp); os.rename(tmp, b)`) — the target "exists" because it IS the same file.
- **Long CMS filenames blow the 260-char path limit** when moving into a deep backup dir; shorten the destination root.
- **`titleFromFile` no longer re-capitalises** — the filename is the display name verbatim, so curated names like `byFounders` survive. Underscores are the only thing replaced.
- **A 1500×1500 video frame at 30fps crashes the Chrome renderer.** Video frames are pixel-capped to Full HD (`videoFrameSize`); still exports are unaffected.
- **`mp4-muxer` rejects a non-zero first timestamp** — needs `firstTimestampBehavior: "offset"`.
- **Guessing domains from company names does not work** (217 non-resolving, 56 parked out of 782). Use real URLs from the partner list.
- **Removed logo files are parked, not destroyed**, in `C:/Users/User/AppData/Local/Temp/logos-removed/<group>/` with `WHY.tsv`. **That is a Temp dir — rescue anything wanted before Windows cleans it.**

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

**Added 2026-07-30 (rounds 34-46):**

| Path | What it does |
|---|---|
| `src/app/simple/page.tsx` | Quick Templates. Now three template kinds; holds `LogoTintRow`, `setPartnerLogoTint`, `SALES_LAYOUTS`, `DEFAULT_ITEM_IDS` (no `sales` id yet). |
| `src/lib/simpleLayout.ts` | `buildSalesDesign`, `salesLayoutOf`, `isSalesDoc`, **`docKindOf`** (the kind guard everything uses), `retargetSalesLayout`, `retargetSlotDoc` (shared with partner). |
| `src/lib/svgTint.ts` + `.test.ts` | Recolour an SVG logo in place (rewrites fills/strokes/gradient stops, sets root `fill` because it inherits, leaves `fill="none"`). 8 tests. |
| `src/lib/logoFiles.ts` + `.test.ts` | Path safety for the logo-delete route: only files listed in the manifest resolve, which rules out traversal. 4 tests. |
| `src/app/api/logos/route.ts` + `.test.ts` | DELETE logos. **404s in production**, moves files to a gitignored `.logos-trash/`, rewrites the manifest. 5 guard tests. |
| `src/components/LogoLibraryPicker.tsx` | Logo Library: search, per-logo plate colour by measured brightness, file-type badge, "See all" modal (Radix Dialog), select-and-delete. |
| `src/components/ColorPicker.tsx` | Gained an optional `swatches` prop so logo recolouring leads with White/Black. |
| `src/hooks/useExport.ts` | MP4 export: AVC level picked via `isConfigSupported`, frames pixel-capped by `videoFrameSize`, compositing capture at a constant 30fps. |
| `src/components/templates/DynamicTemplate.tsx` | Background wrapped in `data-canvas-bg` so the video export can composite it per frame. |
| `public/logos/` (830 files) + `README.md` | The logo library. README carries the naming convention and the verification workflow. |
| `src/data/logoLibrary.json` | Generated index (name, tags, bytes, tone). Committed AND regenerated on `predev`/`prebuild`. |
| `scripts/logo-manifest.mjs` | Builds the index; measures per-logo brightness (cached by `src|bytes` + `TONE_ALGO`). |
| `scripts/find-duplicate-logos.mjs` | Duplicate report. Read-only. |
| `scripts/verify-logos-online.mjs`, `compare-logos-online.mjs`, `match-partner-domains.mjs`, `sweep-logo-domains.mjs`, `lib/logo-web.mjs` | Website verification tooling. `lib/logo-web.mjs` holds the shared fetch / header-scoped logo extraction / signature comparison. |
| `scripts/logo-checks/techbbq-partners.txt` | ~95 partners with real URLs, read off techbbq.dk/partners. Refresh when the partner list changes. |
| `scripts/svgify-logos.mjs` | Raster -> SVG upgrade hunt. Keeps only genuine vectors, scores them against our raster so a wrong logo cannot slip in. |
| `scripts/import-site-logos.mjs` | Import a site export by matching ARTWORK against the library (export filenames are meaningless). Stages new files + renders naming sheets; never writes to `public/logos`. |

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

**For what to do RIGHT NOW, read SESSION HANDOFF at the top of this file** — it
carries the live decisions and next steps. This section is the standing backlog
underneath that.

Two items here have real teeth and predate this session:

- **sessionStorage quota is swallowed silently** (`writeSession`, editor page).
  A doc with big base64 images stops persisting with no warning, and a reload
  loses everything since the last successful write (proven live: a 521-element
  doc restored as 121). Cheapest fix: toast once on the first failed write.
  Better: downscale/recompress images on ingest (≤2048px JPEG), which also cuts
  drag-persist work and library 413 risk. **This is the only open item that
  loses user work.**
- **Layers panel docks open on an empty canvas** — default it closed until there
  is ≥1 user layer.

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

**Session 2026-07-30, round 46 — partner-URL verification results + one colour control (same branch, UNCOMMITTED).**

- **The domain problem was solved with DATA, not tooling.** Auri suggested a third-party agent-web-access toolkit; not needed — the built-in search resolves domains ("Akademikernes A-kasse" → aka.dk, which no name-guess reaches), but 782 searches would cost ~1.2M tokens. `techbbq.dk/partners` lists ~95 partners WITH their real URLs, in one fetch, and is inherently the right subset. New `npm run logos:match` joins that list to logo files (`scripts/logo-checks/techbbq-partners.txt` → `partner-batch.txt`), and `logos:compare` now accepts that batch directly.
- **Result over 105 pairings:** 24 match, 41 needed eyes (all reviewed), 28 no extractable logo, 12 unreadable download. **Six real findings:** ESA BIC now trades as **Space Ventures DK**; **e-conomic** is now "e-conomic **by VISMA**" and ours lacks the endorsement; **CPH Labs** ships "CPH.LABS" with a flask mark; **Mountside Ventures** added a chevron mark; plus Slush (2025 dates) and Vækstfonden (now EIFO) from round 45. **PSV: Auri confirms ours is correct** — the "PSV Tech" difference is not a problem.
- **Also surfaced: 20 current partners have NO logo in the library** (Nordea, Mastercard, Visma, Flatpay, Nebius, BSI Group, Grant Thornton, Copenhagen Fintech, EIT Urban Mobility, Closing Loops…).
- **Two flaws in my own tooling, recorded so they are not rediscovered:** the matcher mis-pairs generic filenames (`Innovation.svg`, which is actually Innovationsfonden, matched HSBC Innovation Banking AND Nordic Innovation; `Commu.svg` matched "community"), and the extractor still grabs campaign banners on ~1 site in 3 (amazon ads for omr.com, SOHO HOUSE for pleo.io). Human-reviewed shortlist, never an automatic verdict.
- **WordPress media is NOT reachable:** `/wp-json/` is open but `/wp-json/wp/v2/media` returns **401** and `/wp-content/uploads/` **403**; the partner page's logos are lazy-loaded placeholders, so no image URLs exist in the HTML. Would need an application password to use the media library.
- **Auri's `Downloads/techbbq-dk` export (231 unnamed `svgexport-*.svg` from the site) matched against our library by silhouette: 172 are already ours** (most at 0-2% difference — independent confirmation that those are current), **59 are not**, i.e. candidates to import and name. Report in `scratchpad/techbbq-import.json`.
- **UI (Auri: "a bit tight, just allow the colour wheel and in there the first option would be white or black"):** the five-control tint row is now ONE swatch button opening the standard `ColorPicker` — new optional `swatches` prop so logo recolouring leads with **White, Black**, then TechBBQ red/orange/gold, with H/S/L sliders, hex input and "Clear color" as the restore-original. Verified live: trigger renders, swatch order correct, zero console errors.

**Session 2026-07-30, round 45 — verifying logos against the companies' own websites (same branch, UNCOMMITTED).** Auri: "can we verify if these are still correct logos, by checking their respective websites? Doing reverse image search and with the name?"

- **No reverse image search is available** as a tool here, so the honest substitute is built instead: `npm run logos:verify -- scripts/logo-checks/batch1.txt` (`scripts/verify-logos-online.mjs`). Per `Our file.svg|domain.com` row it fetches the homepage, extracts the logo, downloads it, and composes it BESIDE our copy on one grey plate for a human verdict. Outbound network from this environment works (curl, verified).
- **Extraction had to be scoped to the header.** The first pass searched the whole page and returned CUSTOMER logos: "Lovable" for antler.co, "FOSSIL" for cloudflare.com, "AKOOL" for salesforge.ai. Now it looks only up to the first `</header>`, prefers an inline `<svg>` whose markup mentions logo/brand/the company name (where most modern sites keep the wordmark — it is written straight out to a file), then a header `<img>` scored on logo/brand/company keywords, and only then falls back to any path containing "logo". Hit rate went from 6/15 to 11/15 useful, 8 of them clean verifications.
- **Verified current:** Antler, Stripe, KPMG, Cloudflare, Dealroom, Copenhagen Capacity, Danske Bank, byFounders all match what the company ships today.
- **Two real problems found:**
  - **`Slush2025 Dates White.png` is out of date** — slush.org now shows "SLUSH · NOV 18-19, 2026 · HELSINKI". Ours carries the 2025 dates.
  - **`Vaekstfonden.svg` is a dead brand** — vaekstfonden.dk resolves to eifo.dk, titled "Danmarks Eksport- og Investeringsfond". Vækstfonden became EIFO, and the library already has EIFO logos.
- **Cost, honestly:** a domain has to be supplied per company (guessing fails for Nordic orgs), and ~1 row in 4 grabs the wrong asset and needs a manual look. A batch of 15 takes a couple of minutes; all 782 logos would be ~52 batches. **Recommended scope: verify the partners actually appearing in 2026 material, not the whole library.** Documented in `public/logos/README.md` with the limits stated.

**Session 2026-07-30, round 44 — every logo renamed to its real name: 494 files (same branch, UNCOMMITTED).** Auri deleted 46 himself via the new UI (840 → 794), asked for a fresh duplicate check, then: "can you check over all of them and rename accordingly, with spaces and all, full names."

- **Duplicate re-check first (wide net, then eyes).** Name clusters (variant words stripped) + loose shape matching with colour IGNORED gave 83 candidate groups / 224 files; a shape+ink pass cut that to 22 pairs; all 22 rendered large on ONE mid-grey plate. Verdict: **zero new duplicates**. Every flagged pair was a legitimate variant (TechBBQ Investor Day colour-arc vs mono, techtalent/StartupCapital black vs white sub-text, UrbanTech "Pitch Competition" vs "Shaping Future Cities", TechBBQ wordmark white/grey/orange) or a different entity (European Investment **Bank** vs **Fund**, EIT Community vs EIT Community **Supernovas**, Venture Café London vs Warsaw). The 9 same-artwork pairs found earlier this session remain the only real ones, still pending Auri's word.
- **Renaming: rules for the safe 289, eyes for the 205 that needed them.** Mechanical rules handled separators, trailing export digits, noise words (logo/svgexport/rgb/copy…), acronym preservation and lowercase small words ("of", "and", "in"). But blind camelCase splitting mangles brands, so all **191 camelCase files + 14 junk-named files were rendered as contact sheets and read off the artwork**, producing a 170-entry override map: `AleSac`, `AstraZeneca`, `BioNa`, `BlackWood Ventures`, `byFounders`, `Clexbio`, `DanBAN`, `LazySundays`, `NetApp`, `Snapchat`, `SoftBank`, `Speedinvest`, `TheStorage`, `UiPath`, `VentriLabs`, `identity.vc`, `all·u·me` all keep their own casing.
- **Names recovered from artwork rather than filenames:** `c5e5a767-be7f-…png` → **OMNIT**, `svgexport-1.svg` → **NordicNinja**, `-2` → **Lunar**, `-4` → **Virksomhedsguiden**, `-11` → **Skiftr**, `-13` → **FBV**, `-30` → **Microsoft**, `-52` → **Danish Entrepreneurs**, `-1 (2)` → **Nova**, `-1 (3)` → **OMR Reviews**, `MuchSkil0` → **Muchskills**, `HellowWORKS` → **Hello Workr**, `NExtGen` → **ITU NextGen**, `SwapLanguages0` → **Swap Languages**, `PSV` → **PreSeed Ventures**, `NSW` → **Nord Star Medical**, `CSE` → **CBS Copenhagen School of Entrepreneurship**, `MQS` → **MQS Molecular Quantum Solutions**, `ESN` → **ESN European Startup Network**, `SVG/Things.svg` → **Things** (also flattened the stray subfolder).
- **Three mislabelled files fixed:** `Dtu SciencePark.svg` was the **Future Box** logo, `EIC Color0.png` was **European Investment Bank** (not the Innovation Council), `MedicalVillage.svg` was **Medicon Village**. Two typos fixed too (`HikinEnergy` → **Hykin Energy**, `EndlesssFood` → **Endless Food Co**).
- **The four TechBBQ Investor Day pairs got named to expose a real trap:** the `_1` exports have their text OUTLINED, the `0` exports reference **HelveticaNeue** as live text and would render in a fallback font on any machine without it. They are now `TechBBQ Investor Day <variant>.svg` (outlined, safe) and `… <variant> 2.svg` (font-dependent, the one to drop).
- **The filename is now the display name, verbatim.** `titleFromFile` no longer replaces separators or re-capitalises: that logic existed for scraped names like `blackwoodventures.svg` and now only corrupts curated ones ("byFounders" → "ByFounders", "A-kasse" → "A Kasse"). Underscores stay the one exception. README's naming convention rewritten to match.
- **Evidence:** 782 logos, 0 underscores, 0 leftover junk names except 4 files that are UI icons rather than logos (a clock, a map pin, an arrow, one unidentifiable purple mark — Auri can bin them in the Select UI). 123/123 vitest, tsc clean, build clean. Live probes: "black wood", "byfounders", "astrazeneca", "akademikernes", "future box", "nordic ninja", "investor day", "preseed", "omnit", "virksomheds", "techbbq white" all resolve, and both "göteborg" and "goteborg" find `Business Region Göteborg`.

**Session 2026-07-30, round 43 — "Logo Library": file-type badges + select-and-delete (same branch, UNCOMMITTED).** Auri: "Have a small icon that would indicate that it is svg file and png in the saved logos. Also rename instead of saved logos, Logo Library. Allow myself to also select and delete some of them."

- **Renamed** everywhere: the sidebar heading, the modal title, the empty state and the search placeholder now say **Logo Library** (`Search 840 logos`).
- **File-type badge on every tile**, top-left: `SVG` in brand orange, raster types (`PNG` / `WEBP` / `JPG`) in muted black. Orange for SVG on purpose — it is the format that scales AND can be recoloured in the slot (round 42), so the badge answers "can I restain this?" at a glance. The tooltip now reads "Name (12KB, SVG) — add to slot 2".
- **Select and delete, in the modal.** A `Select` toggle turns the grid into a picker: tiles show a checkbox, a click selects instead of placing, selected tiles go red, and the footer gains "N selected · Select all matching · Delete" with a confirm listing the names. The list updates immediately from component state rather than waiting for the manifest module to hot-reload.
- **How deletion works, and why it is dev-only.** `public/logos` is committed, so removing a logo IS a repo change. New `DELETE /api/logos` therefore: **404s in production** (Vercel's filesystem is read-only and the files are baked into the build, so a working-looking button there would be a lie); accepts only `src` values already present in `src/data/logoLibrary.json`, which makes traversal impossible by construction; **moves** files to a gitignored `.logos-trash/` instead of unlinking, so a mis-click is recoverable; caps a request at 200 files; and rewrites the manifest so the picker matches without a rebuild.
- **`src/lib/logoFiles.ts`** holds the path check (`libraryFileFromSrc`) as a pure function so it is testable: 4 tests cover encoded/unencoded matching, subfolders, unknown paths, `../` and `%2e%2e` traversal, drive-letter and absolute paths, a manifest that itself contains a traversal entry, and a malformed percent escape. 5 more tests cover the route's guards (production 404, bad JSON, empty/non-array `srcs`, the 200-file cap, unknown paths reported as failures with nothing deleted).
- **Evidence:** 123/123 vitest (9 new), tsc clean, build clean (`ƒ /api/logos` in the route list), eslint errors unchanged at 10 pre-existing. Live: heading and modal read "Logo Library (840)", badges correct across a sample (BBC White → PNG, Abion → SVG, Adyen → PNG, Accel → SVG), and a real delete ran end to end — file moved to `.logos-trash/`, manifest 840 → 839, modal title updated live, confirm text listed the name. The test victim was restored afterwards, so the library is back at 840; screenshot `scratchpad/select-mode.png`.

**Session 2026-07-30, round 42 — recolour an SVG logo in place (same branch, UNCOMMITTED).** Auri: "Delete PNG one from accell, and then implement a possibility to change colours of the svg on the spot." `Accel.png` (black raster) removed; `Accel.svg` (white vector) kept — 840 logos.

- **Why this matters more than it looks:** 591 of 840 logos are white/light artwork and ~197 are dark-only, and the canvas is dark. For those dark-only partners there was previously no usable version at all. Antler was the trigger: `Antler.svg` is white `#FFFFFF`, `Antler Invest.svg` is red `#ED4746` — the same wordmark twice, which is why the dedupe kept both.
- **`src/lib/svgTint.ts`** (pure, 8 tests): rewrites every `fill` / `stroke` / `stop-color` / `flood-color` / `lighting-color`, in presentation attributes AND in CSS (both `<style>` blocks and `style=""`), then sets `fill` on the root `<svg>` — because `fill` INHERITS, which is what catches shapes that declare no colour and would otherwise render default black. `fill="none"` and `url(#gradient)` references are left alone, so an outline logo stays an outline. Idempotent, and handles both base64 and percent-encoded data URLs incl. non-ASCII (chunked `btoa` — spreading a big byte array into `String.fromCharCode` blows the stack).
- **UI: a swatch row under each filled logo slot** — White · Black · TechBBQ red · custom colour picker · Original. Renders only for SVGs (a raster has no colours to rewrite, so no dead control is offered). `PartnerLogo` gained `originalSrc` + `tint`: every recolour derives from the ORIGINAL, so switching colours never compounds and "Original" always restores — which matters because a multi-colour mark flattens to one colour and cannot be un-flattened.
- **Output is a normal SVG data URL**, so the export pipeline, the team library and `retargetTunedDoc` (which already carries an `src` change into a tuned doc) needed no changes at all.
- **Evidence:** 114/114 vitest (8 new), tsc clean, build clean, eslint errors unchanged at 10 pre-existing (none in the touched files). Live: placed the red Antler logo, White → all colours become `#FFFFFF` and the root fill is set, canvas re-renders (screenshot `scratchpad/tint-white.png` shows white Antler on the dark partner canvas), custom `#22c55e` applies, Black sets `#15110E` with the swatch showing `aria-pressed`, Original returns to `#ED4746`. Zero console errors. NB the first custom-colour test failed for a TEST reason — React's value tracker ignores a directly-assigned `input.value`, so the native setter is needed; a real user picking a colour is unaffected.
- **Known limit:** a design loaded from the team library reconstructs its logos from the doc's images, which carry no `originalSrc`/`tint`, so the tinted artwork is correct but the swatch shows no active state and "Original" would restore the tinted version. Only cosmetic; re-tinting still works.

**Session 2026-07-30, round 41 — SVG/raster twins: 847 → 841 (same branch, UNCOMMITTED).** Auri: "if there is svg and png files that are the same, please delete png."

- **29 name twins found** (same folded filename, one vector one raster), but only **6 were actually the same logo**. In this library the SVG is usually the WHITE KNOCKOUT version and the PNG the COLOUR version — Google, KPMG, Accel, Symbion, DISIE, hackyourfuture, Startup Wise Guys, UbuntuBiz, Terkko Health Hub are all colour-vs-mono pairs, so a blanket "delete the PNG" would have destroyed the colour artwork. Those stay.
- **Two metrics were wrong before the right one worked.** (1) Whole-image pixel difference is diluted by empty background — a white-on-transparent SVG next to a colour PNG scored 11.8/255, i.e. "nearly identical", because the glyphs are a small share of the frame. (2) Comparing shape + mean ink colour separately was much better, but still mis-scored `thehub` (white SVG vs navy PNG) as ink-identical. **What settled every case was rendering each pair side by side at full size on a mid-grey plate and looking.** The numbers narrowed 841 files down to 29 pairs; the eyes made the call.
- **Deleted (raster twin of an identical vector):** the four `Techbbq Investor Day {B0,CB0,CW0,W0}.png` (their 12% "shape difference" was export padding — at full size they are pixel-for-pixel the same lockups as the SVGs, ink Δ 0-3), plus `proptech.png` (both carry the DENMARK line) and `The Economist.png` (both white). Parked in `Temp/logos-removed/raster-twins/` with a `WHY.tsv`.
- **Evidence:** 841 logos, 106/106 vitest, tsc clean, build clean. Comparison sheets kept: `scratchpad/previews/pairs-{0,1,2}.png` (all 29 twins), `tbbq-pairs.png` and `three-pairs.png` (the full-size checks that decided the 6 deletions and saved `thehub.png`).

**Session 2026-07-30, round 40 — logo tiles get a plate they can be SEEN on + "See all" modal; 854 → 847 (same branch, UNCOMMITTED).** Auri: "I can't see some of them, so perhaps adjust it so you can see the white ones as well, the background a bit darker" + "I want to be able to press see all logos and the popup with all the logos would appear."

- **Per-logo plate, not one darker plate.** Darkening the plate would have hidden the ~200 dark logos instead. `npm run logos` now measures each logo's brightness with `sharp` and stores `tone`: light artwork gets a **dark** tile (`#1b1b1b`), dark artwork a **white** tile, colourful a **neutral-200** tile. Current split: 591 light, 197 dark, 66 mixed — i.e. most of this library is white knockout artwork, which is exactly why so much of it was invisible. Measurements are cached by `src|bytes` + a `TONE_ALGO` version, so a rebuild re-measures nothing (`predev`/`prebuild` stay fast).
- **The first brightness pass was wrong and the screenshot proved it.** It treated opaque near-white pixels as background, but a white-on-transparent logo's glyphs ARE opaque white — so its ink was thrown away, it fell back to "mixed", and it stayed invisible. Rewritten: the CORNER pixels decide what background means (transparent corners → every visible pixel is ink; opaque corners → that corner colour is the card and is excluded), with whole-image luminance as the fallback.
- **"See all" modal** (Radix Dialog: Esc, click-outside and focus trap for free): a button beside the search opens every logo in a 8-column grid with its own search box, bigger tiles, `loading="lazy"` images (opening it doesn't fetch 20MB), and a footer saying which slot a click fills. Clicking a logo places it and closes. The sidebar list still shows 12 by default / 24 when searching, and now says "keep typing, or press See all".
- **7 files were broken, not just badly plated** — found by auditing every file's actual render. Four `Bits Pretzels *.svg` files contain BINARY GARBAGE rather than SVG markup (both the browser and sharp refuse them); `YahoooJapan.svg` is corrupt XML; `AktiviteEjere-01.svg` and `BloxHub.svg` are empty exports (a viewBox with no artwork). All removed to `Temp/logos-removed/broken/` with a `WHY.tsv`. The intact copies of those four Bits&Pretzels marks were still sitting there under scraped `logo_31..34_…` names (the earlier rename had refused to overwrite) and now carry the clean names — so nothing was lost, and the last generic filenames are gone.
- **Evidence:** live audit of the open modal — 847 tiles in the DOM, 192 images loaded on first paint, **zero broken**; screenshot `scratchpad/modal-final.png` shows white logos on dark tiles and dark logos on white tiles, with the previously blank Bits&Pretzels tiles now rendering. 106/106 vitest, tsc clean, eslint clean, build clean.

**Session 2026-07-30, round 39 — duplicate logos: 883 → 854 (same branch, UNCOMMITTED).** Auri: "Check if we have any duplicated and delete them."

- **New `npm run logos:dupes`** (`scripts/find-duplicate-logos.mjs`, READ-ONLY, report written to a gitignored JSON). Byte-identical (md5) plus visually identical: **trim to the ink box**, stretch to a 48×48 ink mask, then require similar trimmed aspect ratio + similar ink density + similar ink COLOUR + ≤3% mask difference, unioned so A~B~C lands in one group.
- **Two detector iterations were wrong and the images proved it.** A 16×16 "contain" hash grouped 27 unrelated companies, because most of these SVGs are a wide wordmark centred in a square 100×100 viewBox — letterboxed into a 16×16 box they all became "a bar across the middle". Trimming to the ink box first, hashing stretched, and bucketing on the TRIMMED aspect ratio fixed it. Ink colour is compared separately so a white knockout is never deleted as a copy of the black original.
- **Every group was eyeballed before anything was removed** (contact sheets on mid-grey so white and dark artwork both show: `scratchpad/previews/dupes-{0,1,2}.png`). That caught two classes the algorithm got wrong: **European Investment Bank vs European Investment Fund** (near-identical EU-flag lockups, different institutions) and variant sets that are NOT copies — TechBBQ Investor Day colour-icon vs mono-icon, techtalent black vs white sub-text, and UrbanTech "Pitch Competition" vs "Shaping Future Cities". Those 7 groups (11 files) are deliberately kept and the README now warns about them.
- **29 confirmed duplicates removed**, keeper chosen by: vector over raster, then resolution, then the cleaner name. Examples: `Microsoft Logo0.png` (6148px, 92KB) dropped for `Microsoft.png` (1024px is plenty), `cop cap.png` for `copcap-logo-black.svg`, `Kicthen_logo_tag_en_white_rgb (1).svg` for `The Kitchen.svg`, `SplitTechCiity.svg` (typo) for `SplitTechcity.svg`.
- **Acronym searchability preserved on 3 survivors** — deleting `EIF.svg` / `ENFA.svg` would have made those acronyms unfindable (the folded search has no "eif" inside "europeaninvestmentfund"), so the keepers were renamed `European Investment Fund (EIF).svg` and `Euro Nordic Funding Alliance (ENFA).svg`. Also fixed `Novo Nordisk FOundation.svg` → `Novo Nordisk Foundation.svg` (a case-only rename needs a temp name on Windows) and `ververica0.png` → `Ververica.png` (kept over the 814px webp for its 1870px).
- **Evidence:** re-scan reports 0 byte-identical and only the 7 known variant groups; live probes resolve "adyen", "stripe", "microsoft", "eif", "enfa", "novo nordisk", "ververica" to single clean tiles, and placing Stripe wrote a 13.8KB PNG data URL into a slot. Zero console errors. 106/106 vitest, tsc clean, build clean. Removed files parked in `Temp/logos-removed/duplicates/` with a `WHY.tsv` giving the keeper for each.

**Session 2026-07-30, round 38 — logo library cleaned up: 986 files → 883 real logos, 92 renamed (same branch, UNCOMMITTED).** Auri: "Did you rename them? I want to rename it if there is some clear indication what is the logo" + "sections is not logo, so we delete". No, round 37 only changed how names DISPLAY; the files were untouched. So:

- **92 files renamed to the company name.** 8 identified by LOOKING at them (rasterized each unclear file onto a light and a dark plate with `sharp`, since white artwork is invisible on white): `61f7d24fbf599.webp` → Terkko Health Hub, `unnamed.png` → Google, `logo_15_download-1.png` → Huawei, `1651484817-edtech-logo.webp` → EdTech Denmark, plus Sustainary, Ververica, Horizon Partners, WR. The other 84 were derived mechanically from filenames that already carried the name (`logo_20_Adyen_Logo.png` → `Adyen.png`, `logo_16_bloomberg-logo-aspect-ratio-1104-214.png` → `Bloomberg.png`): strip the `logo_NN_` prefix, drop 12+ char hashes, dimension tokens and noise words (logo/aspect/ratio/cropped/copy/rgb…), KEEP variant words (white/black/colour/horizontal) so two versions of one logo stay distinguishable. Collisions are reported, never overwritten, and identical-content collisions are flagged as duplicates.
- **103 files were not logos at all** — found by contact-sheeting the 37 remaining `logo_N.svg` files (4-col grid, light + dark) and reading the names of the rest: 34 scraped website UI fragments (chevrons, checkmarks, corner blobs — three real social icons among them were renamed instead: LinkedIn/Instagram/Facebook), 24 Bits&Pretzels event photos and hover images, 8 speaker headshots (400x400 CMS thumbnails: Toto Wolff, Sebastian Siemiatkowski, Robert Habeck…), 13 country flags, 12 unusable files (9 `.ai`, `New folder.7z`, `TechBBQInvestorDay.zip`), 5 unidentifiable leftovers, 7 byte-identical duplicate copies. Auri approved removing all of them; `sections.svg` (32.8MB, a solid artboard) was deleted outright on his instruction.
- **Moved, not deleted.** `public/logos/` is UNTRACKED, so a delete would have been unrecoverable — everything went to `C:/Users/User/AppData/Local/Temp/logos-removed/<group>/` with a `MOVED.tsv` mapping. **NB: that is a Temp directory; if any of it matters, rescue it before Windows cleans Temp.** Long CMS filenames blew the Windows 260-char path limit mid-move (the first attempt crashed on `…Philipp_FreiseFreise400x400.webp`), hence the short backup root and truncated destination names recorded in the TSV.
- **Result:** 883 logos, folder 58MB → 20MB, 3 oversized files left (Crane 732KB, Høje-Taastrup 522KB, Hero Academy Orange 471KB — all still usable, just badged). Live-verified after the cleanup: "adyen", "visa", "huawei", "google", "terkko", "edtech", "sustainary", "ververica", "louis vuitton", "goldman" all resolve to properly named tiles, `logo_` matches nothing generic any more, and placing Visa wrote a 19KB PNG data URL into a slot. Zero console errors. 106/106 vitest, tsc clean, build clean.
- **Still open:** one unidentified lime-green "SP" monogram kept as `image.webp` — Auri is naming it. Several near-duplicate variants remain by design (e.g. "Terkko" / "Terkko Health Hub" / "TerkkoHealthHub", "Adyen" / "Adyen0") since they are different artwork, not copies.

**Session 2026-07-30, round 37 — the logo library met 975 REAL files (same branch, UNCOMMITTED).** Auri filled `public/logos/` (975 indexed, 58MB on disk: 607 svg, 267 png, 41 webp, 10 jpg/jpeg). Real filenames broke the naive search immediately, so:

- **Folded search.** Query and index are both reduced to bare lowercase letters+digits — accents stripped, spaces/dashes/underscores dropped — and the raw filename joins the name and folder tags in the haystack. Verified live: "adyen" finds `Adyen0.png`, "alliancevc" finds `AllianceVC logo white0.png`, "arctic startup" finds `ArcticStartup_logo.png`, "aarhus" finds `StartupAarhus`.
- **Danish letters needed an explicit map.** Unicode NFD does not decompose `ø`, `æ`, `ß`, `ð`, `ł` — they are their own characters, not base+accent — so "hoje" found nothing for `Høje-Taastrup_vertical.png`. Added a transliteration pass (ø→o, æ→ae, œ→oe, å→a, ð/đ→d, ł→l, ß→ss, þ→th, ı→i) BEFORE normalization. Now "hoje", "høje" and "taastrup" all hit it.
- **`titleFromFile` mangled the same names.** The `\b\w` capitalisation treated the "j" in "Høje" as a word start (ø isn't a word character) and produced "HøJe". Now only the first letter of each space-separated word is touched, so "AllianceVC" and "AiDenmark" keep their internal caps.
- **A 32.8MB `sections.svg` would have hung the tab.** A picked file is embedded as a data URL (~1.33× as base64) and the library refuses a design over 4MB, so the picker now hard-blocks anything over 2MB with an explanation, badges anything over 400KB with its size (amber, red when blocked), and shows the size in every tile's tooltip. Verified: searching "sections" shows "Sections — 32.8MB, too big to use" and clicking it refuses.
- **The script now reports what it cannot use.** 12 files a browser can't display (9 `.ai`, `New folder.7z`, `TechBBQInvestorDay.zip`, plus one more `.ai`) are listed as a warning instead of being silently skipped. Match count is surfaced in the UI too ("Showing 24 of 87 matches — keep typing to narrow").
- **Evidence:** 7 live search probes + a real placement (clicking "Antler" wrote a 3358-char SVG data URL into slot 2 and the canvas rendered it), zero console errors. 106/106 vitest, tsc clean, eslint clean on both files, build clean.
- **Left for Auri (housekeeping, not blocking):** delete the 12 unusable files and re-export `sections.svg` / `Crane.svg` / `Design uden navn.svg` / `Høje-Taastrup_vertical.png` / `Hero Academy Orange.png` smaller — the first is 32MB of the repo's 58MB logo folder. Also note the generated `logoLibrary.json` is ~110KB and ships in the client bundle; if it grows past a few thousand entries, move it to `public/` and `fetch()` it on first open instead of importing it.

**Session 2026-07-30, round 36 — searchable logo library (same branch `sales-announcement`, UNCOMMITTED).** Auri: "the problem right now is that you have to find logos yourself. If I have a bunch of them in svg format, where can I save it, so if you write their name you can just upload it right away?"

- **Where they live: `public/logos/`.** Committed to the repo, so Vercel ships them and the whole team has the same set. Chosen over a DB/blob upload flow because SVGs are a few KB, it needs zero new infra or auth surface, and it makes the files addressable BY NAME for hand-editing sessions too (Auri says "add Molten Ventures", the file is at a predictable path). `public/logos/README.md` documents the convention.
- **The filename IS the search name.** `scripts/logo-manifest.mjs` walks the folder (svg/png/jpg/webp, subfolders included) and writes `src/data/logoLibrary.json`: `molten-ventures.svg` → name "Molten Ventures", searchable by "molten", "ventures" or the full name; a subfolder becomes an extra search term (`logos/2026/foo.svg` also matches "2026"). Wired as `npm run logos` plus `predev`/`prebuild`, so starting dev or building regenerates it — no stale index. The script warns about any file over 400KB, because a picked logo becomes a data URL inside the design and would eat the library's 4MB save cap.
- **UI: a "Saved logos" search under the Partner logo slots** (`LogoLibraryPicker.tsx`) — type a name, click a tile, done. A pick lands in the first EMPTY slot of the current layout (last one when all are full) and the hint says which ("Clicking a logo fills slot 2"), so it is predictable rather than magic. Tiles sit on a white plate because most partner artwork is dark and would be invisible on the sidebar. Empty library renders instructions instead of a dead search box.
- **Picks are converted to data URLs, not `/logos/…` references** — a saved design must not break when a file is later renamed or deleted, and `retargetPartnerLayout` already treats slot images as uploads. Natural dimensions are measured, and left undefined for an SVG with no intrinsic size instead of writing zeroes.
- **Evidence:** live walkthrough with 3 temporary test files — search "molten" filtered to 1 tile, click filled slot 1 as an SVG data URL (4302 chars), the hint advanced to slot 2, "danske" (a file in the `2026/` subfolder) filled slot 2, and both logos rendered on canvas; zero console errors; screenshot `scratchpad/logo-library.png`. Test files then removed and the empty-state verified. 106/106 vitest, tsc clean, eslint clean on new files, `npm run build` clean (the prebuild hook regenerating the manifest is visible in its output).
- **Next step for Auri:** drop the real SVGs into `public/logos/`, run `npm run logos`, commit both the files and the regenerated JSON. If self-service ever matters more than simplicity (teammates adding logos without a deploy), the upgrade path is an upload route + Vercel Blob behind the existing @techbbq.org gate, keeping the same picker.

**Session 2026-07-30, round 35 — MP4 save option + the editor's missing save button + drag-churn hardening (same branch `sales-announcement`, UNCOMMITTED).** Three reports from Auri's first run of round 34:

- **"We are missing save as mp4… it should be for the liquid metal as a background option condition."** `exportMp4` had existed in `useExport` with no UI since forever (listed under Dormant code). Now the save control is a THREE-way format choice — PNG · JPG · MP4 — in both `/simple` (the split-button popover) and `/editor` (the header radiogroup). New `isAnimatedBackground(id)` in `CanvasBackground.tsx` is the gate: true for `BG_REGISTRY` (liquid metal) + `ORB_REGISTRY` (the drifting orbs, animated too — and the default `orb7`, so gating on liquid-metal alone would have hidden the feature in the default state), false for the static season/stage JPGs. When it's false the MP4 row is replaced by a line saying WHY ("MP4 needs a moving background · pick a Liquid metal or orb one") instead of silently vanishing, and a stranded `exportFormat === "mp4"` falls back to JPG. The video path resumes the animation instead of pausing it (the still-image path pauses; recording a paused shader gives 3s of one frame) and the button reads "Recording… N%".
- **"There wasn't a save button after fine tuning."** The handoff always worked (the editor's unmount effect flushes the doc, so `/simple` re-adopted it) — but the only way back was a bare "Quick Templates" link, so nothing said the tuning was kept. The editor now shows **"Save & back to Quick Templates"** (orange, `Save` icon) whenever it was entered from Quick Templates (`HANDOFF_FLAG_KEY` present in sessionStorage); it clears the 350ms persist debounce, writes the session synchronously, toasts "Fine-tuning saved" and routes to `/simple`. Entered directly, `/editor` keeps the plain link.
- **"Maximum update depth exceeded at ShapeDragOverlay[handleMouseMove]".** NOT REPRODUCED on a clean server: real-mouse move-drags and corner resize-drags (60 mousemove steps each) on a sale doc produced zero console errors. Same signature as the 2026-07-29 round-8 sighting, which was also only ever seen against a hot-reloading dev server (Auri's tab was open through ~8 HMR cycles while this session edited `simpleLayout.ts`) — a hard reload clears it. Hardened the pattern anyway: overlays call `onGuidesChange` with a FRESH object on every drag tick, so `setGuides` re-rendered the whole editor on every mousemove even when the guides were unchanged. New `setGuidesIfChanged` collapses the no-op updates (all 4 overlay call sites), which cuts drag churn and removes the cascade that React's update-depth guard trips on. **If it recurs on a production build, re-investigate — that would be a real bug, not stale chunks.**
- **The hydration-mismatch error in the same report is not ours:** the diff shows `autocomplete="name"` / `autocomplete="organization"` and a `background-image: url(data…)` style injected onto the PersonEditor inputs — a password manager decorating the fields before React hydrates. Nothing in the app sets those.
- **MP4 export was actually BROKEN, not just UI-less** (found by recording one instead of trusting the "works" note in Dormant code). Three real bugs in `useExport.exportMp4`: (1) the codec string was hardcoded `avc1.640028` = AVC **level 4.0**, capped at 2,097,152 coded pixels — a 1500×1500 square is 2,262,016, so every square export died with `NotSupportedError` (16:9 and 9:16 are 2,073,600 and squeaked under, which is why it ever looked fine); now `pickAvcCodec` asks `VideoEncoder.isConfigSupported` for levels 5.2 → 4.0 and picks the first that works, falling back to a half-size (even-dimension) recording with a toast rather than failing. (2) An encoder error CLOSES the codec, and the loop kept calling `encode()` on it for the rest of the 3 seconds, then hung forever in `encoder.flush()` — the export never resolved and no error ever surfaced (a 120s Playwright wait timed out). Now the failure is captured, the loop breaks, and the real message is thrown into the toast. (3) A throwing `encode()` leaked its `VideoFrame` ("garbage collected without being closed") — `close()` moved into `finally`.
- **Evidence:** 106/106 vitest, tsc clean, changed files eslint-clean (1 pre-existing error in `CanvasBackground.tsx`, verified by stashing), build clean. Live: the Save popover lists PNG/JPG/MP4 on `orb7`, drops to PNG/JPG + the explanation on `season1` (Molten Gold); a real 1:1 MP4 downloaded and was byte-inspected — 515KB, `ftyp`+`moov`, **1500×1500** AVC track, 16 frames. The editor round-trip was walked with a real mouse: the return button is labelled, a text drag made 300ms before the click survived the trip (sessionStorage still held the PRE-drag position, so the synchronous flush is what saved it) and `/simple` shows "Custom design active".
- **Then: "the video is lagging, it has to be smooth like on the preview" — rebuilt the capture as COMPOSITING. 5fps → 27.5fps.** The old loop re-rasterized the entire DOM with `html-to-image` every frame (~180ms each), which is what capped it. Now: `DynamicTemplate` wraps the background in `<div data-canvas-bg="1">`; the export hides that layer (and forces the canvas root's opaque `background` transparent, else the overlay would cover the background), rasterizes everything else **once** into a transparent overlay canvas, then per frame does two `drawImage` calls — live shader/orb canvas, then the overlay — on a `requestAnimationFrame` clock at 30fps. Measured: compositing alone sustains 240fps, so the frame rate is now encoder-bound, not capture-bound. The old per-frame path is kept as a fallback for a background layer whose pixels can't be read (`canReadPixels` probes it; an unreadable WebGL context would otherwise yield an all-black video).
- **Two more real bugs found by recording it:**
  - **A 1500×1500 frame at 30fps CRASHES the Chrome renderer** (tab died twice mid-test). Measured the neighbourhood: 1440×1440, 1920×1080 and 1080×1920 — all ≤ 2,073,600 px — each encoded 3s cleanly. So `videoFrameSize()` caps video frames at Full-HD's pixel count with the aspect kept and dimensions even: the three formats record at **1440×1440 / 1920×1080 / 1080×1920**. Still images keep the full canvas resolution at 2× supersampling; social platforms re-encode to ≤1080 anyway. Encoder queue capped at 4 in-flight frames (the measured-stable value).
  - **`mp4-muxer` rejects a non-zero first timestamp** and threw for all 82 chunks (then died in `finalize()` with a null `colorSpace`). Wall-clock timestamps start a few ms in because the loop waits for the first rAF tick, so the muxer now gets `firstTimestampBehavior: "offset"`.
- **Round 2 of the same complaint ("it still doesn't feel as smooth even") — the problem was frame SPACING, not throughput.** Parsed the `stts` (frame-duration) table out of the exported files instead of eyeballing them:
  - **wall-clock timestamps:** 83 frames / 3.02s but **14 distinct frame gaps** — 33.4ms, a pile of 37.x, and one **89.4ms stall**. Temporally accurate, visibly juddery. Frame timestamps were the real elapsed time, so any late frame permanently widened its own gap.
  - **uniform timestamps** (`timestamp = frameIndex / FPS`): one gap, 33.3ms × 83 — even playback, but still only 83 of 90 slots, so the motion was SAMPLED unevenly and shown evenly (a subtler wobble).
  - **uniform + absolute schedule:** **91 frames / 3.03s, a single 33.3ms gap.** The pacing bug was `dueAt = elapsed + frameMs`, which accumulates drift — with animation frames arriving faster than the target, a 33ms slot kept landing on the next-but-one tick. Frame *n* is now due at `n × frameMs` from the start, absolute. Measured slot fill: 83/90 → 91/90. Encoder queue cap 4 → 8 (measured: the point where backpressure waits drop from 30 to 0 at 30fps), plus `framerate` + `latencyMode: "quality"` on the encoder and `frameRate` on the muxer track so players see constant-frame-rate video.
- **Why 30fps and not 60:** measured at 1440², 60fps fills only **73%** of slots (533 backpressure waits) — the encoder, not the capture, is the ceiling. 30fps fills 100%. Also verified the source isn't the problem: the live shader canvas changes on EVERY animation frame (473/473 ticks sampled), so there are no duplicated source frames to begin with.
- **Video evidence (byte-inspected + frame-decoded, not just "it downloaded"):** final 1:1 sale export = 1.9MB, **1440×1440** AVC track, **91 frames over 3.03s = constant 30fps**. Decoded frames at 0.2s / 1.5s / 2.9s and screenshotted them: the liquid-metal background has visibly moved between all three while the figure, ribbon and photo band stay put — the composite is correct, not a black box (`scratchpad/mp4-frames.png`). Sample files kept in the session scratchpad (`smooth-square.mp4` = wall-clock, `uniform.mp4` = uniform stamps, `final30.mp4` = shipped).
- **If it STILL reads as choppy to Auri, the remaining lever is a deterministic clock:** stop sampling real time and step the animation itself — `LiquidMetal` takes a `frame` prop and `webGlContextAttributes={{ preserveDrawingBuffer: true }}` is already set, so with `speed=0` the shader can be rendered at exact 1/60s steps (and `OrbCanvasBackground` has its own `timeRef` that could take an explicit time). That decouples smoothness from encoder throughput entirely — perfect 60fps regardless of machine — but it means threading a video-time override from `useExport` through the page → `DynamicTemplate` → `CanvasBackground`, which is why it was not done first.

**Session 2026-07-30, round 34 — third template: Sales Announcement (branch `sales-announcement`, UNCOMMITTED).** Auri's ask, with two reference JPGs (`Desktop/TBBQ/2026 Season/48 days left.jpg`, `Less than 2 weeks 10percent.jpg`): a sale post that says the discount or how many days are left. Built as a THIRD template kind (`panel` | `partner` | **`sales`**) with two layouts, the same shape as the partner template's One/Two/Four:

- **`buildSalesDesign(form, format)`** (`simpleLayout.ts`). `countdown` = giant figure + caption top-left ("48" / "days left") with a wide photo band along the bottom. `discount` = headline, giant figure, white CTA pill (brand-red text), small footer line, portrait photo card bottom-right. Both share an optional **diagonal ribbon** across the top-right (rotated 45° band + text, geometry computed in PIXELS so it doesn't skew on 16:9/9:16). Roles: `sales.value/.caption/.headline/.cta/.footer/.ribbon`, shapes tagged `ribbon.band` / `cta.pill`, photo slot `sales-countdown.photo` / `sales-discount.photo` (layout-specific, so the two layouts can never shape-match each other — the `logo-duo-N` trick).
- **Auto-fits that the live walkthrough forced (each was a real defect on screen):** ribbon text shrinks to the VISIBLE chord of the band (a 3× "TECHBBQ" default ran off the corner); `ribbonGuard` pulls top-area text left of the ribbon (the discount headline ran under the white band); the figure uses a 0.68em advance estimate (the "%" touched the photo card); the CTA font shrinks when the text can't fit the column; the discount figure is CENTRED in the room between headline and pill (bottom-anchoring left a void on 9:16).
- **`docKindOf(doc)`** is the new single source of truth for kind: sales → partner → panel. Replaces every `isPartnerDoc(d) === (template === "partner")` binary guard in `/simple` (kind-mismatch heal, parked-shelf partitioning, library-load purge, bundle variants) and gates the panel migrations (`adoptLegacyPanelRoles`, `dedupeSpeakerRoles`, `stripLeakedPanelWords`).
- **`retargetSalesLayout`** — the partner slot reconciliation generalized: `retargetPartnerLayout` and it now share `retargetSlotDoc(tuned, rebuilt, slotRoles)`, so uploading or clearing the sale photo keeps a hand-tuned design instead of rebuilding. Parked revival scans sales docs the same way partner docs are scanned. **No `syncSalesChrome`:** countdown and discount are structurally different compositions, so each owns its own tuning per format (parking handles round-trips).
- **Plumbing:** `SalesForm` + `emptySalesForm`, `salesLayoutOf` / `isSalesDoc`, `SimpleFormsSnapshot.sales` (kept whole like partner logos — each layout owns a photo), `formsFromDoc` sales branch (snapshot first, role-tagged layers as the fallback), `bundleCoverage` reports sale types, `TemplateCoverage.layout` widened, `simpleExportName` → "1x1 - Sale - 48 days left", `"sales"` added to the API's `KINDS`, TeamLibrary row label + prop types.
- **No official library item yet.** `DEFAULT_ITEM_IDS.sales` is deliberately `undefined`, so the Sale template has no flavour picker and no auto-load — the built-in layouts ARE the template until Auri tunes one and saves it (then the Update/coverage machinery works exactly as for the other two).
- **Evidence:** 106/106 vitest (32 new: golden snapshots for both layouts × 3 formats, ribbon fit + chord containment, CTA pill ≥ text, photo-in-bounds, figure clears the photo band, layout/kind disjointness, `retargetSalesLayout` fill/clear/refusal, snapshot + legacy form round-trip, coverage, export naming), tsc clean, changed files eslint-clean (10 pre-existing errors elsewhere in `src/hooks`), `npm run build` clean. Live Playwright walkthrough on all three formats: both layouts render, photo upload fills the frame with the gradient border, template switch Sale ↔ Panel ↔ Partner leaks nothing either way, zero console errors (only the signed-out 401 library prefetches).
- **Next steps:** 1. Auri eyeballs both layouts (screenshots in `C:/Users/User/sales-*.png`) and tunes them in the editor. 2. Save as an official "Sale" library item, then add its id to `DEFAULT_ITEM_IDS.sales` so the team lands on it. 3. Review the diff on `sales-announcement`, merge to `master` (auto-deploys). **Note:** the CTA default is "BOOK NOW" without the reference's arrow glyph — type "BOOK NOW →" in the Button field if you want it.

**Session 2026-07-29, round 33 — tuned 16:9 Host doc "switches" on format round-trips (code + LIVE DB write).** Auri tuned the 1-host 16:9 design (headline renamed to singular "HOST", his own hand-made description layer), but returning to 16:9 showed an older design. TWO causes found by emulating his walk on the live bundle:

1. **Hand-deleted role layer strands the tuning.** He replaced the generated `speaker-0.secondary` with a role-less hand-made text — the doc's shape key could never match a rebuild again, so his tuning parked under an unreachable key and the STALE 16:9×1 variant revived instead. Data repair (backup `host-backup2-*`): his description re-tagged `speaker-0.secondary` (sidebar edits now address it), the shadowing stale variant dropped. Verified: key match, direct retarget, full 16:9 → 1:1 → 16:9 walk revives his exact tuning.
2. **Singular/plural headline.** New builder rule: on a moderator-less form whose headline IS the word "HOST"/"HOSTS" (any case), the rendered headline follows the count — "HOST" at 1, "HOSTS" at 2+ (same pattern as the partner label plural). Any other headline passes through verbatim. Without this, a successful retarget would stamp the form's "HOSTS" over his singular. Test added (74/74).

**Pattern note for future sessions:** "my tuned design switches back on format/count round-trips" = shape-key mismatch; diff the tuned doc's role set against its rebuild (hand-deleted role layers are the usual cause; consider re-tagging surviving hand-made replacements on load, like `adoptLegacyPanelRoles` does for photos).

**Session 2026-07-29, round 32 — host-mode sidebar: just "Hosts 1-2".** With the Host flavour loaded (`hostMode` = loadedItem is the Host item), the Setup section hides the Moderator toggle and says **Hosts** with the 1-2 stepper; person cards read "Host 1/2", section "Hosts (N)", button "Add host"; the Moderator editor section never renders in host mode. Regular panels unchanged. Verified live both ways (seeded loadedItem sessionStorage signed-out). 73/73 vitest, tsc + eslint + build clean.

**Session 2026-07-29, round 31 — Host words (HOSTS / BBQ Stage) + label chips refit on retarget (code + LIVE DB write).** Auri: Host template must say headline "HOSTS", label "BBQ Stage", and the white chip must run slightly longer than the label text. Two layers:

- **Mechanism — `resizeLabelChip`** (called by `retargetTunedDoc` AND `retargetPartnerLayout`): when a carried label's content changes, the chip resizes by the text-width delta (keeps hand-tuned extra width) with a FLOOR of newText + the builder's padding — so the chip is always slightly longer than the text even when the old chip was already too tight (his square doc was; the floor is what fixes the reported symptom class, incl. the earlier "OFFICIAL COMMUNITY" chip clipping). Center-aligned labels keep the chip centered; left-aligned keep the left edge. Chip found by `label.chip` tag or the positional fallback. Test added (74/74).
- **Data — Host item (`e3fce4c3`) updated in Neon** (backup `host-backup-*` in scratchpad; dry-verified): snapshot form → headline "HOSTS", label "BBQ Stage", bg `stageBbq` (his Update at 20:23 had tuned the ACTIVE doc's words but `stripFormsForSave` snapshots the form, which still had the seeds); 5 stale docs re-worded via the real retarget (chip refit included), his 2 tuned docs untouched. Verified: all 7 docs say HOSTS/BBQ STAGE, every chip > label text width, every doc key-matches its rebuild. NB the script had to REHYDRATE the snapshot form via `formsFromDoc` before rebuilding — snapshot photos are stripped and live in the doc's role images.

**Session 2026-07-29, round 30 — canvas click-drag grabbed the BACKGROUND image (native img drag).** Auri's screenshot: dragging on the canvas produced a floating square ghost of the background. Static image backgrounds (stages/seasons) render as a real `<img>`, and browsers natively drag any image — same bug class as the logo-slot rounds. Fix: `draggable={false}` on the background `<img>` (`CanvasBackground.tsx`) and on the canvas-image `<img>` in `DynamicTemplate.tsx` (the crop-pan and logo imgs already had it). Verified locally (bg img draggable=false in DOM) + on prod post-deploy. 72/72 vitest, tsc + build clean.

**Session 2026-07-29, round 29 — kind-mismatched custom docs self-heal (Auri's screenshot: HOST design on canvas under the PARTNER sidebar).** ROOT CAUSE of the stuck state: nothing enforces that `custom`'s kind matches `template`. Once a panel doc goes active under the partner form (effect races on fast template/flavour clicks can produce it), the state is PERMANENT — hydrate restores it and the rebuild effect's baseline check early-returns before anything could repair it, across every reload. This also explains "the drag still doesn't work on the web": his prod tab was wedged in this state (prod bundle forensics + a real-mouse prod drag test proved the pointer-drag itself deployed and works — chunk `e6a84ca9` carries the new markers, zero old-build strings). Fix: the rebuild effect computes `kindMismatch` and BYPASSES both baseline early-returns when it holds, so the normal park-and-revive flow runs even with an unchanged form and even on the first post-hydrate pass — the wrong-kind doc is parked (recoverable), the right kind revives or rebuilds. Verified live on localhost: seeded the exact corrupted state (real tuned panel doc + persisted partner form), reload → partner sidebar + partner canvas, panel tuning parked. 72/72 vitest, tsc + eslint + build clean. Prod verification after deploy in this entry's follow-up.

**Session 2026-07-29, round 28 — logo reorder rebuilt as a POINTER drag (the HTML5 grip handle live-failed too).** Auri: "it has to be click and hold, and still somehow the selection square shows." The grip handle demanded pixel-precise aim and dragging the logo itself did nothing but paint a text-selection rectangle. Rebuilt on the editor-canvas pattern: pointer events on the label with a 5px click-vs-drag threshold — press-and-hold ANYWHERE on a filled logo, move, release on the target slot (`elementFromPoint` → `data-logo-slot`); a sub-threshold press stays a plain click and opens the picker; `onClickCapture` swallows the drag-end click; `select-none` + preventDefault-past-threshold + `removeAllRanges` kill the selection square; grip icon kept as a pointer-events-none affordance; `LOGO_DRAG_TYPE`/HTML5 reorder deleted (file-drop from the OS keeps using dragover/drop). Verified with REAL mouse input: hold-drag slot 0 → 1 moves the logo (`["L"] → [null,"L"]`), zero selected text after, plain clicks on empty AND filled slots open the file chooser (two intercepted chooser modals = hard proof; NB the MCP bridge eats `filechooser` events before `waitForEvent` sees them — modal state is the reliable signal). 72/72 vitest, tsc + eslint + build clean.

**Session 2026-07-29, round 27 — logo drag moved to a grip handle (click-to-upload was broken).** Auri: "click hold select works like click unclick and then it selects." ROOT CAUSE: round 20 made the whole slot container `draggable`, which hijacks plain clicks on the upload `<label>` — press-and-hold starts an HTML5 drag instead of a click, so the file picker needed a second click. Fix: the container is no longer draggable; the reorder drag starts from a **grip handle** (GripVertical, top-left of a filled slot, cursor-grab) and the whole slot stays a drop target for both files and reorders; `<img draggable={false}>` so native image-drag can't fight either path. Verified live: first plain click opens the file chooser immediately (the dialog interrupted the test script — hard proof), handle dragstart → drop executes the swap wiring. 72/72 vitest, tsc + eslint + build clean.

**Session 2026-07-29, round 26 — pill into the header + hosts cap at 2.** The "Custom design active · saved" pill (round 23 put it OVER the preview) moved into the HEADER next to the title — it never covers the canvas now (Auri's ask). And with the Host flavour loaded (`loadedItem.id === HOST_ITEM_ID`, module const), `MAX_SPEAKERS` drops 9 → 2: stepper +, "Add speaker" and `setSpeakerCount` all respect it. Verified live: pill in header not main. 72/72 vitest, tsc + eslint + build clean.

**Session 2026-07-29, round 25 — "Host" panel flavour (LIVE DB insert + UI).** Auri: alongside Panel Discussions, a Host template — 1 or 2 hosts on stage backgrounds. New library item **"Official Host" (`e3fce4c3-8afc-4d87-9dd5-3ddc5425b993`)**, seeded from the no-moderator grid (which IS a 1-2 person card layout): active doc = square 2-host, variants = all 3 formats × both counts (each verified to key-match + retarget from its form; 1-host vs 2-host keys distinct), label "Meet your hosts", sample hosts Pierre + Rajeev, background `stageTech` (Tech Stage 1 — panel-kind, so all stage groups are pickable). Snapshot carries the 2-host roster with photo paths. NB: `library_items.updated_by` is NOT NULL — the first insert attempt omitted it and one write attempt was permission-blocked before the fixed-id retry succeeded. UI: `ANNOUNCEMENTS` generalized to `FLAVOURS` per template — Panel gets "Panel type" (Panel Discussion · Host), Partner keeps "Announcement" (Official · Community); all 4 items prefetched, clicks instant. Auri tunes the Host design + presses Update to make it canonical. Verified live: picker renders on Panel, Host click requests the new id. 72/72 vitest, tsc + eslint + build clean.

**Session 2026-07-29, round 24 — official templates prefetched; announcement clicks are instant.** Auri: the picker felt slow — every press did a server round-trip before anything changed. Now all three official items (panel default + both announcements) are prefetched into an in-memory `itemCache` (ref, Map) right after mount; `loadItemById` applies a cache hit SYNCHRONOUSLY (zero network on click) and the template-default effect reuses the same `fetchLibraryItem`. Failed prefetches (signed out/offline) cache as null → the click falls back to a live fetch with the sign-in prompt. Staleness handled: header Update and library save evict their id, so the next explicit load refetches; a teammate's mid-session update still needs a reload to be seen (same as before). Verified live: all 3 ids requested at mount, one request each. 72/72 vitest, tsc + eslint + build clean.

**Session 2026-07-29, round 23 — banner relocated + Official/Community announcement picker.** (1) The "Custom design active — saved" banner moved OUT of the sidebar (it shoved the whole form down) into a compact pill floating top-center over the PREVIEW: "Custom design active · saved" + Revert, full explanation in the tooltip. (2) Partner template gains an **Announcement** section above Format: "Official Announcement" (loads `7583298d` Official Partner) · "Community Announcement" (loads `431c22ac` Official Community Partners) via new `loadItemById` (modal-Load path + the deep link's 401 sign-in fallback); active state = loadedItem.id match; pressing the active one is a no-op. NB: the community item id was nearly shipped with two digits transposed from memory — verified against the live DB first. Verified live: picker renders, Community fires the load (401 → sign-in dialog signed out), pill over preview not sidebar. 72/72 vitest, tsc + eslint + build clean.

**Session 2026-07-29, round 22 — panel words leaked into partner designs on a template switch (Auri's screenshot: 9:16 partner announcement wearing MODERATOR + 4 SPEAKER words).** ROOT CAUSE: the rebuild effect's partner branch ran `syncPartnerChrome(custom, …)` gated only on template+format — but on a TEMPLATE switch `custom` is still the doc of the template being left, so a same-format Panel → Partner switch carried the panel's role-less words (and logo settings) into the partner doc. The panel branch had a kind guard from day one; the partner branch never did. Fix: `isPartnerDoc(custom)` in the page gate AND kind guards inside `syncPartnerChrome` itself (both directions). Plus healing: new `stripLeakedPanelWords` in `migrateLegacyPanelDoc` drops role-less MODERATOR/SPEAKER texts from PARTNER docs on load, so tabs holding pre-fix contaminated local state clean up automatically (library scanned: all 3 items were already clean — the leak was never saved). Verified live: tuned 9:16 panel → switch to Partner → zero role words on canvas. 72/72 vitest, tsc + eslint + build clean.

**Session 2026-07-29, round 21 — the Template toggle opens the official templates.** Pressing Panel loads "Official Panel Discussions" (`c20fddbb`), Partner Announcement loads "Official Partner" (`7583298d`) — the generic built-in layouts are now only the signed-out/offline fallback. The old partner-only default-load effect generalized to `DEFAULT_ITEM_IDS` per kind, one-shot per kind per tab, with KIND-SCOPED guards (work of the other template no longer blocks; an unapplied ?load= deep link still owns the first load; once its marker is set the param is address-bar residue). Verified signed-out via network watch: cold open requests the panel item, switching to Partner requests the partner item, switching back re-requests nothing. 71/71 vitest, tsc + eslint + build clean.

**Session 2026-07-29, round 20 — Corner Heat default + logo drag-and-drop.** Default background for both templates is now **Corner Heat (`orb7`)** — every `"orb5"` default/fallback in `simpleLayout.ts` switched (explicitly saved backgrounds unaffected; golden snapshots updated, diff is only the backgroundId). `LogoSlot` gained: (1) drop an image FILE straight onto any slot (dragover highlight, same `readImage` path as the picker), (2) drag a filled slot onto another to move/swap it (`application/x-logo-slot` payload keeps file-drops and reorders apart; the ‹ › buttons stay as the keyboard path). Wired on quad + duo (`index` + `onReorder=swapLogos`); single slot keeps file-drop only. Verified live via synthesized DragEvents: file drop fills slot 0, reorder moves it to slot 1; clean session persists `orb7`. 71/71 vitest, tsc + eslint + build clean.

**Session 2026-07-29, round 19 — Quick Templates is the main page.** `/` now server-redirects (307) to `/simple`; the advanced editor moved to **`/editor`** (`git mv src/app/page.tsx src/app/editor/page.tsx`, root replaced by a `redirect()` stub). Share links (`/simple?load=…`) unchanged. Only one link needed updating: /simple's "Edit & fine-tune" → `/editor` (the editor's "Quick Templates" button already pointed at `/simple`; the sessionStorage handoff is path-independent). Verified live: / lands on /simple, full editor round-trip adopts tuning, zero console errors. 71/71 vitest, tsc, build clean (eslint: 0 errors, 6 pre-existing warnings now attributed to editor/page.tsx — same file, new path).

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

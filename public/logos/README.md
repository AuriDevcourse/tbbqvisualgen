# Logo library

Drop partner / sponsor logos in here. They become searchable in Quick Templates
under **Saved logos**, so nobody has to hunt for a logo on the internet again.

## How to add one

1. Save the file in this folder. **SVG is best** (sharp at any size, a few KB).
   PNG / JPG / WebP work too.
2. Name the file **exactly as the logo reads**, with spaces and the brand's own
   casing: `Molten Ventures.svg`, `byFounders.svg`, `Akademikernes A-kasse.svg`,
   `AstraZeneca Colour.svg`. The filename IS both the display name and the
   search name, shown verbatim in the picker. Search ignores case, accents and
   punctuation, so "goteborg" still finds `Business Region Göteborg.svg`.
   Add a variant word when you keep more than one version of a mark:
   `Acme.svg` + `Acme White.svg` + `Acme Colour.svg`.
3. Run `npm run logos` (starting `npm run dev` or `npm run build` does it for
   you). This rebuilds `src/data/logoLibrary.json`, which the picker reads. It
   also measures each logo's brightness so the picker can put a white logo on a
   dark tile and a dark logo on a white one; measurements are cached, so only
   new or changed files are re-measured.
4. Commit both the logo and the regenerated JSON. Vercel deploys it and the
   whole team has it.

## Optional: subfolders

A subfolder name becomes an extra search term. `logos/2026/foo.svg` is also
found by typing "2026". Use it for seasons or categories if the list gets long.

## Finding duplicates

`npm run logos:dupes` reports files that look like the same logo: same trimmed
aspect ratio, near-identical ink mask, similar ink colour. It writes
`duplicate-logos-report.json` and **deletes nothing** on purpose — the check
needs human eyes. In the first real pass it flagged "European Investment Bank"
and "European Investment Fund" as one logo (they look nearly identical but are
different institutions), and treated the TechBBQ Investor Day colour-icon and
mono-icon variants as copies. Look at the groups before removing anything.

## Importing a batch from the techbbq.dk site export

`npm run logos:import -- C:/path/to/export` handles a folder of logos pulled off
the website. Those arrive named `svgexport-1.svg`, `svgexport-2.svg` …, so the
script matches on **artwork** instead: it signatures every incoming file and
compares silhouettes against the whole library, skipping anything within 12% of
a logo we already have.

It never writes into this folder. It stages the new files under a numbered name
and renders contact sheets, because a human still has to read each logo and name
it. Copy the staged file in under its real name, then run `npm run logos`.

When an incoming name collides with an existing logo, look at both at full size
before deciding: usually the export is a different treatment and you keep both
(`Imec.svg` + `Imec White.svg`), but sometimes it is simply better artwork and
should replace the original.

## Checking a logo is still current

`npm run logos:verify -- scripts/logo-checks/batch1.txt` compares our copy
against the logo each company ships on its own site today. Input is one
`Our file.svg|domain.com` per line; the output is a side-by-side sheet in the
scratchpad previews folder.

It is name-and-own-site verification, not reverse image search (no such tool is
available here), so a domain has to be supplied per company and roughly one row
in four grabs the wrong asset off a busy marketing page — those need a look
rather than a silent pass. The first batch caught two real problems:
`Slush2025 Dates White.png` is a year out of date, and `Vaekstfonden.svg` is a
dead brand (Vækstfonden became EIFO).

## Watch out for

- **Keep files small.** A picked logo is embedded in the design as a data URL,
  so a 2MB logo eats the team library's 4MB per-design save limit. The manifest
  script warns about anything over 400KB. Export SVGs without embedded rasters.
- **Dark logos vanish on dark backgrounds.** The templates run on dark
  gradients, so prefer the white / knockout version of a logo and name it so
  you can tell them apart: `acme.svg` + `acme-white.svg`.

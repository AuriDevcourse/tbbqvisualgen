# TechBBQ Visual Generator — Progress

## 2026-04-10

### Added: Presentation Format (1920×1080)
- New format option in the format picker between Twitter/X and Custom
- Added `presentation` to PlatformFormat type and FORMAT_DIMENSIONS

### Added: 6 New Dark Backgrounds (lm7–lm12)
- **lm7 — Crimson Ember**: Red metaballs on near-black (#050000)
- **lm8 — Midnight Gold**: Sparse gold streaks on blackout (#030200)
- **lm9 — Volcanic**: Orange metaballs on dark (#040100)
- **lm10 — Dark Flame**: Red-orange glow in deep black (#020000)
- **lm11 — Amber Noir**: Rich amber on blackout (#020100)
- **lm12 — Scarlet Edge**: Red streaks on void (#030000)
- All new backgrounds have much darker bases and softer edges than originals
- Focused on red, gold/yellow, and orange color palette
- lm7 and lm9 use metaballs shape (bubble effect)
- AI prompt updated with new background descriptions

### Added: Feedback Button
- Feedback button in top-right header
- Opens modal with text input
- Sends email via Resend API to baciauskas.aurimas@gmail.com
- API route: `/api/feedback`
- Requires `RESEND_API_KEY` env var (set in Vercel)

### Deployment Notes
- Vercel production branch needs to be changed from `main` to `master`
- Environment variables: `RESEND_API_KEY`, `OPENROUTER_API_KEY`

---

## 2026-02-16 (Initial)

### Initial Setup
- Next.js 16 app with Turbopack
- AI creative director chat interface (OpenRouter API)
- Liquid metal WebGL shader backgrounds (6 presets)
- Dynamic template with glass cards, text overlays, logo placement
- Canvas image placement with drag overlays
- Format picker: Instagram, Story, LinkedIn, Facebook, Twitter/X, Custom
- PNG export via html-to-image
- Partner logo upload
- Preset templates panel

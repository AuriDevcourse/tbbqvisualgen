# TechBBQ Visual Generator

Internal tool for the TechBBQ team to generate on-brand social-media visuals through a chat with an AI creative director. The chat drives a live preview built from liquid-metal animated backgrounds, glass cards, text overlays, partner logos, and drag-able photos. Export the result as a PNG when you're happy.

## Quick start

```bash
cp .env.example .env.local   # then fill in keys
npm install
npm run dev
```

Open http://localhost:3000.

## Environment

| Var | Required | What it does |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | yes | AI creative director (Claude via OpenRouter) |
| `RESEND_API_KEY` | for feedback button | Routes in-app feedback to email |
| `FEEDBACK_EMAIL` | no | Override feedback recipient (defaults to Auri's personal address) |
| `NEXT_PUBLIC_APP_URL` | no, prod-only | Used as the `HTTP-Referer` on OpenRouter calls |

## Formats

Four canvas presets: Square 1500×1500, Presentation 1920×1080, Instagram Story 1080×1920, and Custom (any 100–4096px).

## Keyboard shortcuts

- `⌘E` (or `Ctrl+E`) — export PNG
- `⌘⇧R` (or `Ctrl+Shift+R`) — regenerate the last design
- `Enter` — send chat message · `Shift+Enter` — newline
- `Esc` — close the feedback dialog

## Stack

Next.js 16 (Turbopack, React 19), Tailwind v4, OpenRouter (`anthropic/claude-sonnet-4`), `@paper-design/shaders-react` for liquid-metal backgrounds, `html-to-image` for PNG export, Sonner for toasts.

## Deployment

Deployed on Vercel. Production branch is `master`. Set both env vars in the Vercel project settings.

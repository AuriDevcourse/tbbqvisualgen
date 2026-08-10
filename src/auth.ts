import NextAuth, { type Session } from "next-auth";
import Google from "next-auth/providers/google";
import type { NextRequest } from "next/server";

/**
 * Google SSO gated to the TechBBQ workspace. Only used to protect the team
 * library API — the visual editor itself stays open. Same pattern as
 * tbbq-tools.
 */
const nextAuth = NextAuth({
  providers: [Google],
  callbacks: {
    signIn({ profile }) {
      // Hard gate: only @techbbq.org accounts get a session. Google's
      // `email_verified` must be true so an unverified alias can't slip in.
      const email = profile?.email ?? "";
      return Boolean(profile?.email_verified) && email.endsWith("@techbbq.org");
    },
  },
});

/**
 * Dev-only bypass. When the Google OAuth client is broken (rotated secret,
 * revoked client) you can still work on the team library locally by setting
 * DEV_FAKE_USER=you@techbbq.org in .env.local.
 *
 * Fails closed on purpose: the flag is read once at module load and is ignored
 * unless NODE_ENV is exactly "development", so a production build can never
 * hand out a session even if the variable leaks into the deploy environment.
 */
const devUser =
  process.env.NODE_ENV === "development" && process.env.DEV_FAKE_USER?.endsWith("@techbbq.org")
    ? process.env.DEV_FAKE_USER
    : undefined;

if (devUser) {
  console.warn(`[auth] DEV BYPASS ACTIVE — every request is treated as ${devUser}. Local only.`);
}

function devSession(): Session {
  return {
    user: { email: devUser, name: devUser!.split("@")[0] },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  };
}

/** Server-side session read. All call sites do `await auth()`. */
export async function auth(): Promise<Session | null> {
  if (devUser) return devSession();
  return nextAuth.auth();
}

/**
 * Auth.js route handlers. Under the dev bypass, GET /api/auth/session answers
 * with the fake session so the header chip and the library panel show as
 * signed in; every other Auth.js route keeps its real behaviour.
 */
export const handlers = devUser
  ? {
      GET: (req: NextRequest) =>
        new URL(req.url).pathname.endsWith("/session")
          ? Response.json(devSession())
          : nextAuth.handlers.GET(req),
      POST: nextAuth.handlers.POST,
    }
  : nextAuth.handlers;

export const { signIn, signOut } = nextAuth;

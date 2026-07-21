import { NextResponse } from "next/server";

/** TEMPORARY diagnostic: which auth env vars exist (booleans only, never
 *  values). Remove once production sign-in works. */
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    AUTH_SECRET: Boolean(process.env.AUTH_SECRET),
    AUTH_GOOGLE_ID: Boolean(process.env.AUTH_GOOGLE_ID),
    AUTH_GOOGLE_SECRET: Boolean(process.env.AUTH_GOOGLE_SECRET),
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    lengths: {
      AUTH_SECRET: process.env.AUTH_SECRET?.length ?? 0,
      AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID?.length ?? 0,
      AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET?.length ?? 0,
    },
  });
}

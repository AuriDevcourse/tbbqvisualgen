import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { SETTING_KEYS, writeSetting } from "@/lib/editorLibraryDb";
import { checkRate, errorResponse, validateSettingBody } from "@/lib/editorLibraryApi";

export const dynamic = "force-dynamic";

/** The two whole-list shared settings: `hiddenPresets` and `folderOrder`.
 *  Full replace is the correct write for both — they are orderings/sets, not
 *  accumulations — so last-write-wins is the intended behaviour. */
export async function PUT(req: Request, ctx: { params: Promise<{ key: string }> }) {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) {
    return NextResponse.json({ error: "Sign in with your TechBBQ account to save for the team" }, { status: 401 });
  }
  const { key } = await ctx.params;
  if (!SETTING_KEYS.has(key)) {
    return NextResponse.json({ error: `key must be one of: ${[...SETTING_KEYS].join(", ")}` }, { status: 422 });
  }
  const limited = checkRate(`write:${email}`, 60);
  if (limited) return limited;
  const data = await validateSettingBody(req);
  if (data instanceof NextResponse) return data;
  try {
    await writeSetting(key, data, email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

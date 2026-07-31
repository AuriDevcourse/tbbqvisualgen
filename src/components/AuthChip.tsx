"use client";

import { useEffect, useState } from "react";
import { signIn, signOut } from "next-auth/react";
import { LogIn, LogOut, UserRound } from "lucide-react";

/**
 * Compact sign-in status for the header: the signed-in email with a sign-out
 * button, or a "Sign in" button. Reads the session once via the Auth.js
 * session endpoint — no SessionProvider needed for a single indicator.
 */
export function AuthChip() {
  // undefined = still loading (render nothing), null = signed out.
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (!cancelled) setEmail(s?.user?.email ?? null); })
      .catch(() => { if (!cancelled) setEmail(null); });
    return () => { cancelled = true; };
  }, []);

  if (email === undefined) return null;

  if (email === null) {
    return (
      <button
        onClick={() => signIn("google")}
        title="Sign in with your TechBBQ Google account (needed for the team library)"
        className="flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium border border-surface/40 text-muted hover:text-foreground hover:bg-white/5 transition-colors"
      >
        <LogIn className="w-3.5 h-3.5" strokeWidth={1.5} />
        Sign in
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1 pl-3 pr-1 py-1 rounded-full border border-surface/40">
      <UserRound className="w-3.5 h-3.5 text-white/50" strokeWidth={1.5} />
      <span className="text-xs text-white/70 max-w-[160px] truncate" title={`Signed in as ${email}`}>
        {email.split("@")[0]}
      </span>
      <button
        onClick={() => void signOut()}
        aria-label="Sign out"
        title={`Sign out (${email})`}
        className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-colors"
      >
        <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
      </button>
    </div>
  );
}

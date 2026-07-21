import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Google SSO gated to the TechBBQ workspace. Only used to protect the team
 * library API — the visual editor itself stays open. Same pattern as
 * tbbq-tools.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
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

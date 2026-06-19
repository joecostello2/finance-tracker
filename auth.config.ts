import type { NextAuthConfig } from "next-auth";

// Edge-safe Auth.js config (no database / Node-only imports). Used by both the
// middleware and the full Node config in auth.ts.
const PUBLIC_PATHS = ["/login", "/register"];

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const path = nextUrl.pathname;
      const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

      if (isPublic) {
        // Signed-in users shouldn't see login/register.
        if (isLoggedIn) return Response.redirect(new URL("/dashboard", nextUrl));
        return true;
      }
      // Everything else (matched by middleware) requires auth.
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // real providers are added in auth.ts (Node runtime)
} satisfies NextAuthConfig;

import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Next.js 16 renamed the "middleware" convention to "proxy". The Auth.js `auth`
// helper is the request handler that runs the `authorized` callback to gate routes.
const { auth } = NextAuth(authConfig);

export default auth;

export const config = {
  // Protect everything except Next internals, the auth API, and static assets.
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

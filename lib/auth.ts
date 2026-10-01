import bcrypt from "bcryptjs";
import NextAuth, { CredentialsSignin, type DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
}

/**
 * Failed sign-ins allowed per address before the address is locked out for the
 * window. Every attempt counts, whether or not the password was right, so the
 * limit cannot be used to learn anything about the password.
 */
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 10 * 60_000;

/**
 * Distinguishes "you are being throttled" from "wrong credentials" so the login
 * page can say so. Returning null instead would report a rate limit as a bad
 * password, leaving a locked-out admin convinced their password was wrong.
 *
 * The code travels back to the browser on the `signIn` result, so this string
 * is part of the UI contract in app/admin/login/page.tsx.
 */
export class LoginRateLimited extends CredentialsSignin {
  code = "rate_limited";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },
  pages: {
    signIn: "/admin/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const normalizedEmail = email.toLowerCase().trim();

        const limit = await rateLimit(
          `login:email:${normalizedEmail}`,
          LOGIN_MAX_ATTEMPTS,
          LOGIN_WINDOW_MS,
        );

        if (!limit.success) {
          throw new LoginRateLimited();
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user?.passwordHash) {
          return null;
        }

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);

        if (!passwordMatch) {
          return null;
        }

        if (user.role !== "ADMIN") {
          return null;
        }

        return { id: user.id, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "USER";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});

/**
 * The single admin guard. Every admin surface — proxy, route handlers, server
 * actions, and the admin pages — resolves authorisation through this function,
 * so there is exactly one place where "is this caller an admin" is decided.
 *
 * It returns the session on success and `null` on failure rather than throwing,
 * because every caller needs to respond differently: a route handler returns
 * 401, a server action returns an error result, and proxy redirects to the
 * login page. Keeping that decision with the caller is why the check itself
 * stays here and the response stays with them.
 *
 * It lives in this module, and not in the `@/lib/auth-helpers` module, so that
 * `"use server"` modules can import it. Those modules may only export async
 * functions, which is why a shared guard could not previously be re-exported
 * through them and had to be copy-pasted per file. The response factories do
 * live in `auth-helpers`, since nothing re-exports them.
 */
export async function requireAdmin() {
  const session = await auth();

  if (!session?.user?.id) return null;
  if (session.user.role !== "ADMIN") return null;

  return session;
}

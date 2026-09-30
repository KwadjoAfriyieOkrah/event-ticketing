# Project Standards

## Core principles
- Keep the project simple, readable, and maintainable.
- Prefer small, focused modules and clear naming.
- Use existing patterns in the codebase before introducing new ones.
- Validate behavior with the smallest relevant test or check.

## Code quality
- Write clean, consistent code and avoid unnecessary complexity.
- Favor explicit logic over clever abstractions.
- Keep functions and components focused on a single responsibility.
- Comment only where it adds real clarity.

## UI and UX
- Design for a clear, intuitive user flow.
- Ensure screens remain responsive and accessible.
- Keep forms and actions predictable and easy to understand.

## Data and validation
- Validate user inputs early and clearly.
- Handle empty, invalid, and edge-case states gracefully.
- Keep business rules centralized and easy to follow.

## Tooling and workflow
- Use the existing tech stack and project conventions unless a justified change is needed.
- Avoid broad refactors unrelated to the task at hand.
- Keep changes scoped and easy to review.

## Final checks before completion
- Confirm the requested behavior works as intended.
- Run the relevant checks/tests for the changed scope.
- Review the diff for accidental or unrelated changes.

# EventHub — Project Standards (always apply)

## Stack (do not substitute or ask about alternatives)
- Next.js 16, App Router, TypeScript strict mode
- Tailwind CSS v4
- PostgreSQL via Prisma ORM (no Mongoose, no raw SQL string concatenation — always parameterized Prisma queries)
- Auth.js (NextAuth v5) with Credentials provider, bcrypt password hashing, JWT session — admin-only, no public signup
- Zod for validation of every external input (form data, API bodies, query params, webhook payloads)
- Paystack for payments (GHS, kobo/pesewas as smallest unit) — never Stripe
- Cloudinary for image storage, using signed server-side uploads only

## Architecture rules
- Server Components fetch data by calling functions in `lib/data/*.ts` directly (Prisma calls). Never `fetch()` your own app's API routes from a Server Component.
- API routes (`app/api/**/route.ts`) exist only for: things a Client Component must POST to, and the Paystack webhook.
- Mutations from forms use Next.js Server Actions in `lib/actions/*.ts` where possible instead of API routes.
- All money is stored and calculated as integers in the smallest currency unit (pesewas), never floats.

## Security rules (non-negotiable)
- Every API route and Server Action validates its input with a Zod schema before touching the database.
- Every state-changing request checks the caller is authorized (admin session for admin routes; public booking routes are rate-limited).
- Payment status is only ever set to PAID inside the Paystack webhook handler after verifying the `x-paystack-signature` header. A client-facing "callback" page may only display status, never set it.
- Passwords are hashed with bcrypt, cost factor 12+. Never store or log plaintext passwords or Paystack secret keys.
- No secret (`PAYSTACK_SECRET_KEY`, `DATABASE_URL`, `NEXTAUTH_SECRET`, `CLOUDINARY_API_SECRET`) is ever prefixed `NEXT_PUBLIC_` or sent to the client.
- All error responses to the client are generic ("Something went wrong"); full error detail is only `console.error`'d server-side.
- Every list/detail query that takes an ID or slug from the URL validates and escapes it before querying — no trusting user input.
- Security headers are set globally in `next.config.ts` (CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Strict-Transport-Security, Permissions-Policy).

## Code style
- Explicit return types on exported functions.
- No `any`. Use Zod-inferred types or Prisma-generated types.
- Every function that can fail returns a typed `{ success: true, data } | { success: false, error }` shape rather than throwing across module boundaries.
- Comment *why*, not *what*, above any non-obvious security or business-rule decision.

## Working style for this project
- If something in a later instruction is ambiguous, make the most production-safe, conventional choice consistent with the rules above and continue — do not stop to ask, but leave a `// DECISION:` comment explaining the choice you made so it can be reviewed later.

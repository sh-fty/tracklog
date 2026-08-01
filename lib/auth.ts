import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE_NAME = "tracklog_key";

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

export function secretMatches(candidate: string): boolean {
  const secret = process.env.JOURNAL_SECRET;
  if (!secret || !candidate) return false;
  return constantTimeEqual(candidate, secret);
}

// The admin cookie carries a token derived from the secret rather than the
// secret itself, so the password isn't replayed on every request to the site
// or left sitting in plaintext in devtools. The secret is a long random hex
// string, so a straight hash is enough — there's no low-entropy password here
// to brute-force back out of the digest. The version prefix means bumping it
// invalidates every outstanding session.
export function sessionToken(): string | null {
  const secret = process.env.JOURNAL_SECRET;
  if (!secret) return null;
  return createHash("sha256").update(`tracklog:v1:${secret}`).digest("hex");
}

export async function isAdmin(): Promise<boolean> {
  const expected = sessionToken();
  if (!expected) return false;
  const jar = await cookies();
  const presented = jar.get(COOKIE_NAME)?.value ?? "";
  if (!presented) return false;
  return constantTimeEqual(presented, expected);
}

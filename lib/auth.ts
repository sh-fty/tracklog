import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const COOKIE_NAME = "tracklog_key";

export function secretMatches(candidate: string): boolean {
  const secret = process.env.JOURNAL_SECRET;
  if (!secret || !candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  return secretMatches(jar.get(COOKIE_NAME)?.value ?? "");
}

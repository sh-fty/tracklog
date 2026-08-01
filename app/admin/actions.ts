"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_NAME, isAdmin, secretMatches, sessionToken } from "@/lib/auth";
import { readJournal, writeJournal } from "@/lib/store";

export async function login(formData: FormData) {
  const key = String(formData.get("key") ?? "");
  if (!secretMatches(key)) redirect("/admin?bad=1");
  const token = sessionToken();
  if (!token) redirect("/admin?bad=1");
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/admin");
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
  redirect("/admin");
}

export async function saveEntry(formData: FormData) {
  if (!(await isAdmin())) redirect("/admin");
  const id = String(formData.get("id") ?? "");
  const journal = await readJournal();
  const entry = journal.entries.find((e) => e.id === id);
  if (entry) {
    const field = (name: string) => {
      const v = String(formData.get(name) ?? "").trim();
      return v.length ? v : undefined;
    };
    entry.title = field("title") ?? entry.title;
    entry.artist = field("artist");
    entry.note = field("note");
    entry.mood = field("mood");
    await writeJournal(journal);
  }
  revalidatePath("/");
  revalidatePath("/admin");
}

export async function deleteEntry(formData: FormData) {
  if (!(await isAdmin())) redirect("/admin");
  const id = String(formData.get("id") ?? "");
  const journal = await readJournal();
  const remaining = journal.entries.filter((e) => e.id !== id);
  if (remaining.length !== journal.entries.length) {
    await writeJournal({ entries: remaining });
  }
  revalidatePath("/");
  revalidatePath("/admin");
}

"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pbkdf2Sync } from "crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

interface EnvCredential {
  email: string;
  password: string;
}

/** Verify a plain-text password against a stored `salt:hash` string. */
function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const attempt = pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString(
    "hex"
  );
  return attempt === hash;
}

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  // 1. Check if this user already has a profile in the DB
  const rows = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (rows.length > 0) {
    // User has completed first-login setup → verify against the DB password
    const valid = verifyPassword(password, rows[0].passwordHash);
    if (!valid) {
      return "Invalid email or password. Please try again.";
    }
  } else {
    // No DB record yet → first-time login, verify against env credentials
    const raw = process.env.USER_CREDENTIALS;
    if (!raw) {
      return "Server configuration error: no credentials defined.";
    }

    let envUsers: EnvCredential[];
    try {
      envUsers = JSON.parse(raw) as EnvCredential[];
    } catch {
      return "Server configuration error: invalid credentials format.";
    }

    const match = envUsers.find(
      (u) => u.email === email && u.password === password
    );

    if (!match) {
      return "Invalid email or password. Please try again.";
    }
  }

  // Set a server-only HttpOnly session cookie so the home page knows who is logged in
  const cookieStore = await cookies();
  cookieStore.set("mr_email", email, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  // redirect() throws internally — must be called outside try/catch
  redirect("/home");
}

export async function logoutAction(): Promise<never> {
  const cookieStore = await cookies();
  cookieStore.delete("mr_email");
  redirect("/");
}

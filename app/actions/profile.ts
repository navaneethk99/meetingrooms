"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { pbkdf2Sync, randomBytes } from "crypto";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export interface ProfileState {
  errors?: {
    username?: string;
    password?: string;
    confirmPassword?: string;
  };
  message?: string;
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString(
    "hex"
  );
  return `${salt}:${hash}`;
}

export async function setupProfile(
  _prevState: ProfileState | null,
  formData: FormData
): Promise<ProfileState | null> {
  const cookieStore = await cookies();
  const email = cookieStore.get("mr_email")?.value;

  if (!email) {
    return { message: "Session expired. Please sign in again." };
  }

  const username = (formData.get("username") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";
  const confirmPassword =
    (formData.get("confirmPassword") as string | null) ?? "";

  const errors: ProfileState["errors"] = {};

  if (!username || username.length < 3) {
    errors.username = "Username must be at least 3 characters.";
  } else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    errors.username =
      "Username can only contain letters, numbers, and underscores.";
  }

  if (!password || password.length < 8) {
    errors.password = "Password must be at least 8 characters.";
  } else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = "Password must contain at least one letter and one number.";
  }

  if (password !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const passwordHash = hashPassword(password);

  // Upsert: insert a new row or update the existing one for this email
  await db
    .insert(users)
    .values({ email, username, passwordHash })
    .onConflictDoUpdate({
      target: users.email,
      set: { username, passwordHash },
    });

  // Redirect triggers a fresh server render of /home — DB now has a row so no popup
  redirect("/home");
}

/** Called by the home page Server Component to check if this is a first-time login */
export async function getProfileStatus(email: string): Promise<boolean> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return rows.length === 0; // true = first login
}

/** Check if the user is an admin */
export async function checkAdminStatus(email: string): Promise<boolean> {
  const rows = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return rows.length > 0 ? rows[0].isAdmin : false;
}


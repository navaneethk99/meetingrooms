"use server";

import { redirect } from "next/navigation";

interface Credential {
  email: string;
  password: string;
}

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  // Parse credentials from env (server-only — no NEXT_PUBLIC_ prefix)
  const raw = process.env.USER_CREDENTIALS;
  if (!raw) {
    return "Server configuration error: no credentials defined.";
  }

  let users: Credential[];
  try {
    users = JSON.parse(raw) as Credential[];
  } catch {
    return "Server configuration error: invalid credentials format.";
  }

  const match = users.find(
    (u) => u.email === email && u.password === password
  );

  if (!match) {
    return "Invalid email or password. Please try again.";
  }

  // redirect() throws internally — must be called outside try/catch
  redirect("/home");
}

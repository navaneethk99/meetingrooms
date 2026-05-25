import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getProfileStatus } from "@/app/actions/profile";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "Home — MeetingRooms",
  description: "Manage and book DMRC meeting rooms.",
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const email = cookieStore.get("mr_email")?.value;

  // If no session cookie, bounce back to login
  if (!email) {
    redirect("/");
  }

  const isFirstLogin = await getProfileStatus(email);

  return <HomeClient isFirstLogin={isFirstLogin} email={email} />;
}

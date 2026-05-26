"use server";

import { AccessToken } from "livekit-server-sdk";
import { cookies } from "next/headers";

/** Generates a JWT join token for a LiveKit room using the current authenticated user's email */
export async function getParticipantToken(room: string): Promise<string | null> {
  const cookieStore = await cookies();
  const email = cookieStore.get("mr_email")?.value || `Guest_${Math.floor(Math.random() * 1000)}`;

  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;

  if (!apiKey || !apiSecret) {
    // If not configured, return null to trigger demo fallback gracefully
    return null;
  }

  try {
    const at = new AccessToken(apiKey, apiSecret, { identity: email });
    
    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
    });

    return await at.toJwt();
  } catch (error) {
    console.error("Error generating LiveKit token:", error);
    return null;
  }
}

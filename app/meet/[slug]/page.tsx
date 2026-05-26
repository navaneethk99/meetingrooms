import { db } from "@/db";
import { bookings, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import MeetClient from "./MeetClient";
import { getParticipantToken } from "@/app/actions/livekit";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function MeetPage({ params }: PageProps) {
  const { slug } = await params;
  console.log("MeetPage hit with slug:", slug);

  let booking = null;
  let hostUsername: string | null = null;

  // 1. Try to look up by slug
  const rowsBySlug = await db
    .select({
      booking: bookings,
      username: users.username,
    })
    .from(bookings)
    .leftJoin(users, eq(bookings.bookedBy, users.email))
    .where(eq(bookings.slug, slug))
    .limit(1);

  if (rowsBySlug.length > 0) {
    booking = rowsBySlug[0].booking;
    hostUsername = rowsBySlug[0].username;
  } else {
    // 2. Fallback: try looking up by ID if slug is a number
    const bookingId = parseInt(slug, 10);
    if (!isNaN(bookingId)) {
      const rowsById = await db
        .select({
          booking: bookings,
          username: users.username,
        })
        .from(bookings)
        .leftJoin(users, eq(bookings.bookedBy, users.email))
        .where(eq(bookings.id, bookingId))
        .limit(1);
      if (rowsById.length > 0) {
        booking = rowsById[0].booking;
        hostUsername = rowsById[0].username;
      }
    }
  }

  if (!booking) {
    notFound();
  }

  // Only allow active meetings
  if (booking.status !== "active") {
    return (
      <div className="min-h-screen bg-white text-gray-800 flex items-center justify-center flex-col gap-4 px-4 font-sans">
        <div className="max-w-md w-full text-center bg-gray-50 border border-gray-200 rounded-2xl p-8 shadow-sm">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto mb-5 animate-bounce">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Meeting Cancelled</h1>
          <p className="text-gray-500 text-sm mb-6 leading-relaxed">
            This meeting has been cancelled. Please contact the host:{" "}
            <span className="font-semibold text-gray-700">{hostUsername || booking.bookedBy}</span>
          </p>
          <a
            href="/home"
            className="inline-block w-full py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-xl transition-all duration-200"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  // LiveKit room name can use the slug if it exists, or fallback to the ID
  const roomName = `room_${booking.slug || booking.id}`;
  const livekitToken = await getParticipantToken(roomName);
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || null;

  return (
    <MeetClient
      meetingId={booking.id}
      slug={booking.slug}
      title={booking.title}
      host={hostUsername || booking.bookedBy}
      startTime={booking.startTime.toISOString()}
      endTime={booking.endTime.toISOString()}
      livekitToken={livekitToken}
      livekitUrl={livekitUrl}
      password={booking.password}
    />
  );
}

import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import MeetClient from "./MeetClient";
import { getParticipantToken } from "@/app/actions/livekit";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function MeetPage({ params }: PageProps) {
  const { id } = await params;
  const bookingId = parseInt(id, 10);
  if (isNaN(bookingId)) {
    notFound();
  }

  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (rows.length === 0) {
    notFound();
  }

  const booking = rows[0];

  // Only allow active meetings
  if (booking.status !== "active") {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center flex-col gap-4 px-4 font-sans">
        <div className="max-w-md w-full text-center bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-xl">
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
          <h1 className="text-xl font-bold mb-2">Meeting Cancelled</h1>
          <p className="text-slate-400 text-sm mb-6 leading-relaxed">
            This meeting has been cancelled. Please contact the host:{" "}
            <span className="font-semibold text-slate-300">{booking.bookedBy}</span>
          </p>
          <a
            href="/home"
            className="inline-block w-full py-3 bg-slate-800 hover:bg-slate-700 text-white text-sm font-semibold rounded-xl transition-all duration-200"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  const roomName = `room_${booking.id}`;
  const livekitToken = await getParticipantToken(roomName);
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL || null;

  return (
    <MeetClient
      meetingId={booking.id}
      title={booking.title}
      host={booking.bookedBy}
      startTime={booking.startTime.toISOString()}
      endTime={booking.endTime.toISOString()}
      livekitToken={livekitToken}
      livekitUrl={livekitUrl}
    />
  );
}

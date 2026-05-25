"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { and, eq, lt, gt } from "drizzle-orm";

export interface CreateBookingState {
  errors?: {
    title?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    room?: string;
  };
  message?: string;
  success?: boolean;
}

export interface BookingResponse {
  id: number;
  room: string;
  title: string;
  startTime: string; // ISO string
  endTime: string; // ISO string
  bookedBy: string;
  status: string; // "active" or "cancelled"
}

/** Fetch bookings that overlap with the absolute start and end ISO timestamps */
export async function getBookings(startISO: string, endISO: string): Promise<BookingResponse[]> {
  const startLimit = new Date(startISO);
  const endLimit = new Date(endISO);

  const rows = await db
    .select()
    .from(bookings)
    .where(
      and(
        lt(bookings.startTime, endLimit),
        gt(bookings.endTime, startLimit)
      )
    )
    .orderBy(bookings.startTime);

  return rows.map((r) => ({
    id: r.id,
    room: r.room,
    title: r.title,
    startTime: r.startTime.toISOString(),
    endTime: r.endTime.toISOString(),
    bookedBy: r.bookedBy,
    status: r.status,
  }));
}

/** Create a new booking with conflict checking using absolute ISO timestamps */
export async function createBooking(
  _prevState: CreateBookingState | null,
  formData: FormData
): Promise<CreateBookingState> {
  const cookieStore = await cookies();
  const email = cookieStore.get("mr_email")?.value;
  if (!email) {
    return { message: "Session expired. Please sign in again." };
  }

  const title = (formData.get("title") as string | null)?.trim() ?? "";
  const room = (formData.get("room") as string | null) ?? "";
  const startTimeISO = (formData.get("startTime") as string | null) ?? "";
  const endTimeISO = (formData.get("endTime") as string | null) ?? "";

  const errors: CreateBookingState["errors"] = {};
  if (!title) {
    errors.title = "Meeting title is required.";
  }
  if (!room || !["Room 1", "Room 2", "Room 3"].includes(room)) {
    errors.room = "Please select a valid room.";
  }
  if (!startTimeISO) {
    errors.startTime = "Start time is required.";
  }
  if (!endTimeISO) {
    errors.endTime = "End time is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  const start = new Date(startTimeISO);
  const end = new Date(endTimeISO);

  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    return { message: "Invalid date or time values." };
  }

  if (start >= end) {
    return {
      errors: {
        startTime: "Start time must be before end time.",
      },
    };
  }

  // Check for conflicts: existing startTime < new.end AND existing endTime > new.start AND status = 'active'
  const conflicts = await db
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.room, room),
        eq(bookings.status, "active"),
        lt(bookings.startTime, end),
        gt(bookings.endTime, start)
      )
    )
    .limit(1);

  if (conflicts.length > 0) {
    const conflict = conflicts[0];
    const cStart = new Date(conflict.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const cEnd = new Date(conflict.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return {
      message: `Conflict! ${room} is already booked from ${cStart} to ${cEnd} for "${conflict.title}" (booked by ${conflict.bookedBy}).`,
    };
  }

  // Insert new booking
  await db.insert(bookings).values({
    room,
    title,
    startTime: start,
    endTime: end,
    bookedBy: email,
    status: "active",
  });

  revalidatePath("/home");
  return { success: true };
}

/** Cancel a booking by setting its status to 'cancelled' (only allowed for the creator) */
export async function cancelBooking(bookingId: number): Promise<{ success: boolean; message?: string }> {
  const cookieStore = await cookies();
  const email = cookieStore.get("mr_email")?.value;
  if (!email) {
    return { success: false, message: "Session expired. Please sign in again." };
  }

  // Find the booking
  const rows = await db
    .select()
    .from(bookings)
    .where(eq(bookings.id, bookingId))
    .limit(1);

  if (rows.length === 0) {
    return { success: false, message: "Booking not found." };
  }

  const booking = rows[0];

  // Verify ownership
  if (booking.bookedBy !== email) {
    return { success: false, message: "You are not authorized to cancel this booking." };
  }

  // Update status to 'cancelled'
  await db
    .update(bookings)
    .set({ status: "cancelled" })
    .where(eq(bookings.id, bookingId));

  revalidatePath("/home");
  return { success: true };
}

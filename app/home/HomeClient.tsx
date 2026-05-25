"use client";

import { useActionState, useState, useEffect, useTransition } from "react";
import { setupProfile, type ProfileState } from "@/app/actions/profile";
import { logoutAction } from "@/app/actions/auth";
import {
  getBookings,
  createBooking,
  cancelBooking,
  type BookingResponse,
  type CreateBookingState,
} from "@/app/actions/bookings";

interface Props {
  isFirstLogin: boolean;
  email: string;
}

export default function HomeClient({ isFirstLogin, email }: Props) {
  // First-login modal states
  const open = isFirstLogin;
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [state, formAction, isPending] = useActionState<
    ProfileState | null,
    FormData
  >(setupProfile, null);

  // Dashboard & Timeline states
  const [selectedDate, setSelectedDate] = useState(() => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const localDate = new Date(local.getTime() - offset * 60 * 1000);
    return localDate.toISOString().split("T")[0];
  });

  const [bookingsList, setBookingsList] = useState<BookingResponse[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [openBookingModal, setOpenBookingModal] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState("Room 1");
  const [isPendingLogout, startLogoutTransition] = useTransition();

  // Load Bookings for the selected date
  const loadBookingsForDate = async (dateStr: string) => {
    setLoadingBookings(true);
    try {
      const startOfDay = new Date(`${dateStr}T00:00:00`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999`);
      const data = await getBookings(startOfDay.toISOString(), endOfDay.toISOString());
      setBookingsList(data);
    } catch (err) {
      console.error("Failed to load bookings:", err);
    } finally {
      setLoadingBookings(false);
    }
  };

  // Booking Form Action State
  const [bookingState, bookingFormAction, isBookingPending] = useActionState<
    CreateBookingState | null,
    FormData
  >(async (prevState, formData) => {
    const title = formData.get("title") as string;
    const room = formData.get("room") as string;
    const dateVal = formData.get("dateInput") as string;
    const startVal = formData.get("startTimeInput") as string;
    const endVal = formData.get("endTimeInput") as string;

    const startLocal = new Date(`${dateVal}T${startVal}:00`);
    const endLocal = new Date(`${dateVal}T${endVal}:00`);

    const data = new FormData();
    data.set("title", title);
    data.set("room", room);
    data.set("startTime", startLocal.toISOString());
    data.set("endTime", endLocal.toISOString());

    const res = await createBooking(prevState, data);
    if (res.success) {
      await loadBookingsForDate(selectedDate);
      setOpenBookingModal(false);
      return null; // Clear state on success
    }
    return res;
  }, null);

  useEffect(() => {
    if (!open) {
      const timer = setTimeout(() => {
        loadBookingsForDate(selectedDate);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedDate, open]);

  // Current Time Line state
  const [currentTimeLeft, setCurrentTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    const calculateTimeLine = () => {
      const now = new Date();
      const viewedDate = new Date(`${selectedDate}T00:00:00`);
      
      // Only show current time indicator if viewed date matches local system date
      const isToday =
        now.getFullYear() === viewedDate.getFullYear() &&
        now.getMonth() === viewedDate.getMonth() &&
        now.getDate() === viewedDate.getDate();

      if (!isToday) {
        setCurrentTimeLeft(null);
        return;
      }

      const tStart = new Date(`${selectedDate}T08:00:00`);
      const tEnd = new Date(`${selectedDate}T20:00:00`);
      const totalMs = tEnd.getTime() - tStart.getTime();
      const currentMs = now.getTime() - tStart.getTime();

      if (currentMs >= 0 && currentMs <= totalMs) {
        setCurrentTimeLeft((currentMs / totalMs) * 100);
      } else {
        setCurrentTimeLeft(null);
      }
    };

    calculateTimeLine();
    const interval = setInterval(calculateTimeLine, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [selectedDate]);

  // Date Navigation Helpers
  const adjustDate = (amount: number) => {
    const current = new Date(`${selectedDate}T00:00:00`);
    current.setDate(current.getDate() + amount);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  const setToday = () => {
    const local = new Date();
    const offset = local.getTimezoneOffset();
    const localDate = new Date(local.getTime() - offset * 60 * 1000);
    setSelectedDate(localDate.toISOString().split("T")[0]);
  };

  const formatFriendlyDate = (dateStr: string) => {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  // Hour display values: 8 AM to 8 PM
  const HOURS = Array.from({ length: 13 }, (_, i) => 8 + i);
  const formatHourLabel = (h: number) => {
    const period = h >= 12 ? "PM" : "AM";
    const displayHour = h % 12 === 0 ? 12 : h % 12;
    return `${displayHour} ${period}`;
  };

  // Booking Card Render positioning helper
  const renderBookingCard = (b: BookingResponse, trackIndex: number, totalTracks: number) => {
    const tStart = new Date(`${selectedDate}T08:00:00`);
    const tEnd = new Date(`${selectedDate}T20:00:00`);
    const bStart = new Date(b.startTime);
    const bEnd = new Date(b.endTime);

    // Skip if it completely falls outside timeline business hours
    if (bEnd <= tStart || bStart >= tEnd) return null;

    const startDiff = bStart.getTime() - tStart.getTime();
    const duration = bEnd.getTime() - bStart.getTime();
    const totalDuration = 12 * 60 * 60 * 1000; // 12 hours

    let left = (startDiff / totalDuration) * 100;
    let width = (duration / totalDuration) * 100;

    // Clip left if it starts earlier than 8:00
    if (left < 0) {
      width += left;
      left = 0;
    }
    // Clip right if it ends after 20:00
    if (left + width > 100) {
      width = 100 - left;
    }

    // Dynamic style based on Room
    let themeClasses = "";
    if (b.status === "cancelled") {
      themeClasses = "from-gray-150 to-gray-200 text-gray-400 border-gray-300 shadow-none hover:from-gray-150 hover:to-gray-200 cursor-not-allowed";
    } else if (b.room === "Room 1") {
      themeClasses = "from-blue-500/90 to-indigo-600/90 text-white border-blue-600/20 hover:from-blue-600 hover:to-indigo-700 shadow-md shadow-blue-500/10";
    } else if (b.room === "Room 2") {
      themeClasses = "from-emerald-500/90 to-teal-600/90 text-white border-emerald-600/20 hover:from-emerald-600 hover:to-teal-700 shadow-md shadow-emerald-500/10";
    } else {
      themeClasses = "from-purple-500/90 to-fuchsia-600/90 text-white border-purple-600/20 hover:from-purple-600 hover:to-fuchsia-700 shadow-md shadow-purple-500/10";
    }

    const startStr = bStart.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const endStr = bEnd.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

    // Calculate vertical splitting positioning
    const heightPercent = 100 / totalTracks;
    const topPercent = trackIndex * heightPercent;

    return (
      <div
        key={b.id}
        className={`absolute rounded-xl bg-gradient-to-br px-3 py-1.5 flex flex-col justify-between border select-none overflow-hidden transition-all duration-200 group z-10 ${themeClasses}`}
        style={{
          left: `${left}%`,
          width: `${width}%`,
          minWidth: "40px",
          top: `calc(${topPercent}% + 4px)`,
          height: `calc(${heightPercent}% - 8px)`
        }}
        title={`${b.title}\nTime: ${startStr} - ${endStr}\nBooked by: ${b.bookedBy}${b.status === "cancelled" ? " (Cancelled)" : ""}`}
      >
        <div className="flex items-start justify-between gap-1 w-full">
          <div className={`truncate font-semibold text-xs leading-tight ${b.status === "cancelled" ? "line-through opacity-75" : ""}`}>
            {b.status === "cancelled" ? `[Cancelled] ${b.title}` : b.title}
          </div>
          {b.status === "active" && b.bookedBy === email && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                if (confirm(`Are you sure you want to cancel the booking "${b.title}"?`)) {
                  const res = await cancelBooking(b.id);
                  if (res.success) {
                    await loadBookingsForDate(selectedDate);
                  } else {
                    alert(res.message || "Failed to cancel booking.");
                  }
                }
              }}
              className="w-4 h-4 rounded hover:bg-black/10 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer flex-shrink-0"
              title="Cancel Booking"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center justify-between text-[10px] opacity-90 truncate gap-2 w-full">
          <span className={b.status === "cancelled" ? "line-through opacity-75" : ""}>{startStr} - {endStr}</span>
          <span className="opacity-75 hidden md:inline truncate">{b.bookedBy.split("@")[0]}</span>
        </div>
      </div>
    );
  };

  const inputBase =
    "field w-full px-3 py-2.5 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 placeholder:text-gray-400 transition-colors duration-150";

  return (
    <>
      {/* Header Bar */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-200/60 z-30 px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-sm shadow-blue-500/20">
            MR
          </div>
          <span className="font-semibold text-gray-900 tracking-tight">
            MeetingRooms
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-xs text-gray-400">Signed in as</span>
            <span className="text-xs font-semibold text-gray-700">{email}</span>
          </div>
          <button
            onClick={() => startLogoutTransition(() => logoutAction())}
            disabled={isPendingLogout}
            className="text-xs font-semibold text-gray-600 hover:text-red-600 px-3.5 py-1.5 rounded-lg hover:bg-red-50 border border-gray-200 hover:border-red-100 transition-all cursor-pointer"
          >
            {isPendingLogout ? "Signing out..." : "Sign out"}
          </button>
        </div>
      </header>

      {/* Main dashboard space */}
      <main className="min-h-screen pt-24 pb-16 px-4 bg-gray-50/50">
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          
          {/* Controls toolbar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-gray-200/60 shadow-sm">
            <div className="flex items-center gap-2">
              <button
                onClick={() => adjustDate(-1)}
                className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
                aria-label="Previous day"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              
              <button
                onClick={setToday}
                className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs font-semibold text-gray-700 transition-colors cursor-pointer"
              >
                Today
              </button>

              <button
                onClick={() => adjustDate(1)}
                className="w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 flex items-center justify-center text-gray-600 transition-colors cursor-pointer"
                aria-label="Next day"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>

              {/* Friendly Date Label */}
              <div className="ml-2 flex flex-col">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Selected Date</span>
                <span className="text-sm font-semibold text-gray-800 leading-tight">
                  {formatFriendlyDate(selectedDate)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Native Date Picker trigger */}
              <div className="relative">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="px-3.5 py-2.5 rounded-xl border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors focus:outline-none focus:border-blue-500 cursor-pointer"
                />
              </div>

              {/* Book Room Button */}
              <button
                id="book-room-btn"
                onClick={() => setOpenBookingModal(true)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold shadow-sm shadow-blue-500/10 hover:shadow-md transition-all duration-200 flex items-center gap-2 cursor-pointer"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Book Meeting Room
              </button>
            </div>
          </div>

          {/* Timeline View */}
          {/* Timeline View */}
          <div className="bg-white rounded-2xl border border-gray-200/60 shadow-sm overflow-hidden flex">
            
            {/* Left Fixed Column: Rooms Info */}
            <div className="w-48 flex-shrink-0 border-r border-gray-100 flex flex-col divide-y divide-gray-100 bg-white z-20">
              {/* Header Cell */}
              <div className="h-12 p-4 flex items-center bg-gray-50/50">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Rooms</span>
              </div>
              
              {/* Room cells */}
              {["Room 1", "Room 2", "Room 3"].map((room) => {
                let roomDesc = "";
                let roomTheme = "";
                if (room === "Room 1") {
                  roomDesc = "8 Seats · TV & VC";
                  roomTheme = "bg-blue-50 border-blue-100 text-blue-700";
                } else if (room === "Room 2") {
                  roomDesc = "12 Seats · Board";
                  roomTheme = "bg-emerald-50 border-emerald-100 text-emerald-700";
                } else {
                  roomDesc = "16 Seats · Projector";
                  roomTheme = "bg-purple-50 border-purple-100 text-purple-700";
                }
                return (
                  <div key={room} className="h-24 p-4 flex flex-col justify-center bg-white">
                    <span className={`self-start text-xs font-semibold px-2 py-0.5 rounded-full border ${roomTheme} mb-1`}>
                      {room}
                    </span>
                    <span className="text-[10px] text-gray-400 font-medium truncate">
                      {roomDesc}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Right Horizontally Scrollable Column: Timeline Grid */}
            <div className="flex-1 overflow-x-auto">
              <div className="min-w-[1000px] flex flex-col divide-y divide-gray-100">
                
                {/* Timeline hour labels header */}
                <div className="h-12 relative bg-gray-50/50">
                  {/* Horizontal hours labels */}
                  {HOURS.map((h, i) => {
                    const left = (i / 12) * 100;
                    return (
                      <div
                        key={h}
                        className="absolute top-0 bottom-0 text-[10px] font-semibold text-gray-400 flex items-center justify-center transform -translate-x-1/2"
                        style={{ left: `${left}%` }}
                      >
                        <span className="bg-white px-1.5 py-0.5 rounded shadow-sm border border-gray-100">{formatHourLabel(h)}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Room schedules rows */}
                {["Room 1", "Room 2", "Room 3"].map((room) => {
                  const roomBookings = bookingsList.filter((b) => b.room === room);

                  // Run track layout algorithm
                  const sortedBookings = [...roomBookings].sort(
                    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
                  );

                  const tracks: BookingResponse[][] = [];
                  const bookingTracks = new Map<number, { trackIndex: number; totalTracks: number }>();

                  for (const b of sortedBookings) {
                    const bStart = new Date(b.startTime).getTime();
                    let assignedTrack = -1;
                    for (let t = 0; t < tracks.length; t++) {
                      const lastInTrack = tracks[t][tracks[t].length - 1];
                      const lastEnd = new Date(lastInTrack.endTime).getTime();
                      if (bStart >= lastEnd) {
                        assignedTrack = t;
                        break;
                      }
                    }
                    if (assignedTrack === -1) {
                      assignedTrack = tracks.length;
                      tracks.push([b]);
                    } else {
                      tracks[assignedTrack].push(b);
                    }
                    bookingTracks.set(b.id, { trackIndex: assignedTrack, totalTracks: 1 });
                  }

                  const totalTracksCount = Math.max(1, tracks.length);
                  for (const b of roomBookings) {
                    const info = bookingTracks.get(b.id);
                    if (info) {
                      info.totalTracks = totalTracksCount;
                    }
                  }

                  return (
                    <div key={room} className="h-24 relative bg-gray-50/10 group">
                      
                      {/* Vertical background gridlines */}
                      {HOURS.map((_, i) => {
                        const left = (i / 12) * 100;
                        return (
                          <div
                            key={i}
                            className="absolute top-0 bottom-0 border-l border-dashed border-gray-200/60 pointer-events-none"
                            style={{ left: `${left}%` }}
                          />
                        );
                      })}

                      {/* Current time line marker if active */}
                      {currentTimeLeft !== null && (
                        <div
                          className="absolute top-0 bottom-0 w-[2px] bg-red-500 z-20 pointer-events-none"
                          style={{ left: `${currentTimeLeft}%` }}
                        >
                          <div className="absolute -top-1 -left-[4px] w-2.5 h-2.5 rounded-full bg-red-500 shadow-md ring-2 ring-white" />
                        </div>
                      )}

                      {/* Render absolute booking blocks */}
                      {loadingBookings ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/40 backdrop-blur-[1px] z-10">
                          <svg className="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                        </div>
                      ) : roomBookings.length > 0 ? (
                        roomBookings.map((b) => {
                          const info = bookingTracks.get(b.id) || { trackIndex: 0, totalTracks: 1 };
                          return renderBookingCard(b, info.trackIndex, info.totalTracks);
                        })
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest">Available</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Book Meeting Room Modal Popup */}
      {openBookingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 backdrop-blur-md"
          style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-title"
        >
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200/80 shadow-xl px-8 py-7 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between mb-5">
              <h2 id="booking-title" className="text-xl font-semibold text-gray-900 tracking-tight">
                Book a Meeting Room
              </h2>
              <button
                onClick={() => setOpenBookingModal(false)}
                className="w-8 h-8 rounded-lg border border-gray-100 hover:bg-gray-50 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                aria-label="Close modal"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal Body error summary */}
            {bookingState?.message && (
              <div
                role="alert"
                className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs font-medium text-red-700"
              >
                {bookingState.message}
              </div>
            )}

            {/* Booking Form */}
            <form
              className="flex flex-col gap-4"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = new FormData(form);
                data.set("room", selectedRoom); // Bind currently chosen card room
                bookingFormAction(data);
              }}
              noValidate
            >
              {/* Meeting Title */}
              <div className="flex flex-col gap-1">
                <label htmlFor="booking-title-input" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Meeting Title
                </label>
                <input
                  id="booking-title-input"
                  name="title"
                  type="text"
                  className={inputBase}
                  placeholder="e.g. Daily Standup, Project Kickoff"
                  autoFocus
                  aria-invalid={!!bookingState?.errors?.title}
                  aria-describedby={bookingState?.errors?.title ? "title-err" : undefined}
                />
                {bookingState?.errors?.title && (
                  <p id="title-err" role="alert" className="text-xs text-red-600 mt-0.5">
                    {bookingState.errors.title}
                  </p>
                )}
              </div>

              {/* Room Card Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Select Room
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: "Room 1", capacity: "8 Seats", color: "border-blue-200 hover:border-blue-500 active:bg-blue-50/50", selectedBg: "bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/10 text-blue-900" },
                    { id: "Room 2", capacity: "12 Seats", color: "border-emerald-200 hover:border-emerald-500 active:bg-emerald-50/50", selectedBg: "bg-emerald-50/80 border-emerald-500 ring-2 ring-emerald-500/10 text-emerald-900" },
                    { id: "Room 3", capacity: "16 Seats", color: "border-purple-200 hover:border-purple-500 active:bg-purple-50/50", selectedBg: "bg-purple-50/80 border-purple-500 ring-2 ring-purple-500/10 text-purple-900" }
                  ].map((rm) => {
                    const isSelected = selectedRoom === rm.id;
                    return (
                      <button
                        key={rm.id}
                        type="button"
                        onClick={() => setSelectedRoom(rm.id)}
                        className={`border rounded-xl p-3 text-left flex flex-col justify-between cursor-pointer transition-all duration-150 ${isSelected ? rm.selectedBg : "border-gray-200 hover:border-gray-300"}`}
                      >
                        <span className="text-xs font-bold">{rm.id}</span>
                        <span className="text-[10px] text-gray-400 font-medium">{rm.capacity}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date Selection */}
              <div className="flex flex-col gap-1">
                <label htmlFor="booking-date" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Date
                </label>
                <input
                  id="booking-date"
                  name="dateInput"
                  type="date"
                  defaultValue={selectedDate}
                  className={inputBase}
                  aria-invalid={!!bookingState?.errors?.date}
                />
              </div>

              {/* Time Range grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Start Time */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="booking-start" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Start Time
                  </label>
                  <input
                    id="booking-start"
                    name="startTimeInput"
                    type="time"
                    min="08:00"
                    max="19:59"
                    className={inputBase}
                    aria-invalid={!!bookingState?.errors?.startTime}
                    aria-describedby={bookingState?.errors?.startTime ? "start-err" : undefined}
                  />
                  {bookingState?.errors?.startTime && (
                    <p id="start-err" role="alert" className="text-xs text-red-600 mt-0.5">
                      {bookingState.errors.startTime}
                    </p>
                  )}
                </div>

                {/* End Time */}
                <div className="flex flex-col gap-1">
                  <label htmlFor="booking-end" className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    End Time
                  </label>
                  <input
                    id="booking-end"
                    name="endTimeInput"
                    type="time"
                    min="08:01"
                    max="20:00"
                    className={inputBase}
                    aria-invalid={!!bookingState?.errors?.endTime}
                    aria-describedby={bookingState?.errors?.endTime ? "end-err" : undefined}
                  />
                  {bookingState?.errors?.endTime && (
                    <p id="end-err" role="alert" className="text-xs text-red-600 mt-0.5">
                      {bookingState.errors.endTime}
                    </p>
                  )}
                </div>
              </div>

              {/* Form Actions (Buttons) */}
              <div className="flex items-center gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setOpenBookingModal(false)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 text-sm font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isBookingPending}
                  className="flex-grow py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-sm font-semibold transition-all shadow-sm shadow-blue-500/10 hover:shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  {isBookingPending ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Booking...
                    </>
                  ) : (
                    "Confirm Booking"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* First-login modal overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: "rgba(0,0,0,0.3)" }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="setup-title"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-sm px-8 py-8">
            <div className="text-center mb-6">
              <h2
                id="setup-title"
                className="text-2xl font-semibold text-gray-900 tracking-tight"
              >
                Set up your profile
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Choose a username and set a new password.
              </p>
            </div>

            {state?.message && (
              <div
                role="alert"
                className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
              >
                {state.message}
              </div>
            )}

            <form className="flex flex-col gap-5" action={formAction} noValidate>
              {/* Username */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="setup-username"
                  className="text-sm font-medium text-gray-700"
                >
                  Username
                </label>
                <input
                  id="setup-username"
                  name="username"
                  type="text"
                  className={inputBase}
                  placeholder="e.g. alice_dmrc"
                  autoComplete="username"
                  autoFocus
                  aria-describedby={
                    state?.errors?.username ? "username-err" : undefined
                  }
                  aria-invalid={!!state?.errors?.username}
                />
                {state?.errors?.username && (
                  <p
                    id="username-err"
                    role="alert"
                    className="text-xs text-red-600 mt-0.5"
                  >
                    {state.errors.username}
                  </p>
                )}
              </div>

              {/* New Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="setup-password"
                  className="text-sm font-medium text-gray-700"
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="setup-password"
                    name="password"
                    type={showPass ? "text" : "password"}
                    className={`${inputBase} pr-10`}
                    placeholder="Min 8 chars, letter + number"
                    autoComplete="new-password"
                    aria-describedby={
                      state?.errors?.password ? "password-err" : undefined
                    }
                    aria-invalid={!!state?.errors?.password}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPass ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {state?.errors?.password && (
                  <p
                    id="password-err"
                    role="alert"
                    className="text-xs text-red-600 mt-0.5"
                  >
                    {state.errors.password}
                  </p>
                )}
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="setup-confirm"
                  className="text-sm font-medium text-gray-700"
                >
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="setup-confirm"
                    name="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    className={`${inputBase} pr-10`}
                    placeholder="Re-enter your password"
                    autoComplete="new-password"
                    aria-describedby={
                      state?.errors?.confirmPassword ? "confirm-err" : undefined
                    }
                    aria-invalid={!!state?.errors?.confirmPassword}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirm ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
                {state?.errors?.confirmPassword && (
                  <p
                    id="confirm-err"
                    role="alert"
                    className="text-xs text-red-600 mt-0.5"
                  >
                    {state.errors.confirmPassword}
                  </p>
                )}
              </div>

              {/* Submit */}
              <div className="flex w-full justify-center items-center">
                <button
                  id="setup-submit"
                  type="submit"
                  disabled={isPending}
                  aria-busy={isPending}
                  className="w-[60%] py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold
                           hover:bg-blue-700 active:bg-blue-800
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-colors duration-150 cursor-pointer"
                >
                  {isPending ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg
                        aria-hidden="true"
                        className="w-4 h-4 animate-spin"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"
                        />
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    "Save & continue"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

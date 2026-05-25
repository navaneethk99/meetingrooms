import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Home — MeetingRooms",
  description: "Manage and book DMRC meeting rooms.",
};

export default function HomePage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Welcome to MeetingRooms 👋
        </h1>
        <p className="text-gray-500 text-sm">
          You have successfully signed in.
        </p>
      </div>
    </main>
  );
}

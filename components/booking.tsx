// components/Booking.tsx
"use client";
import { useState } from "react";

type Props = {
  username: string;
  slug: string;
};

export default function Booking({ username, slug }: Props) {
  const [inviteeEmail, setInviteeEmail] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type_id: slug, // you might need to map slug → event_type_id server-side
          invitee_email: inviteeEmail,
          start_time: startTime,
          end_time: endTime,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Booking failed");

      setSuccess("Booking confirmed! Check your email.");
      setInviteeEmail("");
      setStartTime("");
      setEndTime("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold mb-4">
        Book with {username} – {slug}
      </h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm">Your Email</span>
          <input
            type="email"
            className="w-full border rounded p-2"
            value={inviteeEmail}
            onChange={(e) => setInviteeEmail(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm">Start Time</span>
          <input
            type="datetime-local"
            className="w-full border rounded p-2"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
        </label>
        <label className="block">
          <span className="text-sm">End Time</span>
          <input
            type="datetime-local"
            className="w-full border rounded p-2"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            required
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white rounded py-2 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Booking..." : "Book Now"}
        </button>
      </form>

      {success && <p className="mt-4 text-green-600">{success}</p>}
      {error && <p className="mt-4 text-red-600">{error}</p>}
    </main>
  );
}

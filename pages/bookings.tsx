"use client"
import { useState, useEffect } from "react"
import Layout from "../components/Layout"
import { useSession } from "next-auth/react"

export default function Bookings() {
  const { data: session } = useSession()

  const [bookings, setBookings] = useState<any[]>([])
  const [editing, setEditing] = useState<string | null>(null)
  const [newDate, setNewDate] = useState("")
  const [newTime, setNewTime] = useState("09:00")

  useEffect(() => {
    fetch("/api/bookings")
      .then(res => res.json())
      .then(({ bookings }) => setBookings(bookings || []))
  }, [])

  async function cancelBooking(id: string) {
    await fetch("/api/bookings", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, access_token: session?.accessToken })
    })
    setBookings(bookings.filter(b => b.id !== id))
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Your Bookings</h1>
        {bookings.length === 0 && (
          <p className="text-gray-600">No bookings yet.</p>
        )}
        <ul className="space-y-3">
          {bookings.map(b => (
            <li key={b.id} className="border rounded-lg p-3 bg-white shadow">
              {editing === b.id ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const start = new Date(`${newDate}T${newTime}:00Z`)
                    const end = new Date(start.getTime() + 30 * 60000)
                    const res = await fetch("/api/bookings", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        id: b.id,
                        start_time: start.toISOString(),
                        end_time: end.toISOString(),
                        access_token: session?.accessToken
                      })
                    })
                    if (res.ok) {
                      const { booking } = await res.json()
                      setBookings(bookings.map(x => (x.id === b.id ? booking : x)))
                      setEditing(null)
                    }
                  }}
                  className="space-y-2"
                >
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    className="border rounded px-2 py-1 w-full"
                  />
                  <input
                    type="time"
                    required
                    value={newTime}
                    onChange={e => setNewTime(e.target.value)}
                    className="border rounded px-2 py-1 w-full"
                  />
                  <div className="flex gap-2">
                    <button className="bg-green-600 text-white px-3 py-1 rounded">Save</button>
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="px-3 py-1 border rounded"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{b.invitee_email}</p>
                    <p className="text-sm text-gray-600">
                      {new Date(b.start_time).toLocaleString()} →{" "}
                      {new Date(b.end_time).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditing(b.id)}
                      className="bg-yellow-500 text-white px-2 py-1 rounded text-sm"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => cancelBooking(b.id)}
                      className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  )
}

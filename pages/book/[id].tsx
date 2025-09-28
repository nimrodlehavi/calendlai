"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/router"
import { useSession } from "next-auth/react"
import Layout from "../../components/Layout"

export default function BookEvent() {
  const router = useRouter()
  const { id } = router.query
  const { data: session } = useSession()

  const [eventType, setEventType] = useState<any>(null)
  const [email, setEmail] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("09:00")
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    if (id) {
      fetch(`/api/event-types?id=${id}`)
        .then(res => res.json())
        .then(data => {
          if (data.eventTypes) setEventType(data.eventTypes[0])
        })
    }
  }, [id])

  async function book(e: React.FormEvent) {
    e.preventDefault()
    const duration = eventType?.duration_minutes || 30
    const start = new Date(`${date}T${time}:00Z`)
    const end = new Date(start.getTime() + duration * 60000)

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type_id: id,
        invitee_email: email,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        access_token: session?.accessToken || null
      })
    })
    if (res.ok) setSuccess(true)
  }

  if (success) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Booking Confirmed ✅</h1>
          <p>We’ve sent you an email with details.</p>
          <p className="mt-4">
            Need to reschedule?{" "}
            <a href="/bookings" className="text-blue-600 underline">
              Go to your bookings
            </a>
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="bg-white shadow rounded-lg p-6 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4 text-center">
          {eventType ? eventType.name : "Loading..."}
        </h1>
        <form onSubmit={book} className="space-y-4">
          <input
            type="email"
            required
            placeholder="Your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <input
            type="date"
            required
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <input
            type="time"
            required
            value={time}
            onChange={e => setTime(e.target.value)}
            className="w-full border rounded px-3 py-2"
          />
          <button className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">
            Book {eventType ? `${eventType.duration_minutes} min` : ""}
          </button>
        </form>
      </div>
    </Layout>
  )
}

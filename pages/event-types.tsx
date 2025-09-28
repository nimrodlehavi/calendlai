"use client"
import { useState, useEffect } from "react"
import Layout from "../components/Layout"

export default function EventTypes() {
  const [eventTypes, setEventTypes] = useState<any[]>([])
  const [form, setForm] = useState({ name: "", duration_minutes: 30 })
  const [editing, setEditing] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  const [editDuration, setEditDuration] = useState(30)

  useEffect(() => {
    fetch("/api/event-types")
      .then(res => res.json())
      .then(({ eventTypes }) => setEventTypes(eventTypes || []))
  }, [])

  async function createEventType(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch("/api/event-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form)
    })
    const { eventTypes: newEventTypes } = await res.json()
    setEventTypes([...eventTypes, ...newEventTypes])
    setForm({ name: "", duration_minutes: 30 })
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Your Event Types</h1>
        <form onSubmit={createEventType} className="mb-6 flex gap-2">
          <input
            type="text"
            placeholder="Event name"
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="border rounded px-2 py-1 flex-1"
          />
          <input
            type="number"
            value={form.duration_minutes}
            onChange={e => setForm({ ...form, duration_minutes: +e.target.value })}
            className="border rounded px-2 py-1 w-24"
          />
          <button className="bg-blue-600 text-white px-3 py-1 rounded">Add</button>
        </form>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {eventTypes.map(et => (
            <li key={et.id} className="bg-white shadow rounded-lg p-4 border hover:shadow-md transition">
              {editing === et.id ? (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault()
                    const res = await fetch("/api/event-types", {
                      method: "PUT",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ id: et.id, name: editName, duration_minutes: editDuration })
                    })
                    if (res.ok) {
                      const { eventType } = await res.json()
                      setEventTypes(eventTypes.map(x => (x.id === et.id ? eventType : x)))
                      setEditing(null)
                    }
                  }}
                  className="space-y-2"
                >
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="border rounded px-2 py-1 w-full"
                  />
                  <input
                    type="number"
                    value={editDuration}
                    onChange={e => setEditDuration(+e.target.value)}
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
                <div>
                  <h2 className="font-semibold text-lg mb-2">{et.name}</h2>
                  <p className="text-gray-600 text-sm mb-4">{et.duration_minutes} min meeting</p>
                  <div className="flex gap-2">
                    <a
                      className="text-white bg-blue-600 px-3 py-1 rounded text-sm"
                      href={`/book/${et.id}`}
                    >
                      Share
                    </a>
                    <button
                      onClick={() => {
                        setEditing(et.id)
                        setEditName(et.name)
                        setEditDuration(et.duration_minutes)
                      }}
                      className="bg-yellow-500 text-white px-2 py-1 rounded text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async () => {
                        await fetch("/api/event-types", {
                          method: "DELETE",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ id: et.id })
                        })
                        setEventTypes(eventTypes.filter(x => x.id !== et.id))
                      }}
                      className="bg-red-500 text-white px-2 py-1 rounded text-sm"
                    >
                      Delete
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

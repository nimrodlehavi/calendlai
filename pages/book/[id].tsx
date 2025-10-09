"use client"
import { useState, useEffect, useMemo, type ReactElement } from "react"
import { useRouter } from "next/router"
import Layout from "../../components/Layout"
import { Toast } from "../../components/Toast"

type InitialEvent = {
  name: string
  duration_minutes: number
  description?: string | null
}

type BookEventProps = {
  eventTypeId?: string
  hostUsername?: string
  embedded?: boolean
  initialEventType?: InitialEvent | null
}

export default function BookEvent({ eventTypeId, hostUsername, embedded = false, initialEventType = null }: BookEventProps) {
  const router = useRouter()
  const routeId = router.query?.id
  const effectiveId = typeof eventTypeId === 'string' ? eventTypeId : (typeof routeId === 'string' ? routeId : undefined)

  const [eventType, setEventType] = useState<any>(initialEventType)
  const [inviteeEmail, setInviteeEmail] = useState("")
  const [emailLocked, setEmailLocked] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [inviteeName, setInviteeName] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<{ start: string; host_user_ids: string[] }[]>([])
  const [month, setMonth] = useState<string>("")
  const [availableDays, setAvailableDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState<string>("")
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string|null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error'|'info' } | null>(null)
  const [timeZone, setTimeZone] = useState<string>(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')

  useEffect(() => {
    if (initialEventType) {
      setEventType(initialEventType)
    }
  }, [initialEventType])

  useEffect(() => {
    if (!effectiveId) return
    fetch(`/api/event-types?id=${effectiveId}`)
      .then(res => res.json())
      .then(data => {
        if (data.eventType) setEventType(data.eventType)
      })
  }, [effectiveId])

  useEffect(() => {
    const inviteeParam = router.query?.invitee as string | undefined
    const tokenParam = router.query?.invitee_token as string | undefined

    async function resolveToken(token: string) {
      setTokenError(null)
      try {
        const res = await fetch(`/api/public/invite-token?token=${encodeURIComponent(token)}`)
        const json = await res.json()
        if (!res.ok || !json.email) {
          throw new Error(json.error || 'Invalid invite token')
        }
        setInviteeEmail(json.email)
        setEmailLocked(true)
      } catch (err: any) {
        setTokenError(err.message || String(err))
        setEmailLocked(false)
      }
    }

    if (tokenParam) {
      resolveToken(tokenParam)
    } else if (inviteeParam) {
      setInviteeEmail(inviteeParam)
      setEmailLocked(true)
    }
  }, [router.query?.invitee, router.query?.invitee_token])

  useEffect(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    setMonth(`${y}-${m}`)
  }, [])

  useEffect(() => {
    if (!effectiveId || !month) return
    setAvailableDays([])
    setDate("")
    setSlots([])
    fetch(`/api/available-days?event_type_id=${encodeURIComponent(String(effectiveId))}&month=${encodeURIComponent(month)}`)
      .then(r => r.json())
      .then(d => setAvailableDays(d.days || []))
      .catch(() => setAvailableDays([]))
  }, [effectiveId, month])

  useEffect(() => {
    if (!effectiveId || !date) {
      setSlots([])
      setStartTime("")
      setSelectedHostId(null)
      return
    }
    fetch(`/api/slots?event_type_id=${encodeURIComponent(String(effectiveId))}&date=${encodeURIComponent(date)}`)
      .then(r => r.json())
      .then(d => {
        const parsed = Array.isArray(d.slots)
          ? d.slots.map((slot: any) => ({ start: slot.start, host_user_ids: Array.isArray(slot.host_user_ids) ? slot.host_user_ids : [] }))
          : []
        setSlots(parsed)
        setStartTime("")
        setSelectedHostId(null)
      })
      .catch(() => {
        setSlots([])
        setStartTime("")
        setSelectedHostId(null)
      })
  }, [effectiveId, date])

  async function book(e: React.FormEvent) {
    e.preventDefault()
    setErrorMsg(null)
    if (!startTime) {
      setErrorMsg('Please select a time')
      return
    }
    const emailValue = inviteeEmail.trim()
    if (!emailValue) {
      setErrorMsg('Please enter your email address.')
      return
    }
    setSubmitting(true)
    const duration = eventType?.duration_minutes || 30
    const start = new Date(startTime)
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type_id: effectiveId,
          invitee_email: emailValue,
          invitee_name: inviteeName.trim() || null,
          notes: notes.trim() || null,
          start_time: start.toISOString(),
          host_user_id: selectedHostId,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error?.message || j.error || 'Booking failed')
      setSuccess(true)
      setToast({ msg: 'Booking confirmed', type: 'success' })
      setSelectedHostId(null)
    } catch (err: any) {
      const msg = String(err.message || err)
      setErrorMsg(msg)
      setToast({ msg, type: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const calendar = useMemo(() => buildMonthGrid(month), [month])
  const todayYMD = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  const containerClass = embedded
    ? 'glass-panel mx-auto max-w-3xl p-6 text-slate-100'
    : 'glass-panel max-w-4xl mx-auto p-8 text-slate-100'

  const successContainerClass = embedded
    ? 'glass-panel mx-auto max-w-md space-y-4 px-6 py-10 text-center text-slate-100'
    : 'glass-panel max-w-md mx-auto space-y-4 px-6 py-10 text-center text-slate-100'

  if (success) {
    const summary = `${eventType?.name || 'CalendlAI Meeting'} with ${(inviteeName || inviteeEmail || 'You')}`
    const description = `Meeting with ${inviteeName || inviteeEmail || 'You'}${notes ? `\n\nBackground:\n${notes}` : ''}`
    const successContent = (
      <div className={successContainerClass}>
        <div className="flex justify-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-midnight-500/40 text-2xl">✅</span>
        </div>
        <h1 className="text-2xl font-semibold text-slate-50">Booking confirmed</h1>
        <p className="text-sm text-slate-300">We’ve emailed the details and added the meeting to your host’s calendar.</p>
        {startTime && (
          <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm">
            <div className="font-medium text-slate-100">{new Date(startTime).toLocaleString([], { timeZone })}</div>
            <div className="text-xs text-slate-300">{eventType?.duration_minutes || 30} minutes • {timeZone}</div>
          </div>
        )}
        {startTime && (
          <div className="grid gap-2 text-sm">
            <a
              href={googleEventUrl(summary, description, startTime, eventType?.duration_minutes || 30)}
              target="_blank"
              rel="noreferrer"
              className="btn-primary justify-center px-4"
            >
              Add to Google Calendar
            </a>
            <a
              href={icsDataUrl(summary, description, startTime, eventType?.duration_minutes || 30)}
              download="invite.ics"
              className="btn-secondary justify-center px-4"
            >
              Download .ics
            </a>
          </div>
        )}
        <p className="text-xs text-slate-300">
          Need to reschedule? <a href="/bookings" className="text-midnight-200 underline">Go to your bookings</a>
        </p>
        {toast && <Toast message={toast.msg} type={toast.type} />}
      </div>
    );

    return embedded ? successContent : <Layout>{successContent}</Layout>;
  }

  const formContent = (
    <div className={containerClass}>
        <header className="text-center space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-slate-400">Book a meeting</p>
          <h1 className="text-3xl font-semibold text-slate-50">{eventType ? eventType.name : 'Loading…'}</h1>
          <p className="text-sm text-slate-300">Pick a time, share context, and CalendlAI will keep everyone in sync.</p>
        </header>

        <form onSubmit={book} className="mt-6 space-y-6">
          <section className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <label className="text-sm font-medium text-slate-200">Your name (optional)</label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={inviteeName}
                onChange={e => setInviteeName(e.target.value)}
                className="input-field"
              />
            </div>
            {emailLocked ? (
              <div className="rounded-2xl border border-accent-teal/30 bg-accent-teal/12 px-4 py-3 text-sm text-accent-teal">
                Invitation sent to <span className="font-semibold">{inviteeEmail}</span>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-sm font-medium text-slate-200">Your email</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={inviteeEmail}
                  onChange={e => setInviteeEmail(e.target.value)}
                  className="input-field"
                />
              </div>
            )}
          </section>

          <section className="md:grid md:grid-cols-[1.15fr_0.85fr] md:gap-8">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-200">Choose a date</label>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <button type="button" className="btn-ghost px-3 py-1" onClick={()=> setMonth(prevMonth(month,-1))}>Prev</button>
                  <span className="text-sm font-semibold text-slate-100">{formatMonth(month)}</span>
                  <button type="button" className="btn-ghost px-3 py-1" onClick={()=> setMonth(prevMonth(month,1))}>Next</button>
                </div>
              </div>
              <div className="flex gap-2 text-xs">
                <button type="button" className="btn-secondary px-3 py-2" onClick={()=> setDate(todayYMD)}>Today</button>
                <button
                  type="button"
                  className="btn-secondary px-3 py-2"
                  onClick={()=> {
                    const d = new Date(); d.setDate(d.getDate()+1)
                    const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                    setDate(ymd)
                  }}
                >Tomorrow</button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-slate-300">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=> <div key={d} className="py-1">{d}</div>)}
                {calendar.map((cell, idx) => {
                  const isCurrent = !!cell
                  const ymd = cell || ""
                  const enabled = isCurrent && availableDays.includes(ymd)
                  const isToday = isCurrent && ymd === todayYMD
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!enabled}
                      onClick={()=> setDate(ymd)}
                      className={`h-9 rounded border transition ${!isCurrent
                        ? 'invisible'
                        : enabled
                          ? (date===ymd
                              ? 'border-midnight-400 bg-midnight-500/40 text-slate-50 shadow-[0_0_12px_rgba(45,110,255,0.45)]'
                              : (isToday ? 'border-midnight-400/70 bg-midnight-500/20 text-midnight-200' : 'border-white/10 bg-white/8 hover:border-midnight-300/70 hover:bg-midnight-500/15'))
                          : (isToday ? 'border-midnight-400/40 bg-midnight-500/10 text-slate-400 cursor-not-allowed' : 'border-white/5 bg-white/4 text-slate-500 cursor-not-allowed')
                      }`}
                    >
                      {isCurrent ? Number(ymd.slice(-2)) : ''}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <label className="text-sm font-medium text-slate-200">Select a time</label>
                <span className="text-xs text-slate-400">{timeZone}</span>
              </div>
              {!date ? (
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-300">
                  Select a date to see available times.
                </div>
              ) : slots.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-300">
                  No slots available for this date. Try another day.
                </div>
              ) : (
                <div className="max-h-64 space-y-2 overflow-auto pr-1">
                  {slots.map((slot) => (
                    <button
                      type="button"
                      key={slot.start}
                      onClick={() => {
                        setStartTime(slot.start)
                        setSelectedHostId(slot.host_user_ids?.[0] || null)
                      }}
                      className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition-colors ${startTime === slot.start
                        ? 'border-midnight-400 bg-midnight-500/35 text-slate-50 shadow-[0_0_12px_rgba(45,110,255,0.35)]'
                        : 'border-white/10 bg-white/8 text-slate-200 hover:border-midnight-300/70 hover:bg-midnight-500/15'}`}
                      aria-pressed={startTime === slot.start}
                    >
                      {formatSlotLabelTZ(slot.start, eventType?.duration_minutes || 30, timeZone)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {startTime && (
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <div className="text-sm text-slate-200">Selected</div>
              <div className="text-base font-semibold text-slate-50">{new Date(startTime).toLocaleString([], { timeZone })} ({timeZone})</div>
              <div className="text-xs text-slate-300">Duration: {eventType?.duration_minutes || 30} min</div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="btn-ghost px-4 py-2" onClick={()=> { setStartTime(''); setSelectedHostId(null); }}>Change time</button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-sm font-medium text-slate-200">Background/notes (optional)</label>
            <textarea
              placeholder="Agenda, context, or anything we should know"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="textarea-field"
              rows={3}
            />
          </div>

          {(errorMsg || tokenError) && <div className="rounded-2xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-200">{errorMsg || tokenError}</div>}

          <div className="flex flex-col gap-3 text-xs text-slate-300 sm:flex-row sm:items-center sm:justify-between">
            <span>By booking, you agree to receive updates about this meeting.</span>
            <button className="btn-primary px-6 py-3" disabled={!startTime || submitting}>
              {submitting ? 'Booking…' : (startTime ? 'Confirm booking' : `Book ${eventType ? `${eventType.duration_minutes} min` : ''}`)}
            </button>
          </div>
        </form>
    </div>
  );

  const wrappedForm = embedded ? formContent : <Layout>{formContent}</Layout>

  return (
    <>
      {wrappedForm}
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </>
  )
}

function buildMonthGrid(month: string): (string|null)[] {
  if (!month) return Array(42).fill(null)
  const [yStr, mStr] = month.split('-')
  const y = Number(yStr), m = Number(mStr) - 1
  const first = new Date(Date.UTC(y, m, 1))
  const startIdx = first.getUTCDay()
  const nextMonth = new Date(Date.UTC(y, m + 1, 1))
  const daysInMonth = Math.round((nextMonth.getTime() - first.getTime()) / 86400000)
  const cells: (string|null)[] = Array(42).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const idx = startIdx + d - 1
    const ymd = `${yStr}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells[idx] = ymd
  }
  return cells
}

function prevMonth(month: string, delta: number): string {
  if (!month) return month
  const [yStr, mStr] = month.split('-')
  let y = Number(yStr), m = Number(mStr) - 1
  m += delta
  if (m < 0) {
    y -= 1
    m += 12
  }
  if (m > 11) {
    y += 1
    m -= 12
  }
  return `${y}-${String(m + 1).padStart(2, '0')}`
}

function formatMonth(month: string): string {
  if (!month) return ''
  const [yStr, mStr] = month.split('-')
  const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, 1))
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' })
}

function formatSlotLabelTZ(startIso: string, durationMin: number, timeZone: string) {
  try {
    const d = new Date(startIso)
    const e = new Date(d.getTime() + durationMin * 60000)
    const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone }
    const s = d.toLocaleTimeString([], opts)
    const t = e.toLocaleTimeString([], opts)
    return `${s} – ${t}`
  } catch {
    return startIso
  }
}

function googleEventUrl(summary: string, description: string, startIso: string, durationMin: number) {
  try {
    const s = new Date(startIso)
    const e = new Date(s.getTime() + durationMin * 60000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: summary,
      details: description,
      dates: `${fmt(s)}/${fmt(e)}`,
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
  } catch {
    return '#'
  }
}

function icsDataUrl(summary: string, description: string, startIso: string, durationMin: number) {
  try {
    const s = new Date(startIso)
    const e = new Date(s.getTime() + durationMin * 60000)
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//CalendlAI//EN',
      'BEGIN:VEVENT',
      `DTSTART:${fmt(s)}`,
      `DTEND:${fmt(e)}`,
      `SUMMARY:${escapeICS(summary)}`,
      `DESCRIPTION:${escapeICS(description)}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n')
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics)
  } catch {
    return '#'
  }
}

function escapeICS(value: string) {
  return value.replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

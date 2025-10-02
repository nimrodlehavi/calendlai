"use client"
import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/router"
import Layout from "../../components/Layout"
import { Toast } from "../../components/Toast"

export default function BookEvent({ eventTypeId, hostUsername }: { eventTypeId?: string; hostUsername?: string }) {
  const router = useRouter()
  const routeId = router.query?.id
  const effectiveId = typeof eventTypeId === 'string' ? eventTypeId : (typeof routeId === 'string' ? routeId : undefined)

  const [eventType, setEventType] = useState<any>(null)
  const [inviteeEmail, setInviteeEmail] = useState("")
  const [emailLocked, setEmailLocked] = useState(false)
  const [tokenError, setTokenError] = useState<string | null>(null)
  const [inviteeName, setInviteeName] = useState("")
  const [notes, setNotes] = useState("")
  const [date, setDate] = useState("")
  const [slots, setSlots] = useState<{ start: string; host_user_ids: string[] }[]>([])
  const [month, setMonth] = useState<string>("") // YYYY-MM
  const [availableDays, setAvailableDays] = useState<string[]>([])
  const [startTime, setStartTime] = useState<string>("")
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string|null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'success'|'error'|'info' } | null>(null)
  const [step, setStep] = useState<'time'|'details'|'done'>('time')
  const [timeZone, setTimeZone] = useState<string>(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')

  useEffect(() => {
    if (!effectiveId) return;
    fetch(`/api/event-types?id=${effectiveId}`)
      .then(res => res.json())
      .then(data => {
        if (data.eventType) setEventType(data.eventType)
      })
  }, [effectiveId])


  // Prefill email from invite token or query param
  useEffect(() => {
    const inviteeParam = router.query?.invitee as string | undefined;
    const tokenParam = router.query?.invitee_token as string | undefined;

    async function resolveToken(token: string) {
      setTokenError(null);
      try {
        const res = await fetch(`/api/public/invite-token?token=${encodeURIComponent(token)}`);
        const json = await res.json();
        if (!res.ok || !json.email) {
          throw new Error(json.error || 'Invalid invite token');
        }
        setInviteeEmail(json.email);
        setEmailLocked(true);
      } catch (err: any) {
        setTokenError(err.message || String(err));
        setEmailLocked(false);
      }
    }

    if (tokenParam) {
      resolveToken(tokenParam);
    } else if (inviteeParam) {
      setInviteeEmail(inviteeParam);
      setEmailLocked(true);
    }
  }, [router.query?.invitee, router.query?.invitee_token])

  // Initialize month as current YYYY-MM on mount
  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth()+1).padStart(2,'0');
    setMonth(`${y}-${m}`);
  }, [])

  // Fetch available days when month changes
  useEffect(() => {
    if (!effectiveId || !month) return;
    setAvailableDays([]);
    setDate("");
    setSlots([]);
    fetch(`/api/available-days?event_type_id=${encodeURIComponent(String(effectiveId))}&month=${encodeURIComponent(month)}`)
      .then(r=> r.json())
      .then(d=> setAvailableDays(d.days || []))
      .catch(()=> setAvailableDays([]))
  }, [effectiveId, month])

  useEffect(() => {
    if (!effectiveId || !date) {
      setSlots([])
      setStartTime("")
      setSelectedHostId(null)
      return
    }
    fetch(`/api/slots?event_type_id=${encodeURIComponent(String(effectiveId))}&date=${encodeURIComponent(date)}`)
      .then((r) => r.json())
      .then((d) => {
        const parsed = Array.isArray(d.slots)
          ? d.slots.map((slot: any) => ({
              start: slot.start,
              host_user_ids: Array.isArray(slot.host_user_ids) ? slot.host_user_ids : [],
            }))
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
    if (!startTime) { setErrorMsg('Please select a time'); return; }
    const emailValue = inviteeEmail.trim()
    if (!emailValue) { setErrorMsg('Please enter your email address.'); return; }
    setSubmitting(true)
    const duration = eventType?.duration_minutes || 30
    const start = new Date(startTime)
    const end = new Date(start.getTime() + duration * 60000)
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_type_id: effectiveId,
          host_user_id: selectedHostId,
          invitee_email: emailValue,
          invitee_name: inviteeName || null,
          notes: notes || null,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          access_token: null
        })
      })
      const j = await res.json().catch(()=> ({}))
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

  if (success) {
    return (
      <Layout>
        <div className="max-w-lg mx-auto p-6 text-center">
          <h1 className="text-2xl font-bold mb-4">Booking Confirmed ✅</h1>
        {startTime && (
            <div className="mt-2 grid gap-2">
              <a
                href={googleEventUrl(eventType?.name || 'CalendlAI Booking', notes || '', startTime, (eventType?.duration_minutes || 30))}
                target="_blank"
                rel="noreferrer"
                className="inline-block px-3 py-2 rounded border hover:bg-gray-50"
              >Add to Google Calendar</a>
              <a
                href={icsDataUrl(eventType?.name || 'CalendlAI Booking', notes || '', startTime, (eventType?.duration_minutes || 30))}
                download="invite.ics"
                className="inline-block px-3 py-2 rounded border hover:bg-gray-50"
              >Download .ics</a>
            </div>
          )}
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

  const calendar = useMemo(() => buildMonthGrid(month), [month]);
  const todayYMD = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }, []);

  return (
    <Layout>
      <div className="bg-white shadow rounded-lg p-6 max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-center">
          {eventType ? eventType.name : "Loading..."}
        </h1>
        <form onSubmit={book} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm mb-1">Your name (optional)</label>
              <input
                type="text"
                placeholder="Jane Doe"
                value={inviteeName}
                onChange={e => setInviteeName(e.target.value)}
                className="w-full border rounded px-3 py-2"
              />
            </div>
            {emailLocked ? (
              <div className="rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                Invitation sent to <span className="font-medium">{inviteeEmail}</span>
              </div>
            ) : (
              <div>
                <label className="block text-sm mb-1">Your email</label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={inviteeEmail}
                  onChange={e => setInviteeEmail(e.target.value)}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
            )}
          </div>
          <div className="md:grid md:grid-cols-2 md:gap-6">
            <div className="mb-4 md:mb-0">
              <label className="block text-sm mb-2">Choose a date</label>
              <div className="flex items-center justify-between mb-2">
                <button type="button" className="text-sm underline" onClick={()=> setMonth(prevMonth(month,-1))}>Prev</button>
                <div className="text-sm font-medium">{formatMonth(month)}</div>
                <button type="button" className="text-sm underline" onClick={()=> setMonth(prevMonth(month,1))}>Next</button>
              </div>
              <div className="flex gap-2 mb-2">
                <button type="button" className="px-2 py-1 text-xs rounded border" onClick={()=> setDate(todayYMD)}>Today</button>
                <button type="button" className="px-2 py-1 text-xs rounded border" onClick={()=> {
                  const d = new Date(); d.setDate(d.getDate()+1);
                  const ymd = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                  setDate(ymd);
                }}>Tomorrow</button>
              </div>
              <div className="grid grid-cols-7 gap-1 text-center text-xs">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=> <div key={d} className="py-1 text-gray-500">{d}</div>)}
                {calendar.map((cell, idx) => {
                  const isCurrent = !!cell;
                  const ymd = cell || "";
                  const enabled = isCurrent && availableDays.includes(ymd);
                  const isToday = isCurrent && ymd === todayYMD;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={!enabled}
                      onClick={()=> setDate(ymd)}
                      className={`h-9 rounded border ${!isCurrent
                          ? 'invisible'
                          : enabled
                            ? (date===ymd
                                ? 'bg-black text-white border-black'
                                : (isToday ? 'bg-blue-50 border-blue-600 text-blue-700' : 'bg-white hover:bg-gray-50'))
                            : (isToday ? 'bg-blue-50 text-blue-400 border-blue-300 cursor-not-allowed' : 'bg-gray-100 text-gray-400 cursor-not-allowed')
                        }`}
                    >
                      {isCurrent ? Number(ymd.slice(-2)) : ''}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label className="block text-sm">Select a time</label>
                <span className="text-xs text-gray-500">{timeZone}</span>
              </div>
              {!date ? (
                <div className="text-sm text-gray-600">Select a date to see available times</div>
              ) : slots.length === 0 ? (
                <div className="text-sm text-gray-600">No slots available</div>
              ) : (
                <div className="max-h-64 overflow-auto space-y-2 pr-1">
                  {slots.map((slot) => (
                    <button
                      type="button"
                      key={slot.start}
                      onClick={() => {
                        setStartTime(slot.start)
                        setSelectedHostId(slot.host_user_ids?.[0] || null)
                      }}
                      className={`w-full px-4 py-2 text-left rounded-md border transition-colors ${startTime === slot.start ? 'bg-black text-white border-black' : 'bg-white hover:bg-gray-50'}`}
                      aria-pressed={startTime === slot.start}
                    >
                      {formatSlotLabelTZ(slot.start, eventType?.duration_minutes || 30, timeZone)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {startTime && (
            <div className="rounded border p-3">
              <div className="text-sm text-gray-700">Selected:</div>
              <div className="font-medium">{new Date(startTime).toLocaleString([], { timeZone })} ({timeZone})</div>
              <div className="text-xs text-gray-500">Duration: {eventType?.duration_minutes || 30} min</div>
              <div className="mt-2 flex gap-2">
                <button type="button" className="px-3 py-1 rounded border" onClick={()=> { setStartTime(''); setSelectedHostId(null); }}>Change time</button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm mb-1">Background/notes (optional)</label>
            <textarea
              placeholder="Agenda, context, or anything we should know"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full border rounded px-3 py-2"
              rows={3}
            />
          </div>
          {(errorMsg || tokenError) && <div className="text-sm text-red-600">{errorMsg || tokenError}</div>}
          <button className="w-full bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:opacity-50" disabled={!startTime || submitting}>
            {submitting ? 'Booking…' : (startTime ? 'Confirm booking' : `Book ${eventType ? `${eventType.duration_minutes} min` : ''}`)}
          </button>
        </form>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </Layout>
  )
}

function buildMonthGrid(month: string): (string|null)[] {
  if (!month) return Array(42).fill(null);
  const [yStr, mStr] = month.split('-');
  const y = Number(yStr), m = Number(mStr)-1;
  const first = new Date(Date.UTC(y,m,1));
  const startIdx = first.getUTCDay();
  const nextMonth = new Date(Date.UTC(y,m+1,1));
  const daysInMonth = Math.round((nextMonth.getTime() - first.getTime())/86400000);
  const cells: (string|null)[] = Array(42).fill(null);
  for (let d=1; d<=daysInMonth; d++) {
    const idx = startIdx + d - 1;
    const ymd = `${yStr}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    cells[idx] = ymd;
  }
  return cells;
}

function prevMonth(month: string, delta: number): string {
  if (!month) return month;
  const [yStr, mStr] = month.split('-');
  let y = Number(yStr), m = Number(mStr)-1;
  m += delta;
  if (m < 0) { y -= 1; m += 12; }
  if (m > 11) { y += 1; m -= 12; }
  return `${y}-${String(m+1).padStart(2,'0')}`;
}

function formatMonth(month: string): string {
  if (!month) return '';
  const [yStr, mStr] = month.split('-');
  const d = new Date(Date.UTC(Number(yStr), Number(mStr)-1, 1));
  return d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
}

function formatSlotLabel(startIso: string, durationMin: number) {
  try {
    const d = new Date(startIso);
    const e = new Date(d.getTime() + durationMin * 60000);
    const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false };
    const s = d.toLocaleTimeString([], opts);
    const t = e.toLocaleTimeString([], opts);
    return `${s} – ${t}`;
  } catch {
    return startIso;
  }
}


function TimeZoneSelect({ value, onChange }:{ value:string; onChange:(v:string)=>void }){
  const anyIntl = Intl as any;
  let list: string[] = [];
  if (anyIntl.supportedValuesOf) {
    try { list = anyIntl.supportedValuesOf('timeZone') as string[]; } catch { list = []; }
  }
  if (!list.length) list = ['UTC','Europe/London','Europe/Paris','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Asia/Singapore','Asia/Tokyo','Australia/Sydney'];
  return (
    <select className="border rounded px-2 py-1 text-sm" value={value} onChange={e=> onChange(e.target.value)}>
      {list.map(tz => (<option key={tz} value={tz}>{tz}</option>))}
    </select>
  );
}

function formatSlotLabelTZ(startIso: string, durationMin: number, timeZone: string) {
  try {
    const d = new Date(startIso);
    const e = new Date(d.getTime() + durationMin * 60000);
    const opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone };
    const s = d.toLocaleTimeString([], opts);
    const t = e.toLocaleTimeString([], opts);
    return `${s} – ${t}`;
  } catch {
    return startIso;
  }
}


function googleEventUrl(summary: string, description: string, startIso: string, durationMin: number) {
  try {
    const s = new Date(startIso);
    const e = new Date(s.getTime() + durationMin * 60000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: summary,
      details: description,
      dates: `${fmt(s)}/${fmt(e)}`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch { return '#'; }
}
function icsDataUrl(summary: string, description: string, startIso: string, durationMin: number) {
  try {
    const s = new Date(startIso);
    const e = new Date(s.getTime() + durationMin * 60000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
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
    ].join('\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  } catch { return '#'; }
}
function escapeICS(s: string) { return s.replace(/\n/g, '\n').replace(/,/g, '\,').replace(/;/g, '\;'); }

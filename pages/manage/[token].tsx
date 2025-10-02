import { useEffect, useMemo, useState } from 'react';
import Layout from '../../components/Layout';

export default function ManagePage(){
  const [token, setToken] = useState<string>("");
  const [booking, setBooking] = useState<any>(null);
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<{ start: string; host_user_ids: string[] }[]>([]);
  const [startTime, setStartTime] = useState<string>("");
  const [selectedHostId, setSelectedHostId] = useState<string | null>(null);
  const [month, setMonth] = useState<string>("");
  const [availableDays, setAvailableDays] = useState<string[]>([]);
  const [status, setStatus] = useState<string>("");
  const [timeZone, setTimeZone] = useState<string>(() => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');

  useEffect(() => {
    const t = location.pathname.split('/').pop() || '';
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/public/bookings/${encodeURIComponent(token)}`)
      .then(r=> r.json())
      .then(d=> setBooking(d.booking))
      .catch(()=> setStatus('Not found'))
  }, [token]);

  useEffect(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth()+1).padStart(2,'0');
    setMonth(`${y}-${m}`);
  }, [])

  useEffect(() => {
    if (!booking?.event_type_id || !month) return;
    fetch(`/api/available-days?event_type_id=${encodeURIComponent(String(booking.event_type_id))}&month=${encodeURIComponent(month)}`)
      .then(r=> r.json())
      .then(d=> setAvailableDays(d.days || []))
      .catch(()=> setAvailableDays([]))
  }, [booking?.event_type_id, month])

  useEffect(() => {
    if (!booking?.event_type_id || !date) {
      setSlots([])
      setStartTime("")
      setSelectedHostId(null)
      return
    }
    fetch(`/api/slots?event_type_id=${encodeURIComponent(String(booking.event_type_id))}&date=${encodeURIComponent(date)}`)
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
  }, [booking?.event_type_id, date])

  async function reschedule(){
    if (!token || !startTime) return;
    setStatus('Rescheduling...');
    const body = { start_time: startTime, host_user_id: selectedHostId };
    const r = await fetch(`/api/public/bookings/${encodeURIComponent(token)}`, { method:'PUT', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body) });
    if (r.ok) {
      const j = await r.json().catch(()=> ({}));
      if (j.booking) setBooking(j.booking);
      setStatus('Rescheduled');
      setSelectedHostId(null);
    } else {
      setStatus('Failed to reschedule');
    }
  }
  async function cancel(){
    if (!token) return;
    setStatus('Cancelling...');
    const r = await fetch(`/api/public/bookings/${encodeURIComponent(token)}`, { method:'DELETE' });
    if (r.ok) setStatus('Cancelled'); else setStatus('Failed to cancel');
  }

  const calendar = useMemo(()=> buildMonthGrid(month), [month]);
  const todayYMD = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }, []);

  if (!booking) return <Layout><div className='p-6'>{status || 'Loading...'}</div></Layout>

  return (
    <Layout>
      <div className='max-w-xl mx-auto space-y-4'>
        <h1 className='text-2xl font-bold'>Manage booking</h1>
        <div className='text-sm text-gray-700'>Invitee: {booking.invitee_email}</div>
        <div className='text-sm text-gray-700'>Current time: {new Date(booking.start_time).toLocaleString([], { timeZone })} ({timeZone})</div>

        <div className='rounded border p-4 space-y-3'>
          <div className='font-medium flex items-center gap-2'>
            <span>Reschedule</span>
            <span className='text-xs text-gray-600'>Time zone:</span>
            <TimeZoneSelect value={timeZone} onChange={setTimeZone} />
          </div>
          <div className='flex items-center justify-between mb-2'>
            <button type='button' className='text-sm underline' onClick={()=> setMonth(prevMonth(month,-1))}>Prev</button>
            <div className='text-sm font-medium'>{formatMonth(month)}</div>
            <button type='button' className='text-sm underline' onClick={()=> setMonth(prevMonth(month,1))}>Next</button>
          </div>
          <div className='grid grid-cols-7 gap-1 text-center text-xs'>
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=> <div key={d} className='py-1 text-gray-500'>{d}</div>)}
            {calendar.map((cell, idx) => {
              const isCurrent = !!cell;
              const ymd = cell || "";
              const enabled = isCurrent && availableDays.includes(ymd);
              const isToday = isCurrent && ymd === todayYMD;
              return (
                <button
                  key={idx}
                  type='button'
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
          {date && (
            <div>
              <div className='text-sm mb-2'>Available times ({timeZone})</div>
              <div className='flex flex-wrap gap-2'>
                {slots.length === 0 ? (
                  <div className='text-sm text-gray-600'>No slots</div>
                ) : slots.map(slot => (
                  <button
                    key={slot.start}
                    type='button'
                    onClick={()=> { setStartTime(slot.start); setSelectedHostId(slot.host_user_ids?.[0] || null); }}
                    className={`px-3 py-2 rounded border ${startTime===slot.start? 'bg-black text-white':'bg-white'}`}
                  >
                    {formatSlotLabelTZ(slot.start, booking?.duration_minutes || 30, timeZone)}
                  </button>
                ))}
              </div>
            </div>
          )}
          <button className='px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50' disabled={!startTime} onClick={reschedule}>Confirm reschedule</button>
        </div>

        <div className='rounded border p-4'>
          <div className='font-medium mb-2'>Cancel booking</div>
          <button className='px-3 py-2 rounded bg-red-600 text-white' onClick={cancel}>Cancel</button>
        </div>

        {status && <div className='text-sm'>{status}</div>}
        {status === 'Rescheduled' && startTime && (
          <div className='mt-3 grid gap-2'>
            <a
              href={googleEventUrl('CalendlAI Booking', `Meeting with ${booking?.invitee_email || ''}`, startTime, durationFromBooking(booking) || 30)}
              target='_blank'
              rel='noreferrer'
              className='inline-block px-3 py-2 rounded border hover:bg-gray-50'
            >Add to Google Calendar</a>
            <a
              href={icsDataUrl('CalendlAI Booking', `Meeting with ${booking?.invitee_email || ''}`, startTime, durationFromBooking(booking) || 30)}
              download='invite.ics'
              className='inline-block px-3 py-2 rounded border hover:bg-gray-50'
            >Download .ics</a>
          </div>
        )}
        <div className='text-xs text-gray-500'>All times shown in {timeZone}</div>
      </div>
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
  m += delta; if (m < 0) { y -= 1; m += 12; } if (m > 11) { y += 1; m -= 12; }
  return `${y}-${String(m+1).padStart(2,'0')}`;
}
function formatMonth(month: string) {
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

function durationFromBooking(booking:any): number | null {
  try {
    if (!booking?.start_time || !booking?.end_time) return null;
    const s = new Date(booking.start_time).getTime();
    const e = new Date(booking.end_time).getTime();
    return Math.max(5, Math.round((e - s) / 60000));
  } catch { return null; }
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
    ].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(ics);
  } catch { return '#'; }
}
function escapeICS(s: string) { return s.replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }


function TimeZoneSelect({ value, onChange }:{ value:string; onChange:(v:string)=>void }){
  const anyIntl = Intl as any;
  let list: string[] = [];
  if (anyIntl.supportedValuesOf) {
    try { list = anyIntl.supportedValuesOf('timeZone') as string[]; } catch { list = []; }
  }
  if (!list.length) list = ['UTC','Europe/London','Europe/Paris','America/New_York','America/Chicago','America/Denver','America/Los_Angeles','Asia/Singapore','Asia/Tokyo','Australia/Sydney'];
  return (
    <select className='border rounded px-2 py-1 text-sm' value={value} onChange={e=> onChange(e.target.value)}>
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

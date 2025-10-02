// pages/availability.tsx
import { useEffect, useMemo, useState, useRef } from "react";
import AuthGuard from "../components/AuthGuard";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import { Toast } from "../components/Toast";

type Window = { id: string; day_of_week: number; start_time: string; end_time: string };
type Block = { id: string; start_time: string; end_time: string };

const DOW = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export default function AvailabilityPage(){
  return (
    <AuthGuard redirectTo="/login">
      <Content />
    </AuthGuard>
  );
}

function Content(){
  const [userId, setUserId] = useState<string | null>(null);
  const [windows, setWindows] = useState<Window[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [toast, setToast] = useState<{msg:string;type:'success'|'error'|'info'}|null>(null);

  const byDay = useMemo(() => {
    const m: Record<number, Window[]> = {0:[],1:[],2:[],3:[],4:[],5:[],6:[]};
    for (const w of windows) { (m[w.day_of_week] ||= []).push(w); }
    for (const k of Object.keys(m)) m[Number(k)].sort((a,b)=> a.start_time.localeCompare(b.start_time));
    return m;
  }, [windows]);

  useEffect(() => {
    const run = async () => {
      const { data: s } = await supabaseBrowserClient.auth.getUser();
      const id = s.user?.id || null;
      setUserId(id);
      if (!id) return;
      const [{ data: w }, { data: b }] = await Promise.all([
        supabaseBrowserClient.from('availability_windows').select('id, day_of_week, start_time, end_time').eq('user_id', id),
        supabaseBrowserClient.from('blocks').select('id, start_time, end_time').eq('user_id', id).order('start_time', { ascending: true })
      ]);
      setWindows((w as any) || []);
      setBlocks((b as any) || []);
    };
    run();
  }, []);

  async function addWindow(day: number, start_time: string, end_time: string){
    if (!userId) return;
    const { data, error } = await supabaseBrowserClient.from('availability_windows').insert({ user_id: userId, day_of_week: day, start_time, end_time }).select('id, day_of_week, start_time, end_time').single();
    if (error) return setToast({ msg: error.message, type: 'error' });
    setWindows([...(windows||[]), data as any]);
    setToast({ msg: 'Added window', type: 'success' });
  }
  async function deleteWindow(id: string){
    await supabaseBrowserClient.from('availability_windows').delete().eq('id', id);
    setWindows(windows.filter(w=> w.id !== id));
  }

  async function addBlock(start: string, end: string){
    if (!userId) return;
    const { data, error } = await supabaseBrowserClient.from('blocks').insert({ user_id: userId, start_time: start, end_time: end }).select('id, start_time, end_time').single();
    if (error) return setToast({ msg: error.message, type: 'error' });
    setBlocks([...(blocks||[]), data as any].sort((a,b)=> a.start_time.localeCompare(b.start_time)));
    setToast({ msg: 'Blocked time added', type: 'success' });
  }
  async function deleteBlock(id: string){
    await supabaseBrowserClient.from('blocks').delete().eq('id', id);
    setBlocks(blocks.filter(b=> b.id !== id));
  }

  return (
    <main className="max-w-4xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Availability</h1>

      <section className="rounded-xl border">
        <div className="p-4 border-b font-medium">Weekly hours</div>
        <div className="p-4">
          <WeekAvailabilityGrid windows={windows} onSave={async (daySlots) => {
            if (!userId) return;
            // Replace all windows with merged slots
            await supabaseBrowserClient.from('availability_windows').delete().eq('user_id', userId);
            const rows: any[] = [];
            for (let d=0; d<7; d++) {
              const slots = daySlots[d] || [];
              // Merge contiguous 30-min slots
              let i = 0;
              while (i < slots.length) {
                if (!slots[i]) { i++; continue; }
                let j = i;
                while (j < slots.length && slots[j]) j++;
                const start = i; const end = j; // [start, end)
                const toTime = (idx:number) => {
                  const h = Math.floor(idx/2);
                  const m = idx%2 ? 30 : 0;
                  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
                };
                rows.push({ user_id: userId, day_of_week: d, start_time: toTime(start), end_time: toTime(end) });
                i = j;
              }
            }
            if (rows.length) {
              const { error } = await supabaseBrowserClient.from('availability_windows').insert(rows);
              if (error) setToast({ msg: error.message, type:'error' }); else setToast({ msg:'Weekly hours saved', type:'success' });
            } else {
              setToast({ msg:'Cleared weekly hours', type:'success' });
            }
            // reload
            const { data: w } = await supabaseBrowserClient.from('availability_windows').select('id, day_of_week, start_time, end_time').eq('user_id', userId);
            setWindows((w as any) || []);
          }} />
        </div>
      </section>

      <section className="rounded-xl border">
        <div className="p-4 border-b font-medium">One-off blocks (vacations, overrides)</div>
        <div className="p-4 space-y-4">
          <AddBlockForm onAdd={addBlock} />
          <ul className="divide-y">
            {blocks.length === 0 ? (
              <li className="p-2 text-sm text-gray-600">No blocks</li>
            ) : blocks.map(b => (
              <li key={b.id} className="p-2 flex items-center justify-between text-sm">
                <span>{new Date(b.start_time).toLocaleString()} – {new Date(b.end_time).toLocaleString()}</span>
                <button onClick={()=> deleteBlock(b.id)} className="text-red-600">Delete</button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </main>
  );
}

function AddWindowForm({ onAdd }:{ onAdd: (start: string, end: string) => void }){
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  return (
    <form onSubmit={e=> { e.preventDefault(); onAdd(start, end); }} className="mt-3 flex items-end gap-2 text-sm">
      <div>
        <label className="block text-xs">Start</label>
        <input type="time" value={start} onChange={e=> setStart(e.target.value)} className="border rounded px-2 py-1" />
      </div>
      <div>
        <label className="block text-xs">End</label>
        <input type="time" value={end} onChange={e=> setEnd(e.target.value)} className="border rounded px-2 py-1" />
      </div>
      <button className="px-2 py-1 rounded border">Add</button>
    </form>
  );
}

function AddBlockForm({ onAdd }:{ onAdd: (start: string, end: string) => void }){
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  return (
    <form onSubmit={e=> { e.preventDefault(); if (start && end) onAdd(new Date(start).toISOString(), new Date(end).toISOString()); }} className="flex flex-col md:flex-row gap-2 items-end text-sm">
      <div>
        <label className="block text-xs">Start</label>
        <input type="datetime-local" value={start} onChange={e=> setStart(e.target.value)} className="border rounded px-2 py-1" />
      </div>
      <div>
        <label className="block text-xs">End</label>
        <input type="datetime-local" value={end} onChange={e=> setEnd(e.target.value)} className="border rounded px-2 py-1" />
      </div>
      <button className="px-2 py-1 rounded border" disabled={!start || !end}>Add block</button>
    </form>
  );
}

function WeekAvailabilityGrid({ windows, onSave}:{ windows: Window[]; onSave: (daySlots: boolean[][]) => void }){
  const SLOT_COUNT = 48; // 30-min slots
  const toIdx = (t:string) => { const [hh,mm] = t.split(':').map(Number); return hh*2 + (mm>=30?1:0); };
  const idxToLabel = (idx:number) => {
    const hh = Math.floor(idx/2); const mm = idx%2 ? '30' : '00';
    return `${String(hh).padStart(2,'0')}:${mm}`;
  };
  function buildGridFromWindows() {
    const g: boolean[][] = Array.from({length:7}, ()=> Array(SLOT_COUNT).fill(false));
    for (const w of windows) {
      const d = w.day_of_week;
      const st = w.start_time.slice(0,5);
      const et = w.end_time.slice(0,5);
      let i = toIdx(st), j = toIdx(et);
      i = Math.max(0, Math.min(SLOT_COUNT, i));
      j = Math.max(0, Math.min(SLOT_COUNT, j));
      for (let k=i; k<j; k++) g[d][k] = true;
    }
    return g;
  }
  function buildDayStartDefaults() {
    const defaults = Array.from({length:7}, ()=> 16);
    const mins = windows.reduce((acc:any,w)=>{ acc[w.day_of_week] = Math.min(acc[w.day_of_week] ?? SLOT_COUNT, toIdx(w.start_time.slice(0,5))); return acc; }, {} as Record<number,number>);
    const arr = defaults.slice();
    (Object.entries(mins) as [string, number][]).forEach(([d, i]) => {
      const idx = Number(d);
      arr[idx] = Math.min(arr[idx], i);
    });
    return arr;
  }
  function buildDayEndDefaults() {
    const defaults = Array.from({length:7}, ()=> 40);
    const maxs = windows.reduce((acc:any,w)=>{ acc[w.day_of_week] = Math.max(acc[w.day_of_week] ?? 0, toIdx(w.end_time.slice(0,5))); return acc; }, {} as Record<number,number>);
    const arr = defaults.slice();
    (Object.entries(maxs) as [string, number][]).forEach(([d, i]) => {
      const idx = Number(d);
      arr[idx] = Math.max(arr[idx], i);
    });
    return arr;
  }
  // Build initial grid from windows
  const [grid, setGrid] = useState<boolean[][]>(buildGridFromWindows);
  useEffect(() => {
    setGrid(buildGridFromWindows());
  }, [windows]);
  // Per-day visible range selectors (default 08:00 - 20:00), prefilled from existing windows if present
  const [dayStart, setDayStart] = useState<number[]>(buildDayStartDefaults);
  const [dayEnd, setDayEnd] = useState<number[]>(buildDayEndDefaults);

  useEffect(() => {
    setDayStart(buildDayStartDefaults());
    setDayEnd(buildDayEndDefaults());
  }, [windows]);

  const dragging = useRef<{ active: boolean; setTo: boolean }|null>(null);

  function handleMouseDown(d:number, s:number) {
    // Only if within visible range
    if (s < dayStart[d] || s >= dayEnd[d]) return;
    const setTo = !grid[d][s];
    dragging.current = { active: true, setTo };
    setGrid(prev => {
      const copy = prev.map(r=> [...r]);
      copy[d][s] = setTo; return copy;
    });
  }
  function handleMouseEnter(d:number, s:number) {
    if (!dragging.current?.active) return;
    if (s < dayStart[d] || s >= dayEnd[d]) return;
    const setTo = dragging.current.setTo;
    setGrid(prev => {
      const copy = prev.map(r=> [...r]);
      copy[d][s] = setTo; return copy;
    });
  }
  function handleMouseUp(){ dragging.current = null; }

  function toggleDay(d:number, value:boolean){
    setGrid(prev => { const copy = prev.map(r=> [...r]); for (let i=dayStart[d]; i<dayEnd[d]; i++) copy[d][i]=value; return copy; });
  }
  function clearAll(){ setGrid(Array.from({length:7}, ()=> Array(SLOT_COUNT).fill(false))); }

  function onChangeDayStart(d:number, idx:number){
    setDayStart(prev => {
      const next = [...prev]; next[d] = Math.min(idx, dayEnd[d]-1); return next;
    });
    setGrid(prev => { const copy = prev.map(r=> [...r]); for (let i=0;i<SLOT_COUNT;i++){ if (i<idx || i>=dayEnd[d]) copy[d][i]=false; } return copy; });
  }
  function onChangeDayEnd(d:number, idx:number){
    setDayEnd(prev => {
      const next = [...prev]; next[d] = Math.max(idx, dayStart[d]+1); return next;
    });
    setGrid(prev => { const copy = prev.map(r=> [...r]); for (let i=0;i<SLOT_COUNT;i++){ if (i<dayStart[d] || i>=idx) copy[d][i]=false; } return copy; });
  }

  const displayStartHour = 8; // 08:00
  const displayEndHour = 20; // 20:00
  const hours = Array.from({length:displayEndHour-displayStartHour}, (_,i)=> i+displayStartHour);

  const timeOptions = Array.from({length:(displayEndHour-displayStartHour)*2+1}, (_,i)=> displayStartHour*2 + i)
    .map(idx => ({ idx, label: idxToLabel(idx) }));

  return (
    <div onMouseLeave={handleMouseUp}>
      <div className="overflow-auto">
        <div className="grid" style={{ gridTemplateColumns: `120px repeat(7, 1fr)` }}>
          <div></div>
          {DOW.map((d,idx)=> (
            <div key={d} className="text-xs font-medium flex items-center justify-between px-2 gap-2">
              <span>{d}</span>
              <div className="flex items-center gap-1">
                <select className="border rounded px-1 py-0.5" value={dayStart[idx]} onChange={e=> onChangeDayStart(idx, Number((e.target as HTMLSelectElement).value))}>
                  {timeOptions.slice(0,-1).map(opt => (
                    <option key={opt.idx} value={opt.idx}>{opt.label}</option>
                  ))}
                </select>
                <span>–</span>
                <select className="border rounded px-1 py-0.5" value={dayEnd[idx]} onChange={e=> onChangeDayEnd(idx, Number((e.target as HTMLSelectElement).value))}>
                  {timeOptions.slice(1).map(opt => (
                    <option key={opt.idx} value={opt.idx}>{opt.label}</option>
                  ))}
                </select>
                <button className="text-xs underline" onClick={()=> toggleDay(idx, true)}>All</button>
                <button className="text-xs underline" onClick={()=> toggleDay(idx, false)}>None</button>
              </div>
            </div>
          ))}
          {hours.map(h => (
            <>
              <div key={`h-${h}`} className="text-[10px] text-gray-600 border-t py-1 pr-2 text-right">{String(h).padStart(2,'0')}:00</div>
              {Array.from({length:7}, (_,d)=> d).map(d => (
                <div key={`c-${h}-${d}`} className="border-t">
                  <div className="grid grid-rows-2">
                    {[0,1].map(part => {
                      const s = h*2 + part;
                      const allowed = s >= dayStart[d] && s < dayEnd[d];
                      const active = grid[d][s];
                      return (
                        <div
                          key={`s-${d}-${s}`}
                          onMouseDown={()=> allowed && handleMouseDown(d,s)}
                          onMouseEnter={()=> allowed && handleMouseEnter(d,s)}
                          onMouseUp={handleMouseUp}
                          className={`h-5 md:h-6 ${allowed? 'cursor-pointer' : 'cursor-not-allowed opacity-30'} ${active? 'bg-blue-600':'hover:bg-gray-100'}`}
                          title={`${String(h).padStart(2,'0')}:${part? '30':'00'}`}
                        />
                      );
                    })}
                  </div>
                </div>
              ))}
            </>
          ))}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="px-3 py-2 rounded border" onClick={clearAll}>Clear all</button>
        <button className="px-3 py-2 rounded bg-black text-white" onClick={()=> onSave(grid)}>Save weekly hours</button>
      </div>
    </div>
  );
}

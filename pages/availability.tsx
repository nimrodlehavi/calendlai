// pages/availability.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import AuthGuard from "../components/AuthGuard";
import Layout from "../components/Layout";
import { supabaseBrowserClient } from "../lib/supabaseBrowserClient";
import { Toast } from "../components/Toast";

type Window = { id: string; day_of_week: number; start_time: string; end_time: string };
type Block = { id: string; start_time: string; end_time: string };

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_OPTIONS = DOW.map((label, idx) => ({ label, value: idx }));

export default function AvailabilityPage() {
   return (
     <AuthGuard redirectTo="/login">
       <Content />
     </AuthGuard>
   );
 }

 function Content() {
   const [userId, setUserId] = useState<string | null>(null);
   const [windows, setWindows] = useState<Window[]>([]);
   const [blocks, setBlocks] = useState<Block[]>([]);
   const [toast, setToast] = useState<{ msg: string; type: "success" | "error" | "info" } | null>(null);
   const [addingWindow, setAddingWindow] = useState(false);
   const [addingBlock, setAddingBlock] = useState(false);

   const windowsByDay = useMemo(() => {
     const map: Record<number, Window[]> = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };
     for (const win of windows) {
       (map[win.day_of_week] ||= []).push(win);
     }
     Object.values(map).forEach((arr) => arr.sort((a, b) => a.start_time.localeCompare(b.start_time)));
     return map;
   }, [windows]);

   useEffect(() => {
     const run = async () => {
       const { data: s } = await supabaseBrowserClient.auth.getUser();
       const id = s.user?.id || null;
       setUserId(id);
       if (!id) return;
       const [{ data: w }, { data: b }] = await Promise.all([
         supabaseBrowserClient.from("availability_windows").select("id, day_of_week, start_time, end_time").eq("user_id", id),
         supabaseBrowserClient.from("blocks").select("id, start_time, end_time").eq("user_id", id).order("start_time", { ascending: true }),
       ]);
       setWindows((w as any) || []);
       setBlocks((b as any) || []);
     };
     run();
   }, []);

   async function handleAddWindow(day: number, start_time: string, end_time: string) {
     if (!userId) return;
     setAddingWindow(true);
     try {
       const { data, error } = await supabaseBrowserClient
         .from("availability_windows")
         .insert({ user_id: userId, day_of_week: day, start_time, end_time })
         .select("id, day_of_week, start_time, end_time")
         .single();
       if (error) throw error;
       setWindows((prev) => [...prev, data as Window]);
       setToast({ msg: "Window added", type: "success" });
     } catch (err: any) {
       setToast({ msg: err.message || "Failed to add window", type: "error" });
     } finally {
       setAddingWindow(false);
     }
   }

   async function deleteWindow(id: string) {
     await supabaseBrowserClient.from("availability_windows").delete().eq("id", id);
     setWindows((prev) => prev.filter((w) => w.id !== id));
   }

   async function addBlock(start: string, end: string) {
     if (!userId) return;
     setAddingBlock(true);
     try {
       const { data, error } = await supabaseBrowserClient
         .from("blocks")
         .insert({ user_id: userId, start_time: start, end_time: end })
         .select("id, start_time, end_time")
         .single();
       if (error) throw error;
       setBlocks((prev) => [...prev, data as Block].sort((a, b) => a.start_time.localeCompare(b.start_time)));
       setToast({ msg: "Time blocked", type: "success" });
     } catch (err: any) {
       setToast({ msg: err.message || "Failed to add block", type: "error" });
     } finally {
       setAddingBlock(false);
     }
   }

   async function deleteBlock(id: string) {
     await supabaseBrowserClient.from("blocks").delete().eq("id", id);
     setBlocks((prev) => prev.filter((b) => b.id !== id));
   }

   return (
     <Layout>
       <div className="space-y-8">
         <header className="flex flex-wrap items-center justify-between gap-3">
           <div>
             <h1 className="text-2xl font-semibold text-slate-50">Availability</h1>
             <p className="text-sm text-slate-300">Shape the rhythm your AI co-pilot can optimize.</p>
           </div>
           <span className="text-xs font-medium text-slate-300">{windows.length} window{windows.length === 1 ? "" : "s"}</span>
         </header>

         <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
           <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
             <header className="flex flex-wrap items-center justify-between gap-3">
               <div>
                 <h2 className="text-lg font-semibold text-slate-100">Weekly hours</h2>
                 <p className="text-xs text-slate-400">Drag across the grid to paint availability.</p>
               </div>
               <span className="rounded-full bg-accent-teal/15 px-4 py-1 text-xs font-semibold text-accent-teal">
                 {windows.length ? "Synced" : "No hours yet"}
               </span>
             </header>
             <div className="mt-6">
               <WeekAvailabilityGrid
                 windows={windows}
                 onSave={async (daySlots) => {
                   if (!userId) return;
                   await supabaseBrowserClient.from("availability_windows").delete().eq("user_id", userId);

                   const rows: any[] = [];
                   for (let d = 0; d < 7; d++) {
                     const slots = daySlots[d] || [];
                     let i = 0;
                     while (i < slots.length) {
                       if (!slots[i]) {
                         i++;
                         continue;
                       }
                       let j = i;
                       while (j < slots.length && slots[j]) j++;
                       const toTime = (idx: number) => {
                         const hour = Math.floor(idx / 2);
                         const minute = idx % 2 ? 30 : 0;
                         return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;
                       };
                       rows.push({
                         user_id: userId,
                         day_of_week: d,
                         start_time: toTime(i),
                         end_time: toTime(j),
                       });
                       i = j;
                     }
                   }

                   if (rows.length) {
                     const { error } = await supabaseBrowserClient.from("availability_windows").insert(rows);
                     if (error) {
                       setToast({ msg: error.message, type: "error" });
                     } else {
                       setToast({ msg: "Weekly hours saved", type: "success" });
                     }
                     const { data: w } = await supabaseBrowserClient
                       .from("availability_windows")
                       .select("id, day_of_week, start_time, end_time")
                       .eq("user_id", userId);
                     setWindows((w as any) || []);
                   } else {
                     setToast({ msg: "Cleared weekly hours", type: "info" });
                     setWindows([]);
                   }
                 }}
               />
             </div>
           </section>

           <section className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6">
          <header>
            <h2 className="text-lg font-semibold text-slate-100">Daily presets</h2>
            <p className="text-xs text-slate-400">Drop in a quick window for any weekday without leaving this view.</p>
          </header>
          <div className="grid gap-4 md:grid-cols-2">
            {DAY_OPTIONS.map(({ value, label }) => (
              <DayPresetCard
                key={value}
                day={value}
                label={label}
                windows={windowsByDay[value]}
                busy={addingWindow}
                onAdd={handleAddWindow}
                onDelete={deleteWindow}
              />
            ))}
          </div>
        </section>
         </div>

         <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
           <header className="flex flex-wrap items-center justify-between gap-3">
             <div>
               <h2 className="text-lg font-semibold text-slate-100">One-off blocks</h2>
               <p className="text-xs text-slate-400">Use this for vacations, travel, or overrides synced to your calendar.</p>
             </div>
           </header>
           <div className="mt-4 space-y-4">
             <AddBlockForm onAdd={addBlock} busy={addingBlock} />
             <ul className="space-y-3 text-sm">
               {blocks.length === 0 ? (
                 <li className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-slate-400">
                   No overrides yet.
                 </li>
               ) : (
                 blocks.map((block) => (
                   <li key={block.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-slate-100">
                     <span>
                       {new Date(block.start_time).toLocaleString()} – {new Date(block.end_time).toLocaleString()}
                     </span>
                     <button
                       onClick={() => deleteBlock(block.id)}
                       className="text-xs font-semibold text-rose-300 hover:text-rose-100"
                     >
                       Remove
                     </button>
                   </li>
                 ))
               )}
             </ul>
           </div>
         </section>

         {toast && <Toast message={toast.msg} type={toast.type} />}
       </div>
     </Layout>
   );
 }

function DayPresetCard({
  day,
  label,
  windows,
  busy,
  onAdd,
  onDelete,
}: {
  day: number;
  label: string;
  windows: Window[];
  busy: boolean;
  onAdd: (day: number, start: string, end: string) => void;
  onDelete: (id: string) => void;
}) {
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");

  const disable = busy || !start || !end || start >= end;

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (disable) return;
          onAdd(day, `${start}:00`, `${end}:00`);
        }}
        className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
      >
        <div className="flex items-center gap-3">
          <p className="text-base font-semibold text-slate-100">{label}</p>
          <span className="text-xs text-slate-400">{windows.length} slot{windows.length === 1 ? "" : "s"}</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs text-slate-400">
            Start
            <input
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="mt-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none transition focus:border-accent-teal/70"
            />
          </label>
          <label className="flex flex-col text-xs text-slate-400">
            End
            <input
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="mt-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none transition focus:border-accent-teal/70"
            />
          </label>
          <button type="submit" className="btn-secondary px-4 py-2 text-xs" disabled={disable}>
            {busy ? "Adding…" : "Add window"}
          </button>
        </div>
      </form>

      {windows.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No recurring windows for this day.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {windows.map((win) => (
            <li
              key={win.id}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2"
            >
              <span className="text-xs font-medium text-slate-100">{formatRange(win.start_time, win.end_time)}</span>
              <button
                onClick={() => onDelete(win.id)}
                className="text-xs font-semibold text-rose-300 hover:text-rose-200"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

 function AddBlockForm({ onAdd, busy }: { onAdd: (start: string, end: string) => void; busy: boolean }) {
   const [start, setStart] = useState("");
   const [end, setEnd] = useState("");

   return (
     <form
       onSubmit={(e) => {
         e.preventDefault();
         if (!start || !end) return;
         onAdd(new Date(start).toISOString(), new Date(end).toISOString());
         setStart("");
         setEnd("");
       }}
       className="grid gap-3 text-sm text-slate-200 md:grid-cols-[1fr_1fr_auto]"
     >
       <label className="space-y-1">
         <span className="text-xs text-slate-400">Start</span>
         <input
           type="datetime-local"
           value={start}
           onChange={(e) => setStart(e.target.value)}
           className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none transition focus:border-accent-teal/70"
         />
       </label>
       <label className="space-y-1">
         <span className="text-xs text-slate-400">End</span>
         <input
           type="datetime-local"
           value={end}
           onChange={(e) => setEnd(e.target.value)}
           className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-slate-100 outline-none transition focus:border-accent-teal/70"
         />
       </label>
       <button type="submit" className="btn-secondary h-full px-5" disabled={!start || !end || busy}>
         {busy ? "Adding…" : "Add block"}
       </button>
     </form>
   );
 }

 function WeekAvailabilityGrid({
   windows,
   onSave,
 }: {
   windows: Window[];
   onSave: (daySlots: boolean[][]) => Promise<void> | void;
 }) {
  const SLOT_COUNT = 48; // 30-min slots
  const toIdx = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);
    return hh * 2 + (mm >= 30 ? 1 : 0);
  };

  const buildGridFromWindows = () => {
    const grid: boolean[][] = Array.from({ length: 7 }, () => Array(SLOT_COUNT).fill(false));
    for (const win of windows) {
      const day = win.day_of_week;
      let start = toIdx(win.start_time.slice(0, 5));
      let end = toIdx(win.end_time.slice(0, 5));
      start = Math.max(0, Math.min(SLOT_COUNT, start));
      end = Math.max(0, Math.min(SLOT_COUNT, end));
      for (let i = start; i < end; i++) grid[day][i] = true;
    }
    return grid;
  };

  const [grid, setGrid] = useState<boolean[][]>(buildGridFromWindows);
  const [isDragging, setIsDragging] = useState(false);
  const [dragState, setDragState] = useState<"on" | "off" | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const visibleRows = useMemo(() => {
    const indices = new Set<number>();
    grid.forEach((daySlots) => {
      daySlots.forEach((value, idx) => {
        if (value) indices.add(idx);
      });
    });
    if (indices.size === 0) {
      return Array.from({ length: SLOT_COUNT }, (_, i) => i);
    }
    const sorted = Array.from(indices).sort((a, b) => a - b);
    const start = Math.max(0, sorted[0] - 2);
    const end = Math.min(SLOT_COUNT, sorted[sorted.length - 1] + 3);
    return Array.from({ length: end - start }, (_, i) => start + i);
  }, [grid]);

  useEffect(() => {
    setGrid(buildGridFromWindows());
  }, [windows]);

  const handleMouseDown = (day: number, slot: number) => {
    setIsDragging(true);
    const nextState = !grid[day][slot];
    setDragState(nextState ? "on" : "off");
    setGrid((prev) => {
      const copy = prev.map((row) => [...row]);
      copy[day][slot] = nextState;
      return copy;
    });
  };

  const handleMouseEnter = (day: number, slot: number) => {
    if (!isDragging || !dragState) return;
    setGrid((prev) => {
      const copy = prev.map((row) => [...row]);
      copy[day][slot] = dragState === "on";
      return copy;
    });
  };

  const handleMouseUp = useCallback(async () => {
    if (!isDragging) return;
    setIsDragging(false);
    setDragState(null);
    try {
      setSaving(true);
      await onSave(grid);
      setStatus("Saved");
      setTimeout(() => setStatus(null), 2000);
    } finally {
      setSaving(false);
    }
  }, [grid, isDragging, onSave]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const up = () => handleMouseUp();
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [handleMouseUp]);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[80px_repeat(7,_minmax(0,_1fr))] text-xs text-slate-300">
          <div className="bg-white/3 px-3 py-2">Time</div>
          {DOW.map((day) => (
            <div key={day} className="bg-white/3 px-3 py-2 text-center font-medium">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[80px_repeat(7,_minmax(0,_1fr))] text-[11px]">
          {visibleRows.map((row) => {
            const hour = Math.floor(row / 2);
            const label = `${String(hour).padStart(2, "0")}:${row % 2 ? "30" : "00"}`;
            return (
              <>
                <div key={`label-${row}`} className="border-t border-white/5 bg-white/3 px-2 py-1 text-right text-slate-400">
                  {row % 2 === 0 ? label : ""}
                 </div>
                 {Array.from({ length: 7 }).map((_, day) => {
                   const active = grid[day][row];
                   return (
                     <div
                       key={`slot-${day}-${row}`}
                       className={`border-t border-white/5 ${day === 0 ? "" : "border-l"} border-white/5`}
                     >
                        <button
                          type="button"
                          onMouseDown={() => handleMouseDown(day, row)}
                          onMouseEnter={() => handleMouseEnter(day, row)}
                          onMouseUp={handleMouseUp}
                          className={`h-5 w-full md:h-6 ${
                            active
                              ? "bg-gradient-to-br from-midnight-400 via-midnight-500 to-accent-teal/40 shadow-[0_0_10px_rgba(45,110,255,0.35)]"
                              : "hover:bg-midnight-500/15"
                          } transition-colors duration-150`}
                          title={`${DOW[day]} ${label}`}
                        />
                     </div>
                   );
                 })}
               </>
             );
           })}
         </div>
       </div>
       <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
        <button
          type="button"
          className="btn-secondary px-5"
          onClick={async () => {
            const emptyGrid = Array.from({ length: 7 }, () => Array(SLOT_COUNT).fill(false));
            setGrid(emptyGrid);
            setSaving(true);
            await onSave(emptyGrid);
            setSaving(false);
            setStatus("Cleared");
            setTimeout(() => setStatus(null), 2000);
          }}
        >
          Clear all
        </button>
         {status ? <span className="text-accent-teal">{status}</span> : null}
         {saving && <span>Saving…</span>}
       </div>
     </div>
   );
 }

 function formatRange(start: string, end: string) {
   const fmt = (value: string) => value.slice(0, 5);
   return `${fmt(start)} – ${fmt(end)}`;
 }

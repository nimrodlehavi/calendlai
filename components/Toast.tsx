"use client";
import { useEffect, useState } from "react";

export function Toast({ message, type = 'info', duration = 2500 }: { message: string; type?: 'info'|'success'|'error'; duration?: number }) {
  const [open, setOpen] = useState(true);
  useEffect(() => { const t = setTimeout(()=> setOpen(false), duration); return ()=> clearTimeout(t); }, [duration]);
  if (!open) return null;
  const color = type === 'success' ? 'bg-green-600' : type === 'error' ? 'bg-red-600' : 'bg-gray-800';
  return (
    <div className={`fixed bottom-4 right-4 text-white px-3 py-2 rounded shadow ${color}`}>{message}</div>
  );
}


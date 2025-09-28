import { createEvent } from 'ics';

export function generateICS({
  startIso,
  endIso,
  summary,
  description,
  attendees,
}: {
  startIso: string;
  endIso: string;
  summary: string;
  description: string;
  attendees: { name?: string; email: string }[];
}) {
  const start = new Date(startIso);
  const end = new Date(endIso);

  const { value, error } = createEvent({
    start: [start.getFullYear(), start.getMonth() + 1, start.getDate(), start.getHours(), start.getMinutes()],
    end: [end.getFullYear(), end.getMonth() + 1, end.getDate(), end.getHours(), end.getMinutes()],
    title: summary,
    description,
    attendees,
  });

  if (error) throw error;
  return value;
}


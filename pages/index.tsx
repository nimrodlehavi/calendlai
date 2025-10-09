export default function Home() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-900/80 px-10 py-16 shadow-floating">
      <span className="absolute right-12 top-12 hidden text-xs font-semibold text-slate-400 md:block">
        Orchestrate every meeting
      </span>
      <div className="relative grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-accent-teal/25 bg-accent-teal/8 px-3 py-1 text-xs font-medium tracking-[0.2em] text-accent-teal">
            AI co-pilot
          </span>
          <h1 className="max-w-xl text-4xl font-semibold leading-tight text-slate-50 md:text-5xl">
            Elevate scheduling with intelligence that learns your rhythm.
          </h1>
          <p className="max-w-lg text-base text-slate-200/80">
            CalendlAI blends predictive availability, smart routing, and effortless automations to give teams the time and focus they deserve.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/event-types"
              className="rounded-full bg-accent-teal px-6 py-3 text-sm font-semibold text-slate-900 shadow-[0_15px_30px_rgba(54,214,214,0.35)] transition hover:bg-accent-teal/90"
            >
              Launch dashboard
            </a>
            <a
              href="/login"
              className="rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-slate-100 transition hover:border-accent-teal/60 hover:bg-accent-teal/10"
            >
              Sign in to explore
            </a>
          </div>
          <dl className="mt-8 grid gap-4 text-sm text-slate-200/70 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold text-slate-400">Predictive slots</dt>
              <dd className="mt-1 text-lg font-semibold text-accent-teal">+38% faster booking</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-400">Unified calendars</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-100">Zero double-bookings</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-400">Trusted by teams</dt>
              <dd className="mt-1 text-lg font-semibold text-slate-100">Scaled scheduling</dd>
            </div>
          </dl>
        </div>
        <div className="hidden rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-card lg:block">
          <header className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-slate-400">AI snapshot</p>
              <p className="text-lg font-semibold text-slate-100">This week</p>
            </div>
            <span className="rounded-full bg-accent-teal/10 px-3 py-1 text-xs font-medium text-accent-teal">Stable flow</span>
          </header>
          <div className="mt-6 space-y-4 text-sm">
            {[
              { day: 'Tue', time: '10:30 - 11:00', label: 'Product Sync', host: 'Maya Lopez' },
              { day: 'Wed', time: '14:00 - 15:00', label: 'Customer Demo', host: 'AI suggests Ariel' },
              { day: 'Thu', time: '09:00 - 09:45', label: 'Hiring Panel', host: 'Balanced across team' },
            ].map((item) => (
              <div key={item.day} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400">{item.day}</p>
                  <p className="text-sm font-semibold text-slate-50">{item.label}</p>
                  <p className="text-xs font-mono text-slate-300">{item.time}</p>
                </div>
                <p className="text-xs text-accent-teal">{item.host}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 rounded-2xl border border-accent-teal/30 bg-accent-teal/5 px-4 py-3 text-xs text-slate-100">
            <p className="font-semibold text-accent-teal">Predictive insight</p>
            <p className="mt-1 text-slate-200/80">Invitees in EST convert 2.1× faster when offered morning slots. Adjusted automatically.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

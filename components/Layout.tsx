import { ReactNode } from "react"

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center">
      <header className="w-full bg-white shadow px-6 py-3">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">CalendlAI</h1>
          <nav className="space-x-4 text-sm">
            <a href="/event-types" className="text-gray-700 hover:text-blue-600">Event Types</a>
            <a href="/bookings" className="text-gray-700 hover:text-blue-600">Bookings</a>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-4xl p-6">{children}</main>
      <footer className="w-full text-center text-xs text-gray-500 py-4">
        © {new Date().getFullYear()} CalendlAI
      </footer>
    </div>
  )
}

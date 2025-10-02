import { ReactNode } from "react"

export default function Layout({ children }: { children: ReactNode }) {
  // Simplified layout container (global header lives in _app.tsx)
  return <main className="w-full max-w-4xl mx-auto p-6">{children}</main>
}

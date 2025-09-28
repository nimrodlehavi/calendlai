"use client"
import Layout from "../components/Layout"
import { signIn, signOut, useSession } from "next-auth/react"

export default function Settings() {
  const { data: session } = useSession()

  return (
    <Layout>
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
        {session ? (
          <>
            <p>Connected as {session.user?.email}</p>
            <button
              onClick={() => signOut()}
              className="bg-red-500 text-white px-3 py-1 rounded"
            >
              Disconnect Google
            </button>
          </>
        ) : (
          <button
            onClick={() => signIn("google")}
            className="bg-blue-600 text-white px-3 py-1 rounded"
          >
            Connect Google Calendar
          </button>
        )}
      </div>
    </Layout>
  )
}

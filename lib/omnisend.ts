import axios from "axios"

const API_KEY = process.env.OMNISEND_API_KEY
const BASE_URL = "https://api.omnisend.com/v3"

export async function sendEmail(to: string, subject: string, html: string) {
  try {
    await axios.post(`${BASE_URL}/emails`, {
      from: { email: "noreply@calendlai.com", name: "CalendlAI" },
      to: [{ email: to }],
      subject,
      html
    }, {
      headers: {
        "X-API-KEY": API_KEY!,
        "Content-Type": "application/json"
      }
    })
  } catch (err: any) {
    console.error("Omnisend error:", err.response?.data || err.message)
  }
}

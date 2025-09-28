import { google } from 'googleapis';

export async function insertGoogleEvent({
  accessToken,
  refreshToken,
  summary,
  description,
  startIso,
  endIso,
  attendees,
}: {
  accessToken: string;
  refreshToken: string;
  summary: string;
  description: string;
  startIso: string;
  endIso: string;
  attendees: { email: string }[];
}) {
  const { OAuth2 } = google.auth;
  const client = new OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });

  const calendar = google.calendar({ version: 'v3', auth: client });
  const res = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: {
      summary,
      description,
      start: { dateTime: startIso },
      end: { dateTime: endIso },
      attendees,
    },
    sendUpdates: 'all',
  });
  return res.data;
}

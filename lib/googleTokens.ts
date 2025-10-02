import { google } from 'googleapis';
import { supabaseServiceClient } from './supabaseServiceClient';

export async function getHostGoogleAccessToken(userId: string): Promise<string | null> {
  if (!supabaseServiceClient) return null;
  const { data: cal, error } = await supabaseServiceClient
    .from('calendars')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .maybeSingle();
  if (error || !cal) return null;

  const accessToken: string | null = (cal as any).access_token || null;
  const refreshToken: string | null = (cal as any).refresh_token || null;
  const expiresAt: string | null = (cal as any).expires_at || null;

  const now = Date.now();
  const exp = expiresAt ? new Date(expiresAt).getTime() : 0;

  // If we have a valid token not yet expired (with small buffer), reuse it.
  if (accessToken && exp && exp - now > 60_000) return accessToken;

  // If we have a refresh token, use it to get a fresh access token
  if (refreshToken) {
    const clientId = process.env.GOOGLE_CLIENT_ID as string;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET as string;
    if (!clientId || !clientSecret) return accessToken;

    try {
      const oauth2 = new google.auth.OAuth2(clientId, clientSecret);
      oauth2.setCredentials({ refresh_token: refreshToken });
      const { credentials } = await oauth2.refreshAccessToken();
      const newAccess = credentials.access_token || accessToken;
      const newExpiry = credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : expiresAt;
      // Store the updated token
      await supabaseServiceClient
        .from('calendars')
        .update({ access_token: newAccess, expires_at: newExpiry })
        .eq('user_id', userId)
        .eq('provider', 'google');
      return newAccess || null;
    } catch (e) {
      console.error('Google token refresh failed', e);
      return accessToken; // best effort
    }
  }

  return accessToken;
}


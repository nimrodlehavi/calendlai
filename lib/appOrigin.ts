const rawEnvOrigin = (process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim();
const normalizedEnvOrigin = rawEnvOrigin ? rawEnvOrigin.replace(/\/$/, '') : '';

export function getAppOrigin() {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return normalizedEnvOrigin || 'http://localhost:3000';
}

export function buildRedirectUrl(path: string = '/') {
  const origin = getAppOrigin();
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

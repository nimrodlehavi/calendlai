export function magicLinkEmailHTML({ brand = 'CalendlAI', link }: { brand?: string; link: string }) {
  return `
  <div style="font-family:Inter,Segoe UI,Arial,sans-serif;line-height:1.6;color:#111">
    <div style="max-width:520px;margin:24px auto;padding:24px;border:1px solid #eee;border-radius:12px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <div style="font-weight:700;font-size:18px">${brand}</div>
      </div>
      <h1 style="font-size:18px;margin:0 0 8px">Sign in to ${brand}</h1>
      <p style="margin:0 0 16px">Click the button below to sign in securely. This link will expire shortly and can only be used once.</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#111;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;display:inline-block">Sign in</a>
      </p>
      <p style="font-size:12px;color:#666">If the button doesn’t work, copy and paste this link into your browser:</p>
      <p style="word-break:break-all;font-size:12px;color:#444">${link}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
      <p style="font-size:12px;color:#777;margin:0">If you didn’t request this, you can safely ignore this email.</p>
    </div>
  </div>`;
}


// Admin tekshiruvi uchun yagona joy. Admin username'ini shu yerda o'zgartiring.
export const ADMIN_USERNAME = 'username';

export function parseSession(cookieHeader) {
    if (!cookieHeader) return null;
    const part = cookieHeader.split(';').map(p => p.trim()).find(p => p.startsWith('session_token='));
    if (!part) return null;
    const raw = part.slice('session_token='.length);
    try { return JSON.parse(decodeURIComponent(raw)); } catch {}
    try { return JSON.parse(raw); } catch { return null; }
}

export function isAdmin(req) {
    return parseSession(req.headers.get('cookie'))?.username === ADMIN_USERNAME;
}

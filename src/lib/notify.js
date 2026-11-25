import { Notification } from '../app/api/models/Notification.js';

// Bildirishnoma yaratadi. Shu `key` bilan allaqachon bo'lsa — jim o'tkazib yuboradi.
// Hech qachon xato tashlamaydi: bildirishnoma asosiy amalni buzmasligi kerak.
export async function notify(username, { key, type = 'info', title, message = '', emoji = '🔔', link = '' }) {
    try {
        await Notification.create({ username, key, type, title, message, emoji, link });
    } catch (e) {
        if (e?.code !== 11000) console.error('notify error:', e?.message || e);
    }
}

export async function notifyMany(username, items) {
    for (const item of items) await notify(username, item);
}

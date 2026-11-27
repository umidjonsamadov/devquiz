// Qoida buzarlik turlari (server va client uchun)
export const VIOLATION_TYPES = { copy: 'Nusxalash', screenshot: 'Screenshot' };
export const VIOLATION_SOURCES = { train: 'Train', quiz: 'Quiz', dashboard: 'Dashboard', exam: 'Imtihon' };
export const VIOLATION_METHODS = {
    copy: 'Nusxalash buyrug\'i',
    cut: 'Qirqib olish',
    printscreen: 'PrintScreen tugmasi',
    shortcut: 'Screenshot tugmalari',
    'win-shift': 'Win+Shift bosib oynadan chiqish',
    'ctrl-shift': 'Ctrl+Shift bosib oynadan chiqish (gumon)',
    print: 'Chop etish (PDF)',
    'long-press': 'Telefonda matnni bosib turish (gumon)',
    'three-finger': 'Telefonda 3 barmoqli screenshot imo-ishorasi (gumon)',
};

const REPEAT_MS = 1500; // bitta harakat bir nechta hodisa beradi, ular bir marta sanaladi
const recent = new Map();

/** Urinishni jimgina serverga yozadi: o'quvchiga hech narsa ko'rsatilmaydi */
export function reportViolation({ source, type, method, itemId = '', examId = '', context = '' }) {
    const key = `${source}:${itemId}:${type}`;
    const now = Date.now();
    if (now - (recent.get(key) || 0) < REPEAT_MS) return;
    recent.set(key, now);
    fetch('/api/violations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, type, method, itemId, examId, context }),
        keepalive: true,
    }).catch(() => {});
}

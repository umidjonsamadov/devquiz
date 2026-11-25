// Soniyani "2 soat 15 daq" ko'rinishiga o'tkazadi
export function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    if (s < 60) return s > 0 ? `${s} soniya` : '0 daq';
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    if (days > 0) return `${days} kun ${hours} soat`;
    if (hours > 0) return `${hours} soat ${mins} daq`;
    return `${mins} daq`;
}

// Oxirgi signal 90 soniyadan yangi bo'lsa — hozir online
export function isOnlineNow(lastSeen) {
    return !!lastSeen && Date.now() - new Date(lastSeen).getTime() < 90 * 1000;
}

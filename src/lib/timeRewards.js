// Saytda o'tkazilgan vaqt uchun mukofotlar (server tomonida tekshiriladi)

export const TIME_REWARDS = [
    // Kunlik
    { id: 'd15',   period: 'day',   minutes: 15,   xp: 10,   title: 'Isinish',          emoji: '🔥' },
    { id: 'd30',   period: 'day',   minutes: 30,   xp: 25,   title: 'Diqqatli',         emoji: '🎧' },
    { id: 'd60',   period: 'day',   minutes: 60,   xp: 60,   title: 'Bir soatlik jang', emoji: '⚔️' },
    { id: 'd120',  period: 'day',   minutes: 120,  xp: 120,  title: 'Marafonchi',       emoji: '🏃' },
    // Haftalik
    { id: 'w120',  period: 'week',  minutes: 120,  xp: 50,   title: 'Hafta boshlandi',  emoji: '📅' },
    { id: 'w300',  period: 'week',  minutes: 300,  xp: 150,  title: 'Izchil hafta',     emoji: '💪' },
    { id: 'w600',  period: 'week',  minutes: 600,  xp: 400,  title: 'Hafta qahramoni',  emoji: '🦸' },
    // Oylik
    { id: 'm480',  period: 'month', minutes: 480,  xp: 200,  title: 'Oy boshlovchisi',  emoji: '🌙' },
    { id: 'm1200', period: 'month', minutes: 1200, xp: 600,  title: 'Oy jangchisi',     emoji: '🛡️' },
    { id: 'm2400', period: 'month', minutes: 2400, xp: 1500, title: 'Oy afsonasi',      emoji: '🌟' },
    // Umrbod yutuqlar (unvonlar)
    { id: 't60',   period: 'life',  minutes: 60,   xp: 50,   title: "Yangi do'st",      emoji: '🌱' },
    { id: 't300',  period: 'life',  minutes: 300,  xp: 150,  title: 'Qiziquvchi',       emoji: '🔍' },
    { id: 't600',  period: 'life',  minutes: 600,  xp: 300,  title: "Sodiq o'quvchi",   emoji: '📚' },
    { id: 't1500', period: 'life',  minutes: 1500, xp: 750,  title: 'Bilim ovchisi',    emoji: '🎯' },
    { id: 't3000', period: 'life',  minutes: 3000, xp: 1500, title: 'Quiz ustasi',      emoji: '🏆' },
    { id: 't6000', period: 'life',  minutes: 6000, xp: 3000, title: 'Afsona',           emoji: '👑' },
];

const pad = n => String(n).padStart(2, '0');
export const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function startOfToday(now = new Date()) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d;
}

// Hafta dushanbadan boshlanadi
export function startOfWeek(now = new Date()) {
    const d = startOfToday(now);
    const dow = (d.getDay() + 6) % 7; // Du=0 ... Ya=6
    d.setDate(d.getDate() - dow);
    return d;
}

// Har bir davr uchun kalit: shu davr tugasa, mukofotni yana olish mumkin bo'ladi
export function periodKeys(now = new Date()) {
    return {
        day:   ymd(startOfToday(now)),
        week:  ymd(startOfWeek(now)),
        month: `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,
        life:  'all',
    };
}

export const claimKey = (reward, keys) => `${reward.period}:${keys[reward.period]}:${reward.id}`;

// timeLog: [{ date, seconds }], total: user.timeSpent
export function computeSeconds(user, now = new Date()) {
    const today = startOfToday(now).getTime();
    const weekStart = startOfWeek(now).getTime();
    const month = now.getMonth();
    const year = now.getFullYear();
    let day = 0, week = 0, monthSec = 0;
    for (const e of user.timeLog || []) {
        const d = new Date(e.date);
        const t = d.getTime();
        const s = e.seconds || 0;
        if (t === today) day += s;
        if (t >= weekStart) week += s;
        if (d.getFullYear() === year && d.getMonth() === month) monthSec += s;
    }
    return { day, week, month: monthSec, life: user.timeSpent || 0 };
}

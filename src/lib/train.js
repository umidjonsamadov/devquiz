// Train bo'limi sozlamalari va umumiy funksiyalar (server va client uchun).

// "Level 5 dan oshgandan keyin" ochiladi, masala qo'shish uchun "level 7 dan baland" kerak.
export const TRAIN_LEVEL = 6;
export const CREATE_LEVEL = 8;

export const LANGUAGES = { javascript: 'JavaScript', python: 'Python' };

// XP faqat qiyinlikka qarab beriladi — masala muallifi uni o'zi belgilay olmaydi
export const DIFFICULTY = {
    Easy:   { label: 'Oson',  xp: 25, cls: 'text-green-400 bg-green-900/20 border-green-900/40' },
    Medium: { label: "O'rta", xp: 50, cls: 'text-yellow-400 bg-yellow-900/20 border-yellow-900/40' },
    Hard:   { label: 'Qiyin', xp: 100, cls: 'text-red-400 bg-red-900/20 border-red-900/40' },
};

export const MAX_TESTS = 30;

// Ikkala tilda ham o'zgaruvchi/funksiya nomi bo'la oladigan ko'rinish.
// functionName ishga tushiriladigan kod ichiga qo'yiladi, shuning uchun bu tekshiruv majburiy.
export const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,49}$/;

/** `level` darajaga yetish uchun kerak bo'ladigan jami XP */
export function xpForLevel(level) {
    return (500 * level * (level - 1)) / 2;
}

export function starterCode(language, functionName, params = []) {
    const args = params.join(', ');
    return language === 'python'
        ? `def ${functionName}(${args}):\n    # yechimingizni shu yerga yozing\n    pass\n`
        : `function ${functionName}(${args}) {\n  // yechimingizni shu yerga yozing\n}\n`;
}

// ───────────── Statistika (brauzer vaqt mintaqasida) ─────────────

export function dayKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function daysAgo(n) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d;
}

/** Oxirgi `days` kun, eskisidan bugungacha: { date, solved, xp, attempts } */
export function dailySeries(solves, submissions, days) {
    const series = Array.from({ length: days }, (_, i) => ({ date: daysAgo(days - 1 - i), solved: 0, xp: 0, attempts: 0 }));
    const byKey = new Map(series.map(d => [dayKey(d.date), d]));
    for (const s of solves) {
        const d = byKey.get(dayKey(s.solvedAt));
        if (d) { d.solved += 1; d.xp += s.xp + (s.bonusXp || 0); } // haqiqatan olingan XP
    }
    for (const s of submissions) {
        const d = byKey.get(dayKey(s.at));
        if (d) d.attempts += 1;
    }
    return series;
}

/** Ketma-ket masala yechilgan kunlar: { current, best } */
export function solveStreaks(solves) {
    const keys = new Set(solves.map(s => dayKey(s.solvedAt)));

    // Bugun hali yechilmagan bo'lsa, streak kechagacha bo'lganidan sanaladi
    let current = 0;
    for (let i = keys.has(dayKey(daysAgo(0))) ? 0 : 1; keys.has(dayKey(daysAgo(i))); i++) current++;

    const days = [...new Set(solves.map(s => {
        const d = new Date(s.solvedAt);
        return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
    }))].sort((a, b) => a - b);
    let best = 0, run = 0;
    days.forEach((day, i) => {
        run = i > 0 && day - days[i - 1] === 1 ? run + 1 : 1;
        best = Math.max(best, run);
    });
    return { current, best };
}

export function deepEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a), kb = Object.keys(b);
    if (ka.length !== kb.length) return false;
    return ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEqual(a[k], b[k]));
}

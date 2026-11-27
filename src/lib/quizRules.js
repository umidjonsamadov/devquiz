// Quiz library qoidalari (server va client uchun)

export const MAIN_LIMIT = 31;    // asosiy library sig'imi
export const EXTRA_LIMIT = 999;  // qo'shimcha library sig'imi
export const MAX_SOLVES = 3;     // user savolni shuncha marta yechgach, unga boshqa ko'rinmaydi
export const QUIZ_SIZE = 31;     // bitta quizdagi savollar soni

export const EXTRA_SUFFIX = "qo'shimcha";

// Bitta savoldan olinadigan XP (quiz va Train uchun bir xil chegara)
export const XP_MIN = 25;
export const XP_MAX = 100;
export const XP_BY_DIFFICULTY = { Easy: 25, Medium: 50, Hard: 100 };

export const isValidXp = (xp) => Number.isInteger(xp) && xp >= XP_MIN && xp <= XP_MAX;

/** Eski yoki chegaradan tashqari qiymatni moslaydi: past bo'lsa qiyinlik bo'yicha, baland bo'lsa XP_MAX */
export function normalizeXp(xp, difficulty) {
    if (xp > XP_MAX) return XP_MAX;
    return xp >= XP_MIN ? Math.round(xp) : XP_BY_DIFFICULTY[difficulty] ?? XP_MIN;
}

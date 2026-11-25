// Yutuqlar ro'yxati (server tomonida bildirishnoma yuborish uchun).
// Profil sahifasidagi yutuqlar bilan bir xil shartlar.

export function computeLevel(xp) {
    let level = 1, acc = 0;
    while (acc + level * 500 <= xp) { acc += level * 500; level++; }
    return level;
}

export function snapshot(user) {
    const xp = user.xp || 0;
    return {
        xp,
        level: computeLevel(xp),
        questionsSolved: user.questionsSolved || 0,
        correctAnswers: user.correctAnswers || 0,
        dayStreak: user.dayStreak || 0,
        timeSpent: user.timeSpent || 0,
    };
}

const accuracy = s => (s.questionsSolved > 0 ? (s.correctAnswers / s.questionsSolved) * 100 : 0);

export const ACHIEVEMENTS = [
    { id: 'first',   label: 'Birinchi Qadam', desc: '1 ta savol yechildi',      emoji: '⭐',  check: s => s.questionsSolved >= 1 },
    { id: 'ten',     label: 'Quiz Jangchisi', desc: '10 ta savol yechildi',     emoji: '🏅',  check: s => s.questionsSolved >= 10 },
    { id: 'hundred', label: 'Yuzlik',         desc: '100 ta savol yechildi',    emoji: '🎖️', check: s => s.questionsSolved >= 100 },
    { id: 'xp100',   label: 'XP Ovchisi',     desc: "100 XP to'plandi",         emoji: '⚡',  check: s => s.xp >= 100 },
    { id: 'xp1000',  label: 'XP Qiroli',      desc: "1000 XP to'plandi",        emoji: '👑',  check: s => s.xp >= 1000 },
    { id: 'streak3', label: 'Olov!',          desc: '3 kunlik streak',          emoji: '🔥',  check: s => s.dayStreak >= 3 },
    { id: 'sharp',   label: 'Aniq Nishon',    desc: "80%+ to'g'ri (5+ savol)",  emoji: '🎯',  check: s => accuracy(s) >= 80 && s.questionsSolved >= 5 },
    { id: 'lvl5',    label: 'Veteran',        desc: 'Level 5 ga yetildi',       emoji: '🏆',  check: s => s.level >= 5 },
    { id: 'time1h',  label: 'Sodiq',          desc: 'Saytda 1 soat',            emoji: '⏱️', check: s => s.timeSpent >= 3600 },
    { id: 'time10h', label: "O'jar",          desc: 'Saytda 10 soat',           emoji: '📖',  check: s => s.timeSpent >= 36000 },
];

export const STREAK_MILESTONES = [7, 14, 30, 100];

// before/after oralig'ida YANGI ochilgan yutuqlar uchun bildirishnoma ma'lumotlari
export function achievementNotifications(before, after) {
    return ACHIEVEMENTS
        .filter(a => a.check(after) && !a.check(before))
        .map(a => ({
            key: `ach:${a.id}`, type: 'achievement', emoji: a.emoji, link: '/user',
            title: `Yangi yutuq: ${a.label}`, message: a.desc,
        }));
}

export function levelNotification(before, after) {
    if (after.level <= before.level) return [];
    return [{
        key: `lvl:${after.level}`, type: 'level', emoji: '🚀', link: '/user',
        title: `Level ${after.level} ga chiqdingiz!`, message: 'Tabriklaymiz, davom eting!',
    }];
}

export function streakNotifications(before, after) {
    return STREAK_MILESTONES
        .filter(m => before.dayStreak < m && after.dayStreak >= m)
        .map(m => ({
            key: `streak:${m}`, type: 'streak', emoji: '🔥', link: '/user',
            title: `${m} kunlik streak!`, message: `Ketma-ket ${m} kun faol bo'ldingiz`,
        }));
}

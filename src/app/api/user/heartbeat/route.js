import { connectDB } from '../../config/mongodb.js';
import { User } from '../../models/User.js';
import { parseSession } from '../../config/adminAuth.js';
import {
    startOfToday, TIME_REWARDS, periodKeys, claimKey, computeSeconds,
} from '../../../../lib/timeRewards.js';
import { notifyMany } from '../../../../lib/notify.js';
import { snapshot, achievementNotifications } from '../../../../lib/achievements.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

const MIN_GAP_MS = 20 * 1000;  // bundan tez kelgan signal (masalan, 2-tab) hisobga olinmaydi
const MAX_GAP_MS = 90 * 1000;  // bundan uzoq tanaffus = yangi sessiya, tanaffus vaqti qo'shilmaydi

// Klient sahifa ochiq turganda har ~30 soniyada chaqiradi.
// Oxirgi signaldan beri o'tgan vaqt (cheklangan) timeSpent ga qo'shiladi.
export async function POST(req) {
    try {
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        await connectDB();

        const user = await User.findOne({ username: session.username }).select('lastSeen timeSpent');
        if (!user) return json({ message: 'Topilmadi' }, 404);

        const now = Date.now();
        const last = user.lastSeen ? new Date(user.lastSeen).getTime() : 0;
        const gap = now - last;

        if (last && gap < MIN_GAP_MS) return json({ ok: true, timeSpent: user.timeSpent || 0 });

        const addSeconds = last && gap <= MAX_GAP_MS ? Math.round(gap / 1000) : 0;
        await User.updateOne(
            { _id: user._id },
            { $inc: { timeSpent: addSeconds }, $set: { lastSeen: new Date(now) } }
        );

        // Bugungi kun hisobiga ham qo'shamiz (kunlik/haftalik/oylik mukofotlar uchun)
        if (addSeconds > 0) {
            const today = startOfToday(new Date(now));
            const inc = await User.updateOne(
                { _id: user._id, 'timeLog.date': today },
                { $inc: { 'timeLog.$.seconds': addSeconds } }
            );
            if (inc.matchedCount === 0) {
                await User.updateOne(
                    { _id: user._id, 'timeLog.date': { $ne: today } },
                    { $push: { timeLog: { $each: [{ date: today, seconds: addSeconds }], $slice: -40 } } }
                );
            }

            // ── Bildirishnomalar: shu signalda yangi chegaradan o'tilgan bo'lsa ──
            try {
                const fresh = await User.findOne({ _id: user._id })
                    .select('timeSpent timeLog claimedTimeRewards xp questionsSolved correctAnswers dayStreak').lean();
                if (fresh) {
                    const nowDate = new Date(now);
                    const keys = periodKeys(nowDate);
                    const seconds = computeSeconds(fresh, nowDate);
                    const claimed = new Set(fresh.claimedTimeRewards || []);

                    const items = [];
                    for (const r of TIME_REWARDS) {
                        const s = seconds[r.period];
                        const target = r.minutes * 60;
                        if (s >= target && s - addSeconds < target && !claimed.has(claimKey(r, keys))) {
                            items.push({
                                key: `trw:${claimKey(r, keys)}`, type: 'reward', emoji: r.emoji, link: '/dashboard',
                                title: `Mukofot tayyor: ${r.title}`,
                                message: `Dashboard'da +${r.xp} XP ni olishingiz mumkin`,
                            });
                        }
                    }
                    const after = snapshot(fresh);
                    const beforeSnap = { ...after, timeSpent: after.timeSpent - addSeconds };
                    items.push(...achievementNotifications(beforeSnap, after));
                    if (items.length) await notifyMany(session.username, items);
                }
            } catch (err) {
                console.error('Heartbeat notify error:', err);
            }
        }
        return json({ ok: true, timeSpent: (user.timeSpent || 0) + addSeconds });
    } catch (e) {
        console.error('Heartbeat error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

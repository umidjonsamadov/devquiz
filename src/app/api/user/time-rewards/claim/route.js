import { connectDB } from '../../../config/mongodb.js';
import { User } from '../../../models/User.js';
import { parseSession } from '../../../config/adminAuth.js';
import {
    TIME_REWARDS, periodKeys, claimKey, computeSeconds, startOfToday,
} from '../../../../../lib/timeRewards.js';

import { notify } from '../../../../../lib/notify.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

function computeLevel(xp) {
    let level = 1, acc = 0;
    while (acc + level * 500 <= xp) { acc += level * 500; level++; }
    return level;
}

// Body: { id } — mukofot vaqt sharti bajarilgan bo'lsa XP beradi (har davrda bir marta)
export async function POST(req) {
    try {
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        const { id } = await req.json();
        const reward = TIME_REWARDS.find(r => r.id === id);
        if (!reward) return json({ message: "Noto'g'ri mukofot" }, 400);

        await connectDB();
        const user = await User.findOne({ username: session.username })
            .select('timeSpent timeLog').lean();
        if (!user) return json({ message: 'Topilmadi' }, 404);

        const now = new Date();
        const keys = periodKeys(now);
        const seconds = computeSeconds(user, now);
        if (seconds[reward.period] < reward.minutes * 60) {
            return json({ message: 'Vaqt hali yetarli emas' }, 400);
        }

        // Atomik: kalit allaqachon bo'lsa yangilanmaydi — ikki marta olib bo'lmaydi
        const key = claimKey(reward, keys);
        const updated = await User.findOneAndUpdate(
            { _id: user._id, claimedTimeRewards: { $ne: key } },
            { $push: { claimedTimeRewards: key }, $inc: { xp: reward.xp } },
            { new: true }
        ).select('xp dailyXp dailyXpDate claimedTimeRewards');
        if (!updated) return json({ message: 'Bu mukofot allaqachon olingan' }, 409);

        // Level, bugungi XP va eski (o'tgan davr) kalitlarni tozalash
        const today = startOfToday(now);
        const sameDay = updated.dailyXpDate && startOfToday(new Date(updated.dailyXpDate)).getTime() === today.getTime();
        const dailyXp = sameDay ? (updated.dailyXp || 0) + reward.xp : reward.xp;
        const prefixes = [`day:${keys.day}:`, `week:${keys.week}:`, `month:${keys.month}:`, 'life:'];
        const claimedTimeRewards = (updated.claimedTimeRewards || []).filter(k => prefixes.some(p => k.startsWith(p)));

        await User.updateOne(
            { _id: user._id },
            { $set: { level: computeLevel(updated.xp), dailyXp, dailyXpDate: today, claimedTimeRewards } }
        );

        // Level ko'tarilgan bo'lsa bildirishnoma
        const lvlBefore = computeLevel(updated.xp - reward.xp);
        const lvlAfter = computeLevel(updated.xp);
        if (lvlAfter > lvlBefore) {
            await notify(session.username, {
                key: `lvl:${lvlAfter}`, type: 'level', emoji: '🚀', link: '/user',
                title: `Level ${lvlAfter} ga chiqdingiz!`, message: `${reward.title} mukofoti sizni yuqoriga olib chiqdi`,
            });
        }

        return json({ ok: true, xp: reward.xp, totalXp: updated.xp, dailyXp });
    } catch (e) {
        console.error('TimeRewards claim error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

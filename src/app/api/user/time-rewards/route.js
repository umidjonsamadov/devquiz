import { connectDB } from '../../config/mongodb.js';
import { User } from '../../models/User.js';
import { parseSession } from '../../config/adminAuth.js';
import { TIME_REWARDS, periodKeys, claimKey, computeSeconds } from '../../../../lib/timeRewards.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Vaqt statistikasi + barcha mukofotlar holati (progress / olishga tayyor / olingan)
export async function GET(req) {
    try {
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        await connectDB();

        const user = await User.findOne({ username: session.username })
            .select('timeSpent timeLog claimedTimeRewards').lean();
        if (!user) return json({ message: 'Topilmadi' }, 404);

        const now = new Date();
        const keys = periodKeys(now);
        const seconds = computeSeconds(user, now);
        const claimed = new Set(user.claimedTimeRewards || []);

        const rewards = TIME_REWARDS.map(r => {
            const target = r.minutes * 60;
            const progress = Math.min(seconds[r.period], target);
            return {
                id: r.id, period: r.period, title: r.title, emoji: r.emoji, xp: r.xp,
                target, progress,
                reached: seconds[r.period] >= target,
                claimed: claimed.has(claimKey(r, keys)),
            };
        });

        return json({ seconds, rewards });
    } catch (e) {
        console.error('TimeRewards GET error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

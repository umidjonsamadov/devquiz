import { connectDB } from '../config/mongodb.js';
import { User } from '../models/User.js';

export async function GET(req) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            return new Response(JSON.stringify({ message: 'Foydalanuvchi IDsi kerak!' }), { status: 400 });
        }

        const user = await User.findById(userId).select('xp questionsSolved dayStreak joinedAt').lean();
        if (!user) {
            return new Response(JSON.stringify({ message: 'Foydalanuvchi topilmadi!' }), { status: 404 });
        }

        // Rank ni barcha userlarni yuklamasdan hisoblash
        const xp = user.xp ?? 0;
        const [above, tiedBefore] = await Promise.all([
            User.countDocuments({ xp: { $gt: xp } }),
            User.countDocuments({ xp, joinedAt: { $lt: user.joinedAt } }),
        ]);
        const rank = above + tiedBefore + 1;

        const dashboardData = {
            totalXp: user.xp,
            questionsSolved: user.questionsSolved,
            dayStreak: user.dayStreak,
            globalRank: rank,
            weeklyActivity: [
                { day: 'Mon', value: 150 }, { day: 'Tue', value: 250 },
                { day: 'Wed', value: 180 }, { day: 'Thu', value: 350 },
                { day: 'Fri', value: 320 }, { day: 'Sat', value: 450 },
                { day: 'Sun', value: 400 },
            ]
        }

        return new Response(JSON.stringify(dashboardData), { status: 200 });

    } catch (error) {
        console.error('Dashboard error:', error);
        return new Response(JSON.stringify({ message: 'Server xatosi yuz berdi' }), { status: 500 });
    }
}

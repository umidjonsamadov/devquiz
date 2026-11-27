import mongoose from 'mongoose';
import { connectDB } from '../../config/mongodb.js';
import { User } from '../../models/User.js';
import { parseSession } from '../../config/adminAuth.js';
import { computeLevel } from '../../../../lib/achievements.js';
import { trainRanking } from '../ranking.js';
import { json } from '../access.js';

// Reyting sahifasi uchun: Train ochilmagan foydalanuvchilar ham ko'ra oladi
export async function GET(req) {
    try {
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.id || !mongoose.isValidObjectId(session.id)) return json({ message: 'Kirish kerak' }, 401);
        await connectDB();
        const me = await User.findById(session.id).select('username').lean();
        if (!me) return json({ message: 'Kirish kerak' }, 401);

        const params = new URL(req.url).searchParams;
        const page = Math.max(1, parseInt(params.get('page'), 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(params.get('limit'), 10) || 10));

        const ranking = await trainRanking();
        const rows = ranking.slice((page - 1) * limit, page * limit);
        const top = ranking.slice(0, 3);
        const myRow = ranking.find(r => r.username === me.username) || null;
        const users = await User.find({ username: { $in: [...top, ...rows, ...(myRow ? [myRow] : [])].map(r => r.username) } })
            .select('username xp avatarUrl').lean();
        const byName = new Map(users.map(u => [u.username, u]));
        const withProfile = (r) => {
            const u = byName.get(r.username);
            return {
                ...r,
                level: computeLevel(u?.xp || 0),
                // Og'ir base64 o'rniga ommaviy avatar URL
                avatarUrl: u?.avatarUrl ? `/api/avatar/${encodeURIComponent(r.username)}?v=${u.avatarUrl.length}` : null,
            };
        };

        return json({
            total: ranking.length,
            me: me.username,
            myRow: myRow && withProfile(myRow),
            // Bir pog'ona yuqoridagidan o'tish uchun yetishmayotgan ball
            toNext: myRow && myRow.rank > 1 ? ranking[myRow.rank - 2].points - myRow.points : null,
            top: top.map(withProfile),
            ranking: rows.map(withProfile),
        });
    } catch (e) {
        console.error('Train ranking error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

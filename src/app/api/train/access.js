import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import { User } from '../models/User.js';
import { parseSession, ADMIN_USERNAME } from '../config/adminAuth.js';
import { computeLevel } from '../../../lib/achievements.js';
import { TRAIN_LEVEL, CREATE_LEVEL } from '../../../lib/train.js';

export const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

/** Nashr qilinmagan masalani faqat admin va muallif ko'radi */
export const canSee = (problem, access) =>
    problem.published !== false || access.isAdmin || problem.author === access.user.username;

// Level cookie'dan emas, bazadagi XP'dan hisoblanadi. Admin uchun level cheklovi yo'q.
// Qaytaradi: { user, level, isAdmin, canCreate } yoki { error: Response }
export async function trainAccess(req) {
    const session = parseSession(req.headers.get('cookie'));
    if (!session?.id || !mongoose.isValidObjectId(session.id)) {
        return { error: json({ message: 'Kirish kerak' }, 401) };
    }
    await connectDB();
    const user = await User.findById(session.id).select('username xp').lean();
    if (!user) return { error: json({ message: 'Foydalanuvchi topilmadi' }, 401) };

    const isAdmin = user.username === ADMIN_USERNAME;
    const level = computeLevel(user.xp || 0);
    if (!isAdmin && level < TRAIN_LEVEL) {
        return {
            error: json({ message: `Train uchun Level ${TRAIN_LEVEL} kerak`, locked: true, level, xp: user.xp || 0 }, 403),
        };
    }
    return { user, level, isAdmin, canCreate: isAdmin || level >= CREATE_LEVEL };
}

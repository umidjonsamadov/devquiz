import { User } from '../models/User.js';
import { TrainSolve } from '../models/TrainSolve.js';
import { ADMIN_USERNAME } from './adminAuth.js';
import { trainRanking } from '../train/ranking.js';

export const LEADER_MULTIPLIER = 2;

/**
 * XP yoki Train reytingida 1-o'rinda turgan foydalanuvchi XP'ni 2 barobar oladi.
 * Ikkalasida ham birinchi bo'lsa ham koeffitsient 2x (4x emas).
 * XP qo'shilishidan OLDIN chaqirilishi kerak: bonus hozirgi o'ringa qarab beriladi.
 * Hech qachon xato tashlamaydi — bonus aniqlanmasa, oddiy XP beriladi.
 *
 * @returns {Promise<{ multiplier: number, reason: 'xp' | 'train' | null }>}
 */
export async function getXpBoost(username) {
    const none = { multiplier: 1, reason: null };
    if (!username || username === ADMIN_USERNAME) return none;
    try {
        // Leaderboard bilan bir xil tartib
        const top = await User.findOne({ username: { $ne: ADMIN_USERNAME }, xp: { $gt: 0 } })
            .sort({ xp: -1, joinedAt: 1 })
            .select('username')
            .lean();
        if (top?.username === username) return { multiplier: LEADER_MULTIPLIER, reason: 'xp' };

        // Birorta ham masala yechmagan odam uchun butun reytingni hisoblash shart emas
        if (!(await TrainSolve.exists({ username }))) return none;
        const [leader] = await trainRanking();
        return leader?.username === username ? { multiplier: LEADER_MULTIPLIER, reason: 'train' } : none;
    } catch (e) {
        console.error('XP boost error:', e);
        return none;
    }
}

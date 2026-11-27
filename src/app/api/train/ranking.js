import { User } from '../models/User.js';
import { TrainProblem } from '../models/TrainProblem.js';
import { TrainSolve } from '../models/TrainSolve.js';
import { ADMIN_USERNAME } from '../config/adminAuth.js';
import { DIFFICULTY } from '../../../lib/train.js';

/**
 * Yechimlarga qiyinlik va ball qo'shadi. Eski yozuvlarda bu maydonlar yo'q,
 * ular masalaning o'zidan olinadi (masala o'chirilgan bo'lsa yozuv hisobga kirmaydi).
 */
export async function withPoints(solves) {
    const missing = solves.filter(s => !s.difficulty).map(s => s.problemId);
    const problems = missing.length
        ? await TrainProblem.find({ _id: { $in: missing } }).select('difficulty author').lean()
        : [];
    const byId = new Map(problems.map(p => [String(p._id), p]));

    return solves.flatMap(s => {
        if (s.difficulty) return [s];
        const p = byId.get(s.problemId);
        if (!p) return [];
        return [{ ...s, difficulty: p.difficulty, xp: p.author === s.username ? 0 : DIFFICULTY[p.difficulty].xp }];
    });
}

/**
 * Train reytingi: ball → yechilgan masalalar soni → shu natijaga kim oldin erishgani.
 * O'z masalasini yechish (xp = 0) va admin hisobga olinmaydi.
 */
export async function trainRanking() {
    const solves = await withPoints(
        await TrainSolve.find().select('username problemId difficulty xp solvedAt').lean());

    const rows = new Map();
    for (const s of solves) {
        if (!s.xp || s.username === ADMIN_USERNAME) continue;
        const row = rows.get(s.username)
            || { username: s.username, points: 0, solved: 0, Easy: 0, Medium: 0, Hard: 0, last: 0 };
        row.points += s.xp;
        row.solved += 1;
        row[s.difficulty] += 1;
        row.last = Math.max(row.last, new Date(s.solvedAt).getTime());
        rows.set(s.username, row);
    }

    // O'chirilgan foydalanuvchilar reytingda ko'rinmaydi
    const existing = await User.find({ username: { $in: [...rows.keys()] } }).select('username').lean();
    return existing
        .map(u => rows.get(u.username))
        .sort((a, b) => b.points - a.points || b.solved - a.solved || a.last - b.last)
        .map((row, i) => ({ ...row, rank: i + 1 }));
}

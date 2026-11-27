import { TrainProblem } from '../../models/TrainProblem.js';
import { TrainSolve } from '../../models/TrainSolve.js';
import { TrainSubmission } from '../../models/TrainSubmission.js';
import { TrainComment } from '../../models/TrainComment.js';
import { trainAccess, json } from '../access.js';
import { trainRanking, withPoints } from '../ranking.js';

// Joriy foydalanuvchining Train statistikasi.
// Sanalar xom holda qaytariladi: kunlarga brauzer o'z vaqt mintaqasida ajratadi.
export async function GET(req) {
    try {
        const access = await trainAccess(req);
        if (access.error) return access.error;
        const me = access.user.username;

        const since = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
        const [rawSolves, recent, totalSubmissions, accepted, authored, ranking] = await Promise.all([
            TrainSolve.find({ username: me }).select('username problemId difficulty xp bonusXp language solvedAt').sort({ solvedAt: -1 }).lean(),
            TrainSubmission.find({ username: me, createdAt: { $gte: since } }).select('accepted createdAt').lean(),
            TrainSubmission.countDocuments({ username: me }),
            TrainSubmission.countDocuments({ username: me, accepted: true }),
            TrainProblem.find({ author: me }).select('solvedCount viewedBy likedBy dislikedBy').lean(),
            trainRanking(),
        ]);

        const solves = await withPoints(rawSolves);
        const [titles, commentCount] = await Promise.all([
            TrainProblem.find({ _id: { $in: solves.map(s => s.problemId) } }).select('title').lean(),
            TrainComment.countDocuments({ problemId: { $in: authored.map(p => String(p._id)) } }),
        ]);
        const titleById = new Map(titles.map(p => [String(p._id), p.title]));
        const sum = (get) => authored.reduce((total, p) => total + get(p), 0);

        return json({
            solves: solves.map(s => ({
                problemId: s.problemId,
                title: titleById.get(s.problemId) || null, // null — masala o'chirilgan
                difficulty: s.difficulty,
                language: s.language,
                xp: s.xp || 0,
                bonusXp: s.bonusXp || 0,
                solvedAt: s.solvedAt,
            })),
            submissions: recent.map(s => ({ at: s.createdAt, accepted: s.accepted })),
            totals: { submissions: totalSubmissions, accepted },
            rank: ranking.find(r => r.username === me)?.rank || null,
            rankedCount: ranking.length,
            authored: {
                count: authored.length,
                views: sum(p => p.viewedBy?.length || 0),
                likes: sum(p => p.likedBy?.length || 0),
                dislikes: sum(p => p.dislikedBy?.length || 0),
                solved: sum(p => p.solvedCount || 0),
                comments: commentCount,
            },
        });
    } catch (e) {
        console.error('Train stats error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

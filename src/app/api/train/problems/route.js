import { TrainProblem } from '../../models/TrainProblem.js';
import { TrainSolve } from '../../models/TrainSolve.js';
import { TrainSubmission } from '../../models/TrainSubmission.js';
import { TrainComment } from '../../models/TrainComment.js';
import { trainAccess, canSee, json } from '../access.js';
import { ADMIN_USERNAME } from '../../config/adminAuth.js';
import { notify } from '../../../../lib/notify.js';
import { LANGUAGES, DIFFICULTY, MAX_TESTS, IDENTIFIER, CREATE_LEVEL } from '../../../../lib/train.js';

export async function GET(req) {
    try {
        const access = await trainAccess(req);
        if (access.error) return access.error;

        const size = (field) => ({ $size: { $ifNull: [`$${field}`, []] } });
        const since = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);

        const [problems, solves, submissions, comments] = await Promise.all([
            // Username ro'yxatlari yuborilmaydi — faqat ularning soni
            TrainProblem.aggregate([
                { $sort: { createdAt: -1 } },
                { $project: {
                    title: 1, difficulty: 1, languages: 1, author: 1, solvedCount: 1, createdAt: 1, published: 1,
                    views: size('viewedBy'), likes: size('likedBy'), dislikes: size('dislikedBy'),
                } },
            ]),
            TrainSolve.find({ username: access.user.username }).select('problemId xp bonusXp solvedAt').lean(),
            TrainSubmission.find({ username: access.user.username, createdAt: { $gte: since } }).select('createdAt').lean(),
            TrainComment.aggregate([{ $group: { _id: '$problemId', count: { $sum: 1 } } }]),
        ]);
        const solved = new Set(solves.map(s => s.problemId));
        const commentCounts = new Map(comments.map(c => [c._id, c.count]));

        return json({
            // Tekshirilmagan masalaning nomi va muallifi ham yuborilmaydi
            problems: problems.map(p => canSee(p, access)
                ? {
                    ...p,
                    published: p.published !== false,
                    comments: commentCounts.get(String(p._id)) || 0,
                    solved: solved.has(String(p._id)),
                }
                : { _id: p._id, difficulty: p.difficulty, languages: p.languages, comingSoon: true }),
            isAdmin: access.isAdmin,
            // Kunlik statistika uchun (kunlarga brauzer ajratadi)
            daily: {
                solves: solves.map(s => ({ solvedAt: s.solvedAt, xp: s.xp || 0, bonusXp: s.bonusXp || 0 })),
                submissions: submissions.map(s => ({ at: s.createdAt })),
            },
            level: access.level,
            canCreate: access.canCreate,
        });
    } catch (e) {
        console.error('Train list error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// Xato bo'lsa matn, aks holda null
function validate({ title, description, difficulty, languages, functionName, params, testCases }) {
    if (typeof title !== 'string' || !title.trim() || title.trim().length > 120) return 'Sarlavha 1–120 belgi bo\'lishi kerak';
    if (typeof description !== 'string' || !description.trim() || description.length > 5000) return 'Masala sharti 1–5000 belgi bo\'lishi kerak';
    if (!Object.hasOwn(DIFFICULTY, difficulty)) return "Qiyinlik darajasi noto'g'ri";
    if (!Array.isArray(languages) || !languages.length || !languages.every(l => Object.hasOwn(LANGUAGES, l))) return 'Kamida bitta dasturlash tilini tanlang';
    if (typeof functionName !== 'string' || !IDENTIFIER.test(functionName)) return "Funksiya nomi noto'g'ri (lotin harfi, raqam va _)";
    if (!Array.isArray(params) || params.length > 10 || !params.every(p => typeof p === 'string' && IDENTIFIER.test(p))) return "Parametr nomlari noto'g'ri";
    if (new Set(params).size !== params.length) return 'Parametr nomlari takrorlanmasin';
    if (!Array.isArray(testCases) || testCases.length < 2 || testCases.length > MAX_TESTS) return `Testlar soni 2–${MAX_TESTS} ta bo'lishi kerak`;
    if (!testCases.every(t => t && Array.isArray(t.args) && t.args.length === params.length && Object.hasOwn(t, 'expected'))) {
        return 'Har bir testda argumentlar soni parametrlar soniga teng va kutilgan javob bo\'lishi kerak';
    }
    if (!testCases.some(t => !t.hidden)) return "Kamida bitta ochiq (namuna) test bo'lishi kerak";
    if (!testCases.some(t => t.hidden)) return "Kamida bitta yashirin test bo'lishi kerak";
    if (JSON.stringify(testCases).length > 100_000) return 'Testlar hajmi juda katta';
    return null;
}

export async function POST(req) {
    try {
        const access = await trainAccess(req);
        if (access.error) return access.error;
        if (!access.canCreate) return json({ message: `Masala qo'shish uchun Level ${CREATE_LEVEL} kerak` }, 403);

        const body = await req.json();
        const error = validate(body || {});
        if (error) return json({ message: error }, 400);

        const problem = await TrainProblem.create({
            title: body.title.trim(),
            description: body.description.trim(),
            difficulty: body.difficulty,
            languages: [...new Set(body.languages)],
            functionName: body.functionName,
            params: body.params,
            testCases: body.testCases.map(t => ({ args: t.args, expected: t.expected, hidden: !!t.hidden })),
            author: access.user.username,
            published: false,
        });
        if (!access.isAdmin) {
            await notify(ADMIN_USERNAME, {
                key: `train-review:${problem._id}`, emoji: '🧩', title: 'Yangi masala tekshiruvda',
                message: `${access.user.username}: ${problem.title}`, link: `/train/${problem._id}`,
            });
        }
        return json({ id: String(problem._id) }, 201);
    } catch (e) {
        console.error('Train create error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

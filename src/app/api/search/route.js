import { connectDB } from '../config/mongodb.js';
import { Question } from '../models/Question.js';
import { User } from '../models/User.js';

// Admin akkauntlar qidiruvda ko'rinmaydi (leaderboard bilan bir xil)
const HIDDEN_USERS = ['username'];

function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const q = (searchParams.get('q') || '').trim().slice(0, 60);

        if (q.length < 1) {
            return Response.json({ categories: [], questions: [], users: [] });
        }

        await connectDB();
        const rx = new RegExp(escapeRegex(q), 'i');

        const [categories, questions, users] = await Promise.all([
            Question.aggregate([
                { $match: { category: rx } },
                { $group: { _id: '$category', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 6 },
            ]),
            // Faqat savol matni — javob variantlari va to'g'ri javob qaytarilmaydi
            Question.find({ question: rx })
                .select('question category difficulty')
                .limit(5)
                .lean(),
            q.length >= 2
                ? User.find({ username: { $regex: rx, $nin: HIDDEN_USERS } })
                    .select('username xp level avatarUrl avatarColor')
                    .sort({ xp: -1 })
                    .limit(5)
                    .lean()
                : [],
        ]);

        return Response.json(
            {
                categories: categories.map(c => ({ category: c._id, count: c.count })),
                questions: questions.map(x => ({
                    id: String(x._id),
                    question: x.question,
                    category: x.category,
                    difficulty: x.difficulty,
                })),
                users: users.map(u => ({
                    id: String(u._id),
                    username: u.username,
                    xp: u.xp || 0,
                    level: u.level || 1,
                    avatarUrl: u.avatarUrl || null,
                    avatarColor: u.avatarColor || 'green',
                })),
            },
            { headers: { 'Cache-Control': 'private, max-age=15' } }
        );
    } catch (error) {
        console.error('Search error:', error);
        return Response.json({ message: 'Qidiruvda xato' }, { status: 500 });
    }
}

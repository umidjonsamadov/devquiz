import { connectDB } from '../../config/mongodb.js';
import { Question } from '../../models/Question.js';
import { Category } from '../../models/Category.js';
import { parseSession, ADMIN_USERNAME } from '../../config/adminAuth.js';
import { MAIN, EXTRA, userLibrary } from '../../config/questionPool.js';
import { QUIZ_SIZE } from '../../../../lib/quizRules.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ?pool=extra — qo'shimcha library, ?all=1 — library ro'yxati (aks holda quiz uchun tasodifiy savollar)
export async function GET(req, { params }) {
    try {
        const url = new URL(req.url);
        let { category } = await params;
        try { category = decodeURIComponent(category); } catch {}
        category = (category || '').trim();
        if (!category) return json({ message: 'Missing category' }, 400);

        await connectDB();
        const filter = new RegExp(`^${escapeRegExp(category)}$`, 'i');
        const pool = url.searchParams.get('pool') === 'extra' ? 'extra' : 'main';
        const username = parseSession(req.headers.get('cookie'))?.username;

        const admin = username === ADMIN_USERNAME;
        const library = await Category.findOne({ name: filter }).select('published').lean();
        const published = library?.published !== false;
        if (!published && !admin) return json({ message: 'Bu quiz tez orada qo\'shiladi', comingSoon: true }, 403);

        if (pool === 'extra' && username !== ADMIN_USERNAME) return json({ message: "Ruxsat yo'q" }, 403);

        // Admin hamma savolni ko'radi (tahrirlash uchun), unga almashtirish qo'llanmaydi
        let result;
        if (username === ADMIN_USERNAME) {
            const questions = await Question.find({ category: filter, ...(pool === 'extra' ? EXTRA : MAIN) }).lean();
            result = { questions, hidden: 0, replaced: 0 };
        } else {
            result = await userLibrary(filter, pool, username);
        }
        const { questions, hidden, replaced } = result;

        if (url.searchParams.get('all') === '1') {
            const order = { Easy: 0, Medium: 1, Hard: 2 };
            questions.sort((a, b) => (order[a.difficulty] ?? 0) - (order[b.difficulty] ?? 0)
                || new Date(b.createdAt) - new Date(a.createdAt));
            // Nashr tugmasi uchun holat faqat adminga
            return json({ questions, hidden, replaced, ...(admin && library && { library: { id: String(library._id), published } }) });
        }

        for (let i = questions.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [questions[i], questions[j]] = [questions[j], questions[i]];
        }
        return json({ questions: questions.slice(0, QUIZ_SIZE), hidden, replaced });
    } catch (err) {
        console.error('Get category questions error:', err);
        return json({ message: 'Server error' }, 500);
    }
}

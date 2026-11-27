import { connectDB } from '../../config/mongodb.js';
import { Question } from '../../models/Question.js';
import { QuizAttempt } from '../../models/QuizAttempt.js';
import { parseSession, ADMIN_USERNAME } from '../../config/adminAuth.js';
import { recordSolves, unpublishedCategories } from '../../config/questionPool.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Body: { category, answers: [{ questionId, choice }] }  (choice: null = javob berilmagan)
// To'g'ri/noto'g'ri serverda savollar bazasidan hisoblanadi.
export async function POST(req) {
    try {
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        const { category, answers } = await req.json();
        if (!category || !Array.isArray(answers) || answers.length === 0 || answers.length > 200) {
            return json({ message: "Noto'g'ri so'rov" }, 400);
        }
        await connectDB();

        const ids = answers.map(a => String(a.questionId));
        const qs = await Question.find({ _id: { $in: ids } }).lean();
        const closed = new Set(session.username === ADMIN_USERNAME ? [] : await unpublishedCategories());
        const byId = new Map(qs.filter(q => !closed.has(q.category)).map(q => [String(q._id), q]));

        let correct = 0, incorrect = 0, unanswered = 0, xpEarned = 0;
        const saved = [];
        for (const a of answers) {
            const q = byId.get(String(a.questionId));
            if (!q) continue;
            const choice = Number.isInteger(a.choice) ? a.choice : null;
            const isCorrect = choice !== null && choice === q.correctAnswer;
            if (choice === null) unanswered++;
            else if (isCorrect) { correct++; xpEarned += q.xpReward || 0; }
            else incorrect++;
            saved.push({
                questionId: String(q._id), question: q.question, options: q.options,
                choice, correctAnswer: q.correctAnswer, isCorrect,
            });
        }
        if (saved.length === 0) return json({ message: 'Savollar topilmadi' }, 404);

        await QuizAttempt.create({
            username: session.username, category: String(category),
            correct, incorrect, unanswered, xpEarned, answers: saved,
        });
        // Javob berilgan har bir savol "yechildi" deb sanaladi (to'g'ri yoki noto'g'ri)
        await recordSolves(session.username, saved.filter(a => a.choice !== null).map(a => a.questionId));
        return json({ ok: true });
    } catch (e) {
        console.error('QuizAttempt POST error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

import { connectDB } from '../../../../config/mongodb.js';
import { Exam } from '../../../../models/Exam.js';
import { ExamAttempt } from '../../../../models/ExamAttempt.js';
import { isAdmin } from '../../../../config/adminAuth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Admin amaliy masalalarga qo'lda ball qo'yadi.
// Body: { username, grades: { [questionId]: number } }
export async function PUT(req, { params }) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const { id } = await params;
        const { username, grades } = await req.json();
        if (!username || typeof grades !== 'object' || !grades) return json({ message: "Noto'g'ri so'rov" }, 400);
        await connectDB();
        const exam = await Exam.findById(id).lean();
        const attempt = await ExamAttempt.findOne({ exam: id, username });
        if (!exam || !attempt) return json({ message: 'Topilmadi' }, 404);
        if (attempt.status !== 'finished') return json({ message: 'Talaba hali tugatmagan' }, 400);

        const answers = { ...(attempt.answers || {}) };
        for (const q of exam.questions) {
            const qid = String(q._id);
            if (q.type !== 'code' || grades[qid] === undefined || grades[qid] === null || grades[qid] === '') continue;
            const pts = Math.min(q.points, Math.max(0, Number(grades[qid]) || 0));
            answers[qid] = { ...(answers[qid] || {}), earned: Math.round(pts * 100) / 100, graded: true };
        }
        const score = Object.values(answers).reduce((s, a) => s + (Number(a?.earned) || 0), 0);

        attempt.answers = answers;
        attempt.score = Math.round(score * 100) / 100;
        attempt.markModified('answers');
        await attempt.save();
        return json({ attempt });
    } catch (e) {
        console.error('Grade error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

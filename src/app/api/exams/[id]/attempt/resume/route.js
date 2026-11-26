import { connectDB } from '../../../../config/mongodb.js';
import { Exam } from '../../../../models/Exam.js';
import { ExamAttempt } from '../../../../models/ExamAttempt.js';
import { isAdmin } from '../../../../config/adminAuth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const MAX_VIOLATIONS = 3;

// Admin talabaga ishlagan joyidan davom ettirishga ruxsat beradi:
// javoblar va qolgan vaqt saqlanadi, qoidabuzarliklar 0 bo'ladi.
// Body: { username }
export async function PUT(req, { params }) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const { id } = await params;
        const { username } = await req.json();
        if (!username) return json({ message: 'username kerak' }, 400);
        await connectDB();
        const exam = await Exam.findById(id).lean();
        const attempt = await ExamAttempt.findOne({ exam: id, username });
        if (!exam || !attempt) return json({ message: 'Topilmadi' }, 404);

        // 3 ta qoida buzilgan, lekin tab yopilgani uchun yakunlanmay qolgan urinish ham bo'lishi mumkin
        const finished = attempt.status === 'finished';
        if (!finished && attempt.violations < MAX_VIOLATIONS) return json({ message: 'Talaba hali imtihonni ishlayapti' }, 400);

        // Taymer to'xtagan payt
        const byViolations = !finished || attempt.finishReason === 'violations';
        const stoppedAt = (byViolations && attempt.lastViolationAt) || attempt.finishedAt || attempt.savedAt || new Date();
        const elapsed = Math.max(0, new Date(stoppedAt) - new Date(attempt.startedAt));
        if (elapsed >= exam.durationMinutes * 60000) {
            return json({ message: "Imtihon vaqti tugagan, davom ettirib bo'lmaydi. Faqat boshidan topshirishga ruxsat bering." }, 400);
        }

        // Yakunlangan urinishda javoblar answers ichida (eski urinishlarda draft yo'q)
        if (finished) {
            const draft = { answers: {}, code: {} };
            for (const q of exam.questions) {
                const qid = String(q._id);
                const saved = attempt.answers?.[qid];
                if (q.type === 'test') {
                    if (Number.isInteger(saved?.choice)) draft.answers[qid] = saved.choice;
                } else if (saved?.code) {
                    draft.code[qid] = saved.code;
                }
            }
            attempt.draft = draft;
            attempt.markModified('draft');
        }

        attempt.status = 'in_progress';
        attempt.violations = 0;
        attempt.score = 0;
        attempt.answers = {};
        attempt.finishReason = '';
        attempt.finishedAt = undefined;
        attempt.lastViolationAt = undefined;
        attempt.resumeElapsedMs = elapsed;
        attempt.markModified('answers');
        await attempt.save();

        const minutesLeft = Math.ceil((exam.durationMinutes * 60000 - elapsed) / 60000);
        return json({ minutesLeft });
    } catch (e) {
        console.error('Resume error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

import { connectDB } from '../../../../config/mongodb.js';
import { Exam } from '../../../../models/Exam.js';
import { ExamAttempt } from '../../../../models/ExamAttempt.js';
import { isAdmin } from '../../../../config/adminAuth.js';
import { gradeAnswers } from '../../../gradeAnswers.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Admin imtihon ishlayotgan talabani chiqarib yuboradi.
// Shu paytgacha avtomatik saqlangan javoblar natijaga yoziladi.
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
        if (attempt.status !== 'in_progress') return json({ message: 'Talaba imtihonni allaqachon tugatgan' }, 400);

        // Davom ettirishga ruxsat berilgan, lekin talaba hali kirmagan: sarflangan vaqt o'zgarmaydi
        if (attempt.resumeElapsedMs != null) {
            attempt.startedAt = new Date(Date.now() - attempt.resumeElapsedMs);
            attempt.resumeElapsedMs = null;
        }

        const { saved, score } = gradeAnswers(exam, attempt.draft?.answers, attempt.draft?.code);
        attempt.answers = saved;
        attempt.score = score;
        attempt.status = 'finished';
        attempt.finishedAt = new Date();
        attempt.finishReason = 'kicked';
        attempt.markModified('answers');
        await attempt.save();
        return json({ ok: true });
    } catch (e) {
        console.error('Kick error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

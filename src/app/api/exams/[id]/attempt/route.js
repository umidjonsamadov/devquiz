import { connectDB } from '../../../config/mongodb.js';
import { Exam } from '../../../models/Exam.js';
import { ExamAttempt } from '../../../models/ExamAttempt.js';
import { isAdmin, parseSession } from '../../../config/adminAuth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const GRACE_MS = 15000; // tarmoq kechikishi uchun qo'shimcha vaqt

function remainingMs(attempt, exam) {
    return new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60000 - Date.now();
}

// GET: admin -> barcha urinishlar, talaba -> o'zinikini
export async function GET(req, { params }) {
    try {
        const { id } = await params;
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        await connectDB();
        if (isAdmin(req)) {
            const attempts = await ExamAttempt.find({ exam: id }).sort({ finishedAt: -1, startedAt: -1 }).lean();
            return json({ attempts });
        }
        const attempt = await ExamAttempt.findOne({ exam: id, username: session.username }).lean();
        return json({ attempt });
    } catch (e) {
        console.error('Attempt GET error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// POST: imtihonni boshlash (yoki davom ettirish)
export async function POST(req, { params }) {
    try {
        const { id } = await params;
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        await connectDB();
        const exam = await Exam.findById(id).lean();
        if (!exam || !exam.isActive) return json({ message: 'Imtihon mavjud emas' }, 404);

        let attempt = await ExamAttempt.findOne({ exam: id, username: session.username });
        if (attempt?.status === 'finished') return json({ message: 'Siz bu imtihonni topshirgansiz' }, 409);
        if (!attempt) {
            attempt = await ExamAttempt.create({
                exam: id,
                username: session.username,
                maxScore: exam.questions.reduce((s, q) => s + (q.points || 0), 0),
            });
        }
        const left = remainingMs(attempt, exam);
        return json({ attempt: { _id: attempt._id, violations: attempt.violations, remainingMs: Math.max(0, left) } });
    } catch (e) {
        if (e?.code === 11000) return json({ message: 'Urinish allaqachon mavjud' }, 409);
        console.error('Attempt POST error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// PUT: javoblarni yuborib yakunlash. Ball serverda hisoblanadi.
// Body: { answers: { [qid]: number }, code: { [qid]: { code, passed, total } }, violations, reason }
export async function PUT(req, { params }) {
    try {
        const { id } = await params;
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        await connectDB();
        const exam = await Exam.findById(id).lean();
        const attempt = await ExamAttempt.findOne({ exam: id, username: session.username });
        if (!exam || !attempt) return json({ message: 'Urinish topilmadi' }, 404);
        if (attempt.status === 'finished') return json({ attempt }, 200);

        const body = await req.json();
        const answers = body.answers || {};
        const code = body.code || {};
        const late = remainingMs(attempt, exam) < -GRACE_MS;

        let score = 0;
        const saved = {};
        for (const q of exam.questions) {
            const qid = String(q._id);
            if (q.type === 'test') {
                const choice = Number.isInteger(answers[qid]) ? answers[qid] : null;
                const earned = !late && choice === q.correctAnswer ? q.points : 0;
                saved[qid] = { choice, earned };
                score += earned;
            } else {
                // Amaliy masala: kod saqlanadi, ballni admin qo'lda qo'yadi (graded=false)
                const c = code[qid] || {};
                saved[qid] = { code: String(c.code || '').slice(0, 20000), earned: 0, graded: false };
            }
        }

        attempt.answers = saved;
        attempt.score = Math.round(score * 100) / 100;
        attempt.violations = Math.max(attempt.violations, Number(body.violations) || 0);
        attempt.status = 'finished';
        attempt.finishedAt = new Date();
        attempt.finishReason = late ? 'time' : (['time', 'violations'].includes(body.reason) ? body.reason : 'submitted');
        attempt.markModified('answers');
        await attempt.save();
        return json({ attempt });
    } catch (e) {
        console.error('Attempt PUT error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// PATCH: qoidabuzarliklar sonini serverda saqlash
export async function PATCH(req, { params }) {
    try {
        const { id } = await params;
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        await connectDB();
        const { violations } = await req.json();
        await ExamAttempt.updateOne(
            { exam: id, username: session.username, status: 'in_progress' },
            { $max: { violations: Number(violations) || 0 } },
        );
        return json({ ok: true });
    } catch (e) {
        return json({ message: 'Server xatosi' }, 500);
    }
}

// DELETE (admin): talabaga qayta topshirishga ruxsat berish -> urinishni o'chirish
export async function DELETE(req, { params }) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const { id } = await params;
        const username = new URL(req.url).searchParams.get('username');
        if (!username) return json({ message: 'username kerak' }, 400);
        await connectDB();
        await ExamAttempt.deleteOne({ exam: id, username });
        return json({ message: "O'chirildi" });
    } catch (e) {
        return json({ message: 'Server xatosi' }, 500);
    }
}

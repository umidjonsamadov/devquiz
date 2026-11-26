import { connectDB } from '../../../config/mongodb.js';
import { Exam } from '../../../models/Exam.js';
import { ExamAttempt } from '../../../models/ExamAttempt.js';
import { isAdmin, parseSession } from '../../../config/adminAuth.js';
import { gradeAnswers } from '../../gradeAnswers.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const GRACE_MS = 15000; // tarmoq kechikishi uchun qo'shimcha vaqt

function remainingMs(attempt, exam) {
    return new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60000 - Date.now();
}

function cleanDraft(raw, exam) {
    const draft = { answers: {}, code: {} };
    for (const q of exam.questions) {
        const qid = String(q._id);
        if (q.type === 'test') {
            if (Number.isInteger(raw?.answers?.[qid])) draft.answers[qid] = raw.answers[qid];
        } else if (typeof raw?.code?.[qid] === 'string') {
            draft.code[qid] = raw.code[qid].slice(0, 20000);
        }
    }
    return draft;
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
        if (attempt?.status === 'finished') {
            const message = attempt.finishReason === 'kicked' ? 'Siz examdan chiqarib yuborildingiz' : 'Siz bu imtihonni topshirgansiz';
            return json({ message, attempt }, 409);
        }
        if (!attempt) {
            attempt = await ExamAttempt.create({
                exam: id,
                username: session.username,
                maxScore: exam.questions.reduce((s, q) => s + (q.points || 0), 0),
            });
        } else if (attempt.resumeElapsedMs != null) {
            // Taymer talaba qayta kirgan paytdan qolgan joyidan davom etadi
            attempt.startedAt = new Date(Date.now() - attempt.resumeElapsedMs);
            attempt.resumeElapsedMs = null;
            await attempt.save();
        }
        const left = remainingMs(attempt, exam);
        return json({ attempt: { _id: attempt._id, violations: attempt.violations, remainingMs: Math.max(0, left), draft: attempt.draft || null } });
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

        if (attempt.resumeElapsedMs != null) return json({ message: 'Sahifani yangilab, imtihonni davom ettiring' }, 409);

        const body = await req.json();
        const late = remainingMs(attempt, exam) < -GRACE_MS;
        // Kechikkan bo'lsa, vaqtida avtomatik saqlangan javoblar hisobga olinadi
        const fromDraft = late && !!attempt.draft;
        const answers = (fromDraft ? attempt.draft.answers : body.answers) || {};
        const code = fromDraft
            ? attempt.draft.code || {}
            : Object.fromEntries(Object.entries(body.code || {}).map(([k, v]) => [k, v?.code]));
        const { saved, score } = gradeAnswers(exam, answers, code, !late || fromDraft);

        attempt.answers = saved;
        attempt.score = score;
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

// PATCH: qoidabuzarliklar sonini va/yoki ishlangan javoblarni (draft) serverda saqlash
export async function PATCH(req, { params }) {
    try {
        const { id } = await params;
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        await connectDB();
        const { violations, draft } = await req.json();
        const filter = { exam: id, username: session.username, status: 'in_progress', resumeElapsedMs: null };
        const count = Number(violations) || 0;
        if (count > 0) {
            await ExamAttempt.updateOne(
                { ...filter, violations: { $lt: count } },
                { $set: { violations: count, lastViolationAt: new Date() } },
            );
        }
        if (draft) {
            const exam = await Exam.findById(id).lean();
            const attempt = await ExamAttempt.findOne(filter).lean();
            // Vaqt tugagandan keyin javoblarni o'zgartirib bo'lmaydi
            if (!exam || !attempt || remainingMs(attempt, exam) < -GRACE_MS) return json({ ok: false }, 409);
            await ExamAttempt.updateOne(filter, { $set: { draft: cleanDraft(draft, exam), savedAt: new Date() } });
        }
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

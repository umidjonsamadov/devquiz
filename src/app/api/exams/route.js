import { connectDB } from '../config/mongodb.js';
import { Exam } from '../models/Exam.js';
import { ExamAttempt } from '../models/ExamAttempt.js';
import { isAdmin, parseSession } from '../config/adminAuth.js';
import { cleanExamBody } from './cleanExam.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

export async function GET(req) {
    try {
        await connectDB();
        const admin = isAdmin(req);
        const session = parseSession(req.headers.get('cookie'));
        const exams = await Exam.find(admin ? {} : { isActive: true }).sort({ createdAt: -1 }).lean();

        const attempts = session?.username
            ? await ExamAttempt.find({ username: session.username, exam: { $in: exams.map(e => e._id) } }).lean()
            : [];
        const byExam = Object.fromEntries(attempts.map(a => [String(a.exam), a]));

        return json({
            exams: exams.map(e => {
                const a = byExam[String(e._id)];
                return {
                    _id: e._id,
                    title: e.title,
                    description: e.description,
                    durationMinutes: e.durationMinutes,
                    isActive: e.isActive,
                    questionCount: e.questions.length,
                    codeCount: e.questions.filter(q => q.type === 'code').length,
                    totalPoints: e.questions.reduce((s, q) => s + (q.points || 0), 0),
                    attempt: a ? { status: a.status, score: a.score, maxScore: a.maxScore } : null,
                };
            }),
        });
    } catch (e) {
        console.error('Exams GET error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

export async function POST(req) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        await connectDB();
        const data = cleanExamBody(await req.json());
        if (data.error) return json({ message: data.error }, 400);
        const exam = await Exam.create(data.value);
        return json({ exam }, 201);
    } catch (e) {
        console.error('Exams POST error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

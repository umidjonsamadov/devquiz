import { connectDB } from '../../config/mongodb.js';
import { Exam } from '../../models/Exam.js';
import { ExamAttempt } from '../../models/ExamAttempt.js';
import { User } from '../../models/User.js';
import { isAdmin } from '../../config/adminAuth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const r1 = (n) => Math.round(n * 10) / 10;

// Admin: barcha imtihonlar bo'yicha umumiy (jamoaviy) reyting
export async function GET(req) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        await connectDB();
        const [exams, attempts, totalStudents] = await Promise.all([
            Exam.find({}).select('title isActive durationMinutes questions.points questions.type').lean(),
            ExamAttempt.find({ status: 'finished', username: { $ne: 'username' } }).lean(), // admin hisobga olinmaydi
            User.countDocuments({ username: { $ne: 'username' } }),
        ]);

        const examMap = new Map(exams.map((e) => [String(e._id), e]));
        const examStats = new Map(exams.map((e) => [String(e._id), { _id: e._id, title: e.title, isActive: e.isActive, durationMinutes: e.durationMinutes, questionCount: e.questions.length, participants: 0, sum: 0, entries: [] }]));
        const users = new Map();

        for (const a of attempts) {
            const ex = examMap.get(String(a.exam));
            if (!ex) continue; // o'chirilgan imtihon
            const max = a.maxScore || ex.questions.reduce((s, q) => s + (q.points || 0), 0);
            const score = Number(a.score) || 0;
            const percent = max > 0 ? Math.min(100, (score / max) * 100) : 0;
            const pending = ex.questions.some((q) => q.type === 'code' && a.answers?.[String(q._id)] && a.answers[String(q._id)].graded === false
                && String(a.answers[String(q._id)].code || '').trim());

            const es = examStats.get(String(a.exam));
            const minutes = a.finishedAt && a.startedAt ? Math.max(1, Math.round((new Date(a.finishedAt) - new Date(a.startedAt)) / 60000)) : null;
            es.participants++; es.sum += percent;
            es.entries.push({ username: a.username, percent: r1(percent), score: r1(score), max: r1(max), minutes, pending, violations: a.violations || 0, reason: a.finishReason || '' });

            let u = users.get(a.username);
            if (!u) { u = { username: a.username, examsTaken: 0, percentSum: 0, totalScore: 0, totalMax: 0, violations: 0, pending: 0, results: [] }; users.set(a.username, u); }
            u.examsTaken++; u.percentSum += percent; u.totalScore += score; u.totalMax += max;
            u.violations += a.violations || 0; if (pending) u.pending++;
            u.results.push({ examId: String(a.exam), title: ex.title, percent: r1(percent), score: r1(score), max: r1(max) });
        }

        const ranking = [...users.values()].map((u) => ({
            username: u.username,
            examsTaken: u.examsTaken,
            avgPercent: r1(u.percentSum / u.examsTaken),
            totalScore: r1(u.totalScore),
            totalMax: r1(u.totalMax),
            violations: u.violations,
            pending: u.pending,
            results: u.results,
        })).sort((x, y) => y.avgPercent - x.avgPercent || y.totalScore - x.totalScore || x.username.localeCompare(y.username));

        return json({
            totalExams: exams.length,
            totalStudents,
            exams: [...examStats.values()].map((e) => {
                const list = [...e.entries].sort((x, y) => y.percent - x.percent || y.score - x.score);
                const times = list.filter((x) => x.minutes).map((x) => x.minutes);
                const bucket = (lo, hi) => list.filter((x) => x.percent >= lo && x.percent < hi).length;
                return {
                    _id: e._id, title: e.title, isActive: e.isActive,
                    durationMinutes: e.durationMinutes, questionCount: e.questionCount,
                    participants: e.participants,
                    avgPercent: e.participants ? r1(e.sum / e.participants) : 0,
                    bestPercent: list.length ? list[0].percent : 0,
                    worstPercent: list.length ? list[list.length - 1].percent : 0,
                    avgMinutes: times.length ? Math.round(times.reduce((s, x) => s + x, 0) / times.length) : null,
                    pending: list.filter((x) => x.pending).length,
                    violators: list.filter((x) => x.violations > 0).length,
                    distribution: [bucket(0, 55), bucket(55, 70), bucket(70, 90), bucket(90, 101)],
                    entries: list,
                };
            }),
            ranking,
        });
    } catch (e) {
        console.error('Exam ranking error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

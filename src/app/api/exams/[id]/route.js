import { connectDB } from '../../config/mongodb.js';
import { Exam } from '../../models/Exam.js';
import { ExamAttempt } from '../../models/ExamAttempt.js';
import { isAdmin } from '../../config/adminAuth.js';
import { cleanExamBody } from '../cleanExam.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Talabaga to'g'ri javoblarni yubormaymiz
function sanitize(exam) {
    return {
        _id: exam._id,
        title: exam.title,
        description: exam.description,
        durationMinutes: exam.durationMinutes,
        questions: exam.questions.map(q => q.type === 'code'
            ? { _id: q._id, type: 'code', text: q.text, points: q.points, language: q.language || 'javascript', starterCode: q.starterCode }
            : { _id: q._id, type: 'test', text: q.text, points: q.points, options: q.options }),
    };
}

export async function GET(req, { params }) {
    try {
        const { id } = await params;
        await connectDB();
        const exam = await Exam.findById(id).lean();
        if (!exam) return json({ message: 'Imtihon topilmadi' }, 404);
        if (isAdmin(req)) return json({ exam });
        if (!exam.isActive) return json({ message: 'Imtihon faol emas' }, 403);
        return json({ exam: sanitize(exam) });
    } catch (e) {
        console.error('Exam GET error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

export async function PUT(req, { params }) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const { id } = await params;
        await connectDB();
        const data = cleanExamBody(await req.json());
        if (data.error) return json({ message: data.error }, 400);
        const exam = await Exam.findByIdAndUpdate(id, data.value, { new: true });
        if (!exam) return json({ message: 'Imtihon topilmadi' }, 404);
        return json({ exam });
    } catch (e) {
        console.error('Exam PUT error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// PATCH: faqat nashr holatini o'zgartirish (admin)
export async function PATCH(req, { params }) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const { id } = await params;
        const { isActive } = await req.json();
        await connectDB();
        const exam = await Exam.findByIdAndUpdate(id, { isActive: isActive === true }, { new: true });
        if (!exam) return json({ message: 'Imtihon topilmadi' }, 404);
        return json({ exam: { _id: exam._id, isActive: exam.isActive } });
    } catch (e) {
        console.error('Exam PATCH error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

export async function DELETE(req, { params }) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const { id } = await params;
        await connectDB();
        await Exam.findByIdAndDelete(id);
        await ExamAttempt.deleteMany({ exam: id });
        return json({ message: "O'chirildi" });
    } catch (e) {
        console.error('Exam DELETE error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

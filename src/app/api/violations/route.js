import mongoose from 'mongoose';
import { connectDB } from '../config/mongodb.js';
import { User } from '../models/User.js';
import { Question } from '../models/Question.js';
import { Category } from '../models/Category.js';
import { TrainProblem } from '../models/TrainProblem.js';
import { Exam } from '../models/Exam.js';
import { Violation } from '../models/Violation.js';
import { parseSession, isAdmin, ADMIN_USERNAME } from '../config/adminAuth.js';
import { notify } from '../../../lib/notify.js';
import { VIOLATION_TYPES, VIOLATION_SOURCES, VIOLATION_METHODS } from '../../../lib/violations.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
// Yozilsa ham, yozilmasa ham o'quvchiga bir xil bo'sh javob
const silent = () => new Response(null, { status: 204 });
const text = (value, max) => String(value || '').slice(0, max);

// Savol nomi brauzerdan olinmaydi: bazadan o'qiladi. null — yozilmaydi
async function describe({ source, itemId, examId, context }, username) {
    const valid = mongoose.isValidObjectId(itemId);
    if (source === 'train') {
        const p = valid && await TrainProblem.findById(itemId).select('title author').lean();
        return p && p.author !== username ? { itemId, title: p.title, context: '' } : null;
    }
    if (source === 'exam') {
        const exam = mongoose.isValidObjectId(examId) && await Exam.findById(examId).select('title questions._id questions.text').lean();
        const q = exam && exam.questions.find(x => String(x._id) === itemId);
        return q ? { itemId, title: text(q.text, 300), context: exam.title } : null;
    }
    if (source === 'quiz' && !itemId) {
        const library = text(context, 80);
        return library && await Category.exists({ name: library })
            ? { itemId: '', title: 'Quiz sahifasi (aniq savol aniqlanmadi)', context: library }
            : null;
    }
    const q = valid && await Question.findById(itemId).select('question category').lean();
    return q ? { itemId, title: text(q.question, 300), context: q.category } : null;
}

// O'quvchi brauzeri yuboradi: { source, type, method, itemId, examId }
export async function POST(req) {
    try {
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.id || !mongoose.isValidObjectId(session.id)) return silent();
        const body = await req.json();
        const { source, type, method } = body || {};
        if (!Object.hasOwn(VIOLATION_SOURCES, source) || !Object.hasOwn(VIOLATION_TYPES, type)
            || !Object.hasOwn(VIOLATION_METHODS, method)) return silent();

        await connectDB();
        const user = await User.findById(session.id).select('username').lean();
        if (!user || user.username === ADMIN_USERNAME) return silent();

        const item = await describe({ ...body, itemId: text(body.itemId, 40) }, user.username);
        if (!item) return silent();

        const now = new Date();
        const _id = `${session.id}:${source}:${item.itemId || item.context}:${type}`;
        const saved = await Violation.findOneAndUpdate(
            { _id },
            {
                $inc: { count: 1 },
                $addToSet: { methods: method },
                $set: { lastAt: now, title: item.title, context: item.context },
                $setOnInsert: { username: user.username, source, itemId: item.itemId, type, firstAt: now },
            },
            { upsert: true, new: true },
        ).lean();

        // Bildirishnoma har bir savol va tur uchun bir marta; keyingi urinishlar sahifada sanaladi
        if (saved.count === 1) {
            await notify(ADMIN_USERNAME, {
                key: `violation:${_id}`, emoji: '🚨', title: 'Qoida buzarlik',
                message: `${user.username}: ${VIOLATION_TYPES[type].toLowerCase()}, ${VIOLATION_SOURCES[source]} — ${text(item.title, 80)}`,
                link: '/violations',
            });
        }
        return silent();
    } catch (e) {
        console.error('Violation POST error:', e);
        return silent();
    }
}

export async function GET(req) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        await connectDB();
        const violations = await Violation.find().sort({ lastAt: -1 }).limit(2000).lean();
        return json({ violations });
    } catch (e) {
        console.error('Violation GET error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// ?id= bitta yozuvni, ?username= o'quvchining hamma yozuvlarini o'chiradi
export async function DELETE(req) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const params = new URL(req.url).searchParams;
        const id = params.get('id'), username = params.get('username');
        if (!id && !username) return json({ message: "Noto'g'ri so'rov" }, 400);
        await connectDB();
        const { deletedCount } = await Violation.deleteMany(id ? { _id: id } : { username });
        return json({ deletedCount });
    } catch (e) {
        console.error('Violation DELETE error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

import mongoose from 'mongoose';
import { TrainProblem } from '../../../../models/TrainProblem.js';
import { TrainComment } from '../../../../models/TrainComment.js';
import { trainAccess, canSee, json } from '../../../access.js';

const notFound = () => json({ message: 'Masala topilmadi' }, 404);

async function visibleProblem(id, access) {
    if (!mongoose.isValidObjectId(id)) return false;
    const p = await TrainProblem.findById(id).select('published author').lean();
    return !!p && canSee(p, access);
}

export async function GET(req, { params }) {
    try {
        const access = await trainAccess(req);
        if (access.error) return access.error;
        const { id } = await params;
        if (!(await visibleProblem(id, access))) return notFound();

        const comments = await TrainComment.find({ problemId: id }).sort({ createdAt: -1 }).limit(200).lean();
        return json({
            comments: comments.map(c => ({
                _id: c._id, username: c.username, text: c.text, createdAt: c.createdAt,
                canDelete: access.isAdmin || c.username === access.user.username,
            })),
        });
    } catch (e) {
        console.error('Train comments error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

export async function POST(req, { params }) {
    try {
        const access = await trainAccess(req);
        if (access.error) return access.error;
        const { id } = await params;
        if (!(await visibleProblem(id, access))) return notFound();

        const { text } = await req.json();
        if (typeof text !== 'string' || !text.trim() || text.trim().length > 1000) {
            return json({ message: "Izoh 1–1000 belgi bo'lishi kerak" }, 400);
        }

        const c = await TrainComment.create({ problemId: id, username: access.user.username, text: text.trim() });
        return json({
            comment: { _id: c._id, username: c.username, text: c.text, createdAt: c.createdAt, canDelete: true },
        }, 201);
    } catch (e) {
        console.error('Train comment create error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

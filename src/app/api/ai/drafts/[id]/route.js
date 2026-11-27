import mongoose from 'mongoose';
import { connectDB } from '../../../config/mongodb.js';
import { isAdmin } from '../../../config/adminAuth.js';
import { AiDraft } from '../../../models/AiDraft.js';
import { validateDraft } from '../../drafts.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Qo'shishdan oldin qoralamani tahrirlash
export async function PUT(req, { params }) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const { id } = await params;
        const body = await req.json();
        const error = validateDraft(body);
        if (error) return json({ message: error }, 400);
        if (!mongoose.isValidObjectId(id)) return json({ message: 'Savol topilmadi' }, 404);

        await connectDB();
        const draft = await AiDraft.findOneAndUpdate(
            { _id: id, status: 'pending' },
            { $set: {
                question: body.question.trim(),
                options: body.options.map(o => o.trim()),
                correctAnswer: body.correctAnswer,
                difficulty: body.difficulty,
                xpReward: body.xpReward,
                time: body.time,
            } },
            { new: true },
        ).lean();
        return draft ? json({ draft }) : json({ message: 'Savol topilmadi' }, 404);
    } catch (e) {
        console.error('AI draft PUT error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

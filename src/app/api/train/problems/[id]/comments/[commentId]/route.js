import mongoose from 'mongoose';
import { TrainComment } from '../../../../../models/TrainComment.js';
import { trainAccess, json } from '../../../../access.js';

// Izohni muallifi yoki admin o'chira oladi
export async function DELETE(req, { params }) {
    try {
        const access = await trainAccess(req);
        if (access.error) return access.error;
        const { id, commentId } = await params;
        if (!mongoose.isValidObjectId(commentId)) return json({ message: 'Izoh topilmadi' }, 404);

        const filter = { _id: commentId, problemId: id };
        if (!access.isAdmin) filter.username = access.user.username;
        const { deletedCount } = await TrainComment.deleteOne(filter);
        return deletedCount ? json({ ok: true }) : json({ message: "Izoh topilmadi yoki ruxsat yo'q" }, 404);
    } catch (e) {
        console.error('Train comment delete error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

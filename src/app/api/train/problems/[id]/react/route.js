import mongoose from 'mongoose';
import { TrainProblem } from '../../../../models/TrainProblem.js';
import { trainAccess, canSee, json } from '../../../access.js';

// Body: { reaction: 'like' | 'dislike' | null } — bitta odamda faqat bittasi bo'ladi
export async function POST(req, { params }) {
    try {
        const access = await trainAccess(req);
        if (access.error) return access.error;
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return json({ message: 'Masala topilmadi' }, 404);

        const { reaction } = await req.json();
        if (![null, 'like', 'dislike'].includes(reaction)) return json({ message: "Noto'g'ri so'rov" }, 400);

        const target = await TrainProblem.findById(id).select('published author').lean();
        if (!target || !canSee(target, access)) return json({ message: 'Masala topilmadi' }, 404);

        const me = access.user.username;
        const update = {
            like:    { $addToSet: { likedBy: me }, $pull: { dislikedBy: me } },
            dislike: { $addToSet: { dislikedBy: me }, $pull: { likedBy: me } },
            none:    { $pull: { likedBy: me, dislikedBy: me } },
        }[reaction ?? 'none'];

        const p = await TrainProblem.findByIdAndUpdate(id, update, { new: true })
            .select('likedBy dislikedBy').lean();
        if (!p) return json({ message: 'Masala topilmadi' }, 404);

        return json({ likes: p.likedBy?.length || 0, dislikes: p.dislikedBy?.length || 0, myReaction: reaction });
    } catch (e) {
        console.error('Train react error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

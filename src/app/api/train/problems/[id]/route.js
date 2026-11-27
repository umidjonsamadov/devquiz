import mongoose from 'mongoose';
import { TrainProblem } from '../../../models/TrainProblem.js';
import { TrainSolve } from '../../../models/TrainSolve.js';
import { TrainComment } from '../../../models/TrainComment.js';
import { trainAccess, canSee, json } from '../../access.js';
import { notify } from '../../../../../lib/notify.js';

const notFound = () => json({ message: 'Masala topilmadi' }, 404);

export async function GET(req, { params }) {
    try {
        const access = await trainAccess(req);
        if (access.error) return access.error;
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return notFound();

        const found = await TrainProblem.findById(id).lean();
        if (!found) return notFound();
        if (!canSee(found, access)) return json({ message: "Bu masala tez orada qo'shiladi", comingSoon: true }, 403);
        const published = found.published !== false;
        const { viewedBy = [], likedBy = [], dislikedBy = [], ...p } = found;
        const me = access.user.username;

        // Ko'rishlar: har bir odam bir marta, muallifning o'zi sanalmaydi
        let views = viewedBy.length;
        if (published && p.author !== me && !viewedBy.includes(me)) {
            await TrainProblem.updateOne({ _id: id }, { $addToSet: { viewedBy: me } });
            views += 1;
        }

        const [solve, commentCount] = await Promise.all([
            TrainSolve.findById(`${access.user._id}:${id}`).lean(),
            TrainComment.countDocuments({ problemId: id }),
        ]);

        return json({
            // Brauzerdagi qoralama kod har bir akkaunt uchun alohida saqlanadi
            viewerId: String(access.user._id),
            stats: {
                views,
                likes: likedBy.length,
                dislikes: dislikedBy.length,
                comments: commentCount,
                myReaction: likedBy.includes(me) ? 'like' : dislikedBy.includes(me) ? 'dislike' : null,
            },
            isAdmin: access.isAdmin,
            // Admin nashrdan oldin barcha testlarning, yashirinlarining ham javobini tekshiradi
            review: access.isAdmin && !published ? p.testCases : null,
            problem: {
                ...p,
                published,
                // Yashirin testlarning faqat argumentlari yuboriladi: javobni server tekshiradi
                testCases: p.testCases.map(t => t.hidden
                    ? { args: t.args, hidden: true }
                    : { args: t.args, expected: t.expected, hidden: false }),
            },
            solve: solve ? { language: solve.language, code: solve.code } : null,
            canDelete: access.isAdmin || p.author === access.user.username,
        });
    } catch (e) {
        console.error('Train get error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// Body: { published: boolean } — faqat admin nashr qiladi yoki nashrdan oladi
export async function PATCH(req, { params }) {
    try {
        const access = await trainAccess(req);
        if (access.error) return access.error;
        if (!access.isAdmin) return json({ message: "Ruxsat yo'q" }, 403);
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return notFound();

        const { published } = await req.json();
        if (typeof published !== 'boolean') return json({ message: "Noto'g'ri so'rov" }, 400);

        const p = await TrainProblem.findByIdAndUpdate(id, { $set: { published } }, { new: true })
            .select('title author').lean();
        if (!p) return notFound();
        if (published && p.author !== access.user.username) {
            await notify(p.author, {
                key: `train-published:${id}`, emoji: '✅', title: 'Masalangiz nashr qilindi',
                message: p.title, link: `/train/${id}`,
            });
        }
        return json({ published });
    } catch (e) {
        console.error('Train publish error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// Admin yoki masala muallifi o'chira oladi.
// TrainSolve yozuvlari qoladi — XP qayta olinmaydi.
export async function DELETE(req, { params }) {
    try {
        const access = await trainAccess(req);
        if (access.error) return access.error;
        const { id } = await params;
        if (!mongoose.isValidObjectId(id)) return notFound();

        const p = await TrainProblem.findById(id).select('author');
        if (!p) return notFound();
        if (!access.isAdmin && p.author !== access.user.username) return json({ message: "Ruxsat yo'q" }, 403);

        await p.deleteOne();
        await TrainComment.deleteMany({ problemId: id });
        return json({ ok: true });
    } catch (e) {
        console.error('Train delete error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

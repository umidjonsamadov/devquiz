import mongoose from 'mongoose';
import { connectDB } from '../../config/mongodb.js';
import { isAdmin } from '../../config/adminAuth.js';
import { Category } from '../../models/Category.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Body: { id, enabled } — AI shu library uchun savol tuzsinmi
export async function PUT(req) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const { id, enabled } = await req.json();
        if (!mongoose.isValidObjectId(id) || typeof enabled !== 'boolean') return json({ message: "Noto'g'ri so'rov" }, 400);
        await connectDB();
        const { matchedCount } = await Category.updateOne({ _id: id }, { $set: { aiEnabled: enabled } });
        return matchedCount ? json({ ok: true }) : json({ message: 'Library topilmadi' }, 404);
    } catch (e) {
        console.error('AI libraries error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

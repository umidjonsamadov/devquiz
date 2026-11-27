import { connectDB } from '../../config/mongodb.js';
import { isAdmin } from '../../config/adminAuth.js';
import { AiDraft } from '../../models/AiDraft.js';
import { approveDrafts, rejectDrafts } from '../drafts.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Tasdiq kutayotgan savollar
export async function GET(req) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        await connectDB();
        const drafts = await AiDraft.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(500).lean();
        return json({ drafts });
    } catch (e) {
        console.error('AI drafts GET error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// Body: { action: 'approve' | 'reject', ids: string[] }
// "Hammasi" ham aniq ID'lar bilan yuboriladi: admin ko'rmagan yangi savol qo'shilib ketmaydi
export async function POST(req) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const { action, ids } = await req.json();
        if (!['approve', 'reject'].includes(action) || !Array.isArray(ids) || !ids.length || ids.length > 500) {
            return json({ message: "Noto'g'ri so'rov" }, 400);
        }
        await connectDB();
        return json(action === 'approve' ? await approveDrafts(ids) : await rejectDrafts(ids));
    } catch (e) {
        console.error('AI drafts POST error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

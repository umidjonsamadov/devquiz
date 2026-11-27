import { timingSafeEqual } from 'node:crypto';
import { connectDB } from '../../config/mongodb.js';
import { isAdmin } from '../../config/adminAuth.js';
import { Category } from '../../models/Category.js';
import { generateBatch, getTodayRun, stopSession, BATCH } from '../generator.js';

export const maxDuration = 60;

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Jadval bo'yicha ishga tushiruvchi (Netlify scheduled function) maxfiy kalit yuboradi
function hasCronSecret(req) {
    const secret = process.env.CRON_SECRET;
    const given = req.headers.get('x-cron-secret');
    if (!secret || !given) return false;
    const a = Buffer.from(given), b = Buffer.from(secret);
    return a.length === b.length && timingSafeEqual(a, b);
}

// Admin paneli uchun bugungi holat
export async function GET(req) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        await connectDB();
        const [run, libraries] = await Promise.all([
            getTodayRun(),
            Category.find().select('name aiEnabled').sort({ name: 1 }).lean(),
        ]);
        return json({
            libraries: libraries.map(c => ({ id: String(c._id), name: c.name, enabled: !!c.aiEnabled })),
            configured: !!process.env.GEMINI_API_KEY,
            scheduled: !!process.env.CRON_SECRET,
            batch: BATCH,
            run: {
                date: run._id, target: run.target, created: run.created,
                lastRunAt: run.lastRunAt, lastError: run.lastError, log: run.log || [],
            },
        });
    } catch (e) {
        console.error('AI status error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// Ishga tushirish belgisi: admin brauzeri yaratadi, "To'xtatish" shu belgi bo'yicha ishlaydi
const readSession = (req) => {
    const value = new URL(req.url).searchParams.get('session') || '';
    return /^[\w-]{1,64}$/.test(value) ? value : '';
};

export async function DELETE(req) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    const session = readSession(req);
    if (!session) return json({ message: "Noto'g'ri so'rov" }, 400);
    try {
        await connectDB();
        await stopSession(session);
        return json({ status: 'stopped' });
    } catch (e) {
        console.error('AI stop error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// Bitta partiya yaratadi. Kunlik rejadan oshmaydi
export async function POST(req) {
    if (!hasCronSecret(req) && !isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        await connectDB();
        return json(await generateBatch(readSession(req)));
    } catch (e) {
        console.error('AI generate route error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

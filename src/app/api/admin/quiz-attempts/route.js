import { connectDB } from '../../config/mongodb.js';
import { QuizAttempt } from '../../models/QuizAttempt.js';
import { isAdmin } from '../../config/adminAuth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Admin: oxirgi quiz urinishlari (javoblari bilan). ?username= va ?category= bilan filtrlash mumkin.
export async function GET(req) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        await connectDB();
        const sp = new URL(req.url).searchParams;
        const filter = {};
        if (sp.get('username')) filter.username = sp.get('username');
        if (sp.get('category')) filter.category = sp.get('category');
        const attempts = await QuizAttempt.find(filter).sort({ createdAt: -1 }).limit(200).lean();
        return json({ attempts });
    } catch (e) {
        console.error('Admin quiz-attempts error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

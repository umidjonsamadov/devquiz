import { connectDB } from '../../config/mongodb.js';
import { parseSession } from '../../config/adminAuth.js';
import { getXpBoost } from '../../config/xpBoost.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// Header'dagi "2x XP" belgisi uchun
export async function GET(req) {
    try {
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        await connectDB();
        return json(await getXpBoost(session.username));
    } catch (e) {
        console.error('Boost GET error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

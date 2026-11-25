import { connectDB } from '../../config/mongodb.js';
import { User } from '../../models/User.js';

// Ommaviy avatar: /api/avatar/<username> — rasmni binar ko'rinishda qaytaradi
export async function GET(req, { params }) {
    try {
        const { username } = await params;
        await connectDB();
        const user = await User.findOne({ username }).select('avatarUrl').lean();
        const m = user?.avatarUrl?.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
        if (!m) return new Response(null, { status: 404 });

        return new Response(Buffer.from(m[2], 'base64'), {
            status: 200,
            headers: {
                'Content-Type': m[1],
                // URL'dagi ?v= rasm o'zgarganda o'zgaradi, shuning uchun uzoq keshlash xavfsiz
                'Cache-Control': 'public, max-age=31536000, immutable',
            },
        });
    } catch (e) {
        console.error('Avatar GET error:', e);
        return new Response(null, { status: 500 });
    }
}

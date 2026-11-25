import { connectDB } from '../../config/mongodb.js';
import { Notification } from '../../models/Notification.js';
import { parseSession } from '../../config/adminAuth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

// So'nggi bildirishnomalar + o'qilmaganlar soni
export async function GET(req) {
    try {
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        await connectDB();

        const [items, unreadCount] = await Promise.all([
            Notification.find({ username: session.username }).sort({ createdAt: -1 }).limit(30).lean(),
            Notification.countDocuments({ username: session.username, read: false }),
        ]);
        return json({ notifications: items, unreadCount });
    } catch (e) {
        console.error('Notifications GET error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// Body: { id } — bittasini o'qilgan qiladi, { all: true } — hammasini
export async function POST(req) {
    try {
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        const { id, all } = await req.json();
        await connectDB();

        if (all) {
            await Notification.updateMany({ username: session.username, read: false }, { $set: { read: true } });
        } else if (id) {
            await Notification.updateOne({ _id: id, username: session.username }, { $set: { read: true } });
        } else {
            return json({ message: "Noto'g'ri so'rov" }, 400);
        }
        return json({ ok: true });
    } catch (e) {
        console.error('Notifications POST error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

// Hammasini tozalash
export async function DELETE(req) {
    try {
        const session = parseSession(req.headers.get('cookie'));
        if (!session?.username) return json({ message: 'Kirish kerak' }, 401);
        await connectDB();
        await Notification.deleteMany({ username: session.username });
        return json({ ok: true });
    } catch (e) {
        console.error('Notifications DELETE error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

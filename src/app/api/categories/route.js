import { connectDB } from '../config/mongodb.js';
import { Category } from '../models/Category.js';
import { Question } from '../models/Question.js';
import { isAdmin } from '../config/adminAuth.js';
import { DEFAULT_CATEGORIES } from '../../../lib/categoryStyle.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Kategoriya hujjati bo'lmagan, lekin savollarda bor nomlarni ham yaratib qo'yamiz
async function ensureCategories() {
    const [existing, used] = await Promise.all([
        Category.find().select('name').lean(),
        Question.distinct('category'),
    ]);
    const have = new Set(existing.map(c => c.name.toLowerCase()));
    const toCreate = [];
    if (existing.length === 0) {
        DEFAULT_CATEGORIES.forEach(c => { toCreate.push(c); have.add(c.name.toLowerCase()); });
    }
    used.forEach(n => {
        if (n && !have.has(n.toLowerCase())) { toCreate.push({ name: n }); have.add(n.toLowerCase()); }
    });
    if (toCreate.length) await Category.insertMany(toCreate, { ordered: false }).catch(() => {});
}

export async function GET(req) {
    try {
        await connectDB();
        await ensureCategories();
        const [cats, stats] = await Promise.all([
            Category.find().sort({ name: 1 }).lean(),
            // Asosiy va qo'shimcha library alohida sanaladi
            Question.aggregate([{
                $group: {
                    _id: { category: '$category', pool: { $cond: [{ $eq: ['$pool', 'extra'] }, 'extra', 'main'] } },
                    count: { $sum: 1 },
                    totalXp: { $sum: '$xpReward' },
                    difficulties: { $push: '$difficulty' },
                },
            }]),
        ]);
        const map = new Map(stats.map(s => [`${s._id.pool}:${s._id.category}`, s]));
        const summarize = (s) => {
            const diffCounts = { Easy: 0, Medium: 0, Hard: 0 };
            (s?.difficulties || []).forEach(d => { if (d in diffCounts) diffCounts[d]++; });
            let difficulty = 'Easy';
            if (diffCounts.Hard > 0) difficulty = 'Hard';
            else if (diffCounts.Medium > 0) difficulty = 'Medium';
            return { count: s?.count || 0, totalXp: s?.totalXp || 0, diffCounts, difficulty };
        };
        // Qo'shimcha library haqidagi ma'lumot faqat adminga yuboriladi
        const admin = isAdmin(req);
        const categories = cats.map(c => {
            if (!admin) {
                // Nashr qilinmagan library'ning faqat nomi va ko'rinishi yuboriladi
                return c.published === false
                    ? { ...c, ...summarize(), comingSoon: true }
                    : { ...c, ...summarize(map.get(`main:${c.name}`)) };
            }
            const extra = summarize(map.get(`extra:${c.name}`));
            return { ...c, ...summarize(map.get(`main:${c.name}`)), extra, extraCount: extra.count };
        });
        return json({ categories });
    } catch (e) {
        console.error('Categories GET error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

export async function POST(req) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        await connectDB();
        const { name, icon, color, description } = await req.json();
        if (!name?.trim()) return json({ message: 'Nom majburiy' }, 400);
        const dup = await Category.findOne({ name: new RegExp(`^${esc(name.trim())}$`, 'i') });
        if (dup) return json({ message: 'Bunday nomli library bor' }, 409);
        const cat = await Category.create({ name: name.trim(), icon, color, description, published: false });
        return json({ category: cat }, 201);
    } catch (e) {
        console.error('Categories POST error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

import { connectDB } from '../../config/mongodb.js';
import { Category } from '../../models/Category.js';
import { Question } from '../../models/Question.js';
import { isAdmin } from '../../config/adminAuth.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export async function PUT(req, { params }) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const { id } = await params;
        const { name, icon, color, description, published } = await req.json();
        await connectDB();
        const cat = await Category.findById(id);
        if (!cat) return json({ message: 'Library topilmadi' }, 404);

        const newName = name?.trim();
        if (newName && newName !== cat.name) {
            const dup = await Category.findOne({ _id: { $ne: id }, name: new RegExp(`^${esc(newName)}$`, 'i') });
            if (dup) return json({ message: 'Bunday nomli library bor' }, 409);
            // Savollardagi category nomini ham yangilaymiz
            await Question.updateMany({ category: cat.name }, { $set: { category: newName } });
            cat.name = newName;
        }
        if (icon) cat.icon = icon;
        if (color) cat.color = color;
        if (description != null) cat.description = description;
        if (typeof published === 'boolean') {
            if (published && !(await Question.exists({ category: cat.name }))) {
                return json({ message: "Bo'sh library'ni nashr qilib bo'lmaydi: avval savol qo'shing" }, 400);
            }
            cat.published = published;
        }
        await cat.save();
        return json({ category: cat });
    } catch (e) {
        console.error('Category PUT error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

export async function DELETE(req, { params }) {
    if (!isAdmin(req)) return json({ message: "Ruxsat yo'q" }, 403);
    try {
        const { id } = await params;
        await connectDB();
        const cat = await Category.findById(id);
        if (!cat) return json({ message: 'Library topilmadi' }, 404);
        const count = await Question.countDocuments({ category: cat.name });
        if (count > 0) return json({ message: `Avval ${count} ta savolni o'chiring` }, 400);
        await cat.deleteOne();
        return json({ message: "O'chirildi" });
    } catch (e) {
        console.error('Category DELETE error:', e);
        return json({ message: 'Server xatosi' }, 500);
    }
}

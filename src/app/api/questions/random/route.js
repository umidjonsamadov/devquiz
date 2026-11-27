import mongoose from 'mongoose';
import { connectDB } from '../../config/mongodb.js';
import { Question } from '../../models/Question.js';
import { parseSession, isAdmin } from '../../config/adminAuth.js';
import { retiredIds, unpublishedCategories, MAIN } from '../../config/questionPool.js';

export async function GET(req) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const limit = Math.min(10, parseInt(searchParams.get('limit') || '5'));

        // User allaqachon yetarlicha yechgan savollar Dashboard'da ham chiqmaydi
        const retired = await retiredIds(parseSession(req.headers.get('cookie'))?.username);
        const exclude = [...retired].filter(id => mongoose.isValidObjectId(id)).map(id => new mongoose.Types.ObjectId(id));

        // Admin bo'lmaganlarga faqat nashr qilingan library'larning asosiy savollari
        const visible = isAdmin(req) ? {} : { ...MAIN, category: { $nin: await unpublishedCategories() } };

        const questions = await Question.aggregate([
            { $match: { _id: { $nin: exclude }, ...visible } },
            { $sample: { size: limit } },
        ]);
        return new Response(JSON.stringify({ questions }), { status: 200 });
    } catch (error) {
        console.error('Random questions error:', error);
        return new Response(JSON.stringify({ message: 'Server xatosi' }), { status: 500 });
    }
}

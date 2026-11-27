import { Question } from '../models/Question.js';
import { Category } from '../models/Category.js';
import { QuestionProgress } from '../models/QuestionProgress.js';
import { MAIN_LIMIT, EXTRA_LIMIT, MAX_SOLVES } from '../../../lib/quizRules.js';

// `pool` maydoni yo'q eski savollar ham asosiy hisoblanadi
export const MAIN = { pool: { $ne: 'extra' } };
export const EXTRA = { pool: 'extra' };

/** Hali nashr qilinmagan library nomlari */
export async function unpublishedCategories() {
    const rows = await Category.find({ published: false }).select('name').lean();
    return rows.map(c => c.name);
}

/** Library'dagi bo'sh joylar */
export async function freeSlots(category) {
    const [main, extra] = await Promise.all([
        Question.countDocuments({ category, ...MAIN }),
        Question.countDocuments({ category, ...EXTRA }),
    ]);
    return { main: Math.max(0, MAIN_LIMIT - main), extra: Math.max(0, EXTRA_LIMIT - extra) };
}

/** Yangi savol qayerga tushadi: avval asosiy, u to'lsa qo'shimcha. Ikkalasi to'lsa null */
export async function pickPool(category) {
    const free = await freeSlots(category);
    if (free.main > 0) return 'main';
    return free.extra > 0 ? 'extra' : null;
}

/** User uchun yopilgan (MAX_SOLVES marta yechilgan) savollar ID'lari */
export async function retiredIds(username) {
    if (!username) return new Set();
    const rows = await QuestionProgress.find({ username, count: { $gte: MAX_SOLVES } }).select('questionId').lean();
    return new Set(rows.map(r => r.questionId));
}

/** Javob berilgan savollarning hisoblagichini oshiradi */
export async function recordSolves(username, questionIds) {
    const ids = [...new Set(questionIds)];
    if (!ids.length) return;
    await QuestionProgress.bulkWrite(ids.map(questionId => ({
        updateOne: {
            filter: { _id: `${username}:${questionId}` },
            update: {
                $inc: { count: 1 },
                $set: { lastAt: new Date() },
                $setOnInsert: { username, questionId },
            },
            upsert: true,
        },
    })), { ordered: false });
}

/**
 * Userning shaxsiy library'si.
 *  - main: asosiy savollar; yopilganlarining o'rni qo'shimcha savollar bilan to'ldiriladi
 *  - extra: qo'shimcha savollarning yopilmaganlari
 * @returns {Promise<{ questions: object[], hidden: number, replaced: number }>}
 */
export async function userLibrary(categoryFilter, pool, username) {
    const [questions, progress] = await Promise.all([
        Question.find({ category: categoryFilter, ...(pool === 'extra' ? EXTRA : MAIN) }).lean(),
        username ? QuestionProgress.find({ username }).select('questionId count').lean() : [],
    ]);
    const solves = new Map(progress.map(p => [p.questionId, p.count]));
    const open = (q) => (solves.get(String(q._id)) || 0) < MAX_SOLVES;

    const visible = questions.filter(open);
    const hidden = questions.length - visible.length;
    if (pool === 'extra' || hidden === 0) return { questions: visible, hidden, replaced: 0 };

    // O'rinbosarlar: avval user kam ko'rganlari, so'ng eskiroq qo'shilganlari
    // (tartib barqaror — ro'yxat har ochilganda almashib ketmaydi)
    const extras = await Question.find({ category: categoryFilter, ...EXTRA }).lean();
    const replacements = extras
        .filter(open)
        .sort((a, b) => (solves.get(String(a._id)) || 0) - (solves.get(String(b._id)) || 0)
            || new Date(a.createdAt) - new Date(b.createdAt)
            || String(a._id).localeCompare(String(b._id)))
        .slice(0, hidden);

    return { questions: [...visible, ...replacements], hidden, replaced: replacements.length };
}

import mongoose from 'mongoose';
import { AiDraft } from '../models/AiDraft.js';
import { Question } from '../models/Question.js';
import { pickPool } from '../config/questionPool.js';
import { XP_MIN, XP_MAX, isValidXp, normalizeXp } from '../../../lib/quizRules.js';

/**
 * Tanlangan qoralamalarni library'ga qo'shadi (asosiy to'lgan bo'lsa qo'shimchaga).
 * Har bir qoralama avval "band qilinadi", shuning uchun tugma ikki marta bosilsa ham savol takrorlanmaydi.
 */
export async function approveDrafts(ids) {
    const result = { main: 0, extra: 0, full: 0, skipped: 0 };
    for (const id of ids) {
        if (!mongoose.isValidObjectId(id)) { result.skipped++; continue; }
        const draft = await AiDraft.findOneAndUpdate(
            { _id: id, status: 'pending' }, { $set: { status: 'approving' } }, { new: true },
        ).lean();
        if (!draft) { result.skipped++; continue; }

        try {
            const pool = await pickPool(draft.category);
            if (!pool) {
                await AiDraft.updateOne({ _id: id }, { $set: { status: 'pending' } });
                result.full++;
                continue;
            }
            const { category, difficulty, question, options, correctAnswer, xpReward, time } = draft;
            // Eski qoralamalardagi past XP tasdiqlash paytida ko'tariladi
            await Question.create({
                category, difficulty, question, options, correctAnswer, time, pool, source: 'ai',
                xpReward: normalizeXp(xpReward, difficulty),
            });
            await AiDraft.deleteOne({ _id: id });
            result[pool]++;
        } catch (e) {
            await AiDraft.updateOne({ _id: id }, { $set: { status: 'pending' } });
            throw e;
        }
    }
    return result;
}

export async function rejectDrafts(ids) {
    const valid = ids.filter(id => mongoose.isValidObjectId(id));
    const { modifiedCount } = await AiDraft.updateMany(
        { _id: { $in: valid }, status: 'pending' }, { $set: { status: 'rejected' } },
    );
    return { rejected: modifiedCount };
}

// Tahrirda kelgan qiymatlarni tekshiradi: xato matni yoki null
export function validateDraft({ question, options, correctAnswer, difficulty, xpReward, time }) {
    if (typeof question !== 'string' || !question.trim()) return "Savol matni bo'sh";
    if (!Array.isArray(options) || options.length !== 4 || !options.every(o => typeof o === 'string' && o.trim())) return "4 ta variant to'ldirilishi kerak";
    if (new Set(options.map(o => o.trim())).size !== 4) return 'Variantlar takrorlanmasin';
    if (!Number.isInteger(correctAnswer) || correctAnswer < 0 || correctAnswer > 3) return "To'g'ri javob tanlanmagan";
    if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) return "Qiyinlik noto'g'ri";
    if (!isValidXp(xpReward)) return `XP ${XP_MIN}–${XP_MAX} oralig'ida bo'lsin`;
    if (!Number.isInteger(time) || time < 5 || time > 300) return 'Vaqt 5–300 soniya oralig\'ida bo\'lsin';
    return null;
}

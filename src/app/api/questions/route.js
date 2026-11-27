import { connectDB } from '../config/mongodb.js';
import { Question } from '../models/Question.js';

import { isAdmin } from '../config/adminAuth.js';
import { pickPool } from '../config/questionPool.js';
import { XP_MIN, XP_MAX, isValidXp } from '../../../lib/quizRules.js';

export async function POST(req) {
    try {
        await connectDB();

        if (!isAdmin(req)) {
            return new Response(JSON.stringify({ message: 'Forbidden' }), { status: 403 });
        }

        const { category, difficulty, question, options, correctAnswer, xpReward, time } = await req.json();
        if (!category || !question || options == null || correctAnswer == null) {
            return new Response(JSON.stringify({ message: 'Missing fields' }), { status: 400 });
        }

        if (!isValidXp(xpReward)) {
            return new Response(JSON.stringify({ message: `XP ${XP_MIN}–${XP_MAX} oralig'ida bo'lsin` }), { status: 400 });
        }

        // Asosiy library (31) to'lsa, savol qo'shimcha library'ga (999) tushadi
        const pool = await pickPool(category);
        if (!pool) {
            return new Response(JSON.stringify({ message: "Asosiy va qo'shimcha library to'lgan" }), { status: 400 });
        }

        const doc = await Question.create({ category, difficulty, question, options, correctAnswer, xpReward, time, pool });
        return new Response(JSON.stringify({ question: doc }), { status: 201 });
    } catch (error) {
        console.error('Create question error:', error);
        return new Response(JSON.stringify({ message: 'Server error' }), { status: 500 });
    }
}

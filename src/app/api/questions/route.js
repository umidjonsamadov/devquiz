import { connectDB } from '../config/mongodb.js';
import { Question } from '../models/Question.js';

import { isAdmin } from '../config/adminAuth.js';

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

        const existingCount = await Question.countDocuments({ category });
        if (existingCount >= 31) {
            return new Response(JSON.stringify({ message: 'Category already has maximum tests' }), { status: 400 });
        }

        const doc = await Question.create({ category, difficulty, question, options, correctAnswer, xpReward, time });
        return new Response(JSON.stringify({ question: doc }), { status: 201 });
    } catch (error) {
        console.error('Create question error:', error);
        return new Response(JSON.stringify({ message: 'Server error' }), { status: 500 });
    }
}

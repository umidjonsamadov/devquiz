import { connectDB } from '../../config/mongodb.js';
import { Question } from '../../models/Question.js';

import { isAdmin } from '../../config/adminAuth.js';

export async function PUT(req, { params }) {
    if (!isAdmin(req)) {
        return new Response(JSON.stringify({ message: 'Ruxsat yo\'q' }), { status: 403 });
    }
    try {
        const { id } = await params;
        const body = await req.json();
        await connectDB();
        const updated = await Question.findByIdAndUpdate(
            id,
            {
                question:      body.question,
                options:       body.options,
                correctAnswer: body.correctAnswer,
                difficulty:    body.difficulty,
                xpReward:      body.xpReward,
                time:          body.time,
            },
            { new: true }
        );
        if (!updated) return new Response(JSON.stringify({ message: 'Savol topilmadi' }), { status: 404 });
        return new Response(JSON.stringify({ question: updated }), { status: 200 });
    } catch (err) {
        console.error('Question update error:', err);
        return new Response(JSON.stringify({ message: 'Server xatosi' }), { status: 500 });
    }
}

export async function DELETE(req, { params }) {
    if (!isAdmin(req)) {
        return new Response(JSON.stringify({ message: 'Ruxsat yo\'q' }), { status: 403 });
    }
    try {
        const { id } = await params;
        await connectDB();
        const deleted = await Question.findByIdAndDelete(id);
        if (!deleted) return new Response(JSON.stringify({ message: 'Savol topilmadi' }), { status: 404 });
        return new Response(JSON.stringify({ message: 'Savol o\'chirildi' }), { status: 200 });
    } catch (err) {
        console.error('Question delete error:', err);
        return new Response(JSON.stringify({ message: 'Server xatosi' }), { status: 500 });
    }
}

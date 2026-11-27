import mongoose from 'mongoose';

// simple question schema that can be grouped by ``category`` (e.g. a
// programming language or topic).  Each document represents one test item.
//
// The ``category`` field is the value shown on the quiz cards.  ``difficulty``
// is used for sorting/labeling; multiple difficulties per category are
// tolerated and collapsed at the API level.

const questionSchema = new mongoose.Schema({
    category: { type: String, required: true, trim: true, index: true },
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' },
    question: { type: String, required: true },
    options: [{ type: String }],
    correctAnswer: { type: Number, required: true },
    xpReward: { type: Number, default: 0 },
    time: { type: Number, default: 30 },
    // Eski savollarda bu maydon yo'q — ular asosiy library'da hisoblanadi
    pool: { type: String, enum: ['main', 'extra'], default: 'main' },
    source: { type: String, enum: ['admin', 'ai'], default: 'admin' },
    createdAt: { type: Date, default: Date.now }
});

// Tez qidirish uchun compound indexlar
questionSchema.index({ category: 1, difficulty: 1 });
questionSchema.index({ category: 1, createdAt: -1 });

// ensure that we don't hit an old model when hot-reloading in dev
if (mongoose.models.Question) {
    delete mongoose.models.Question;
}

export const Question = mongoose.model('Question', questionSchema);

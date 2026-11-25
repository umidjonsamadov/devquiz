import mongoose from 'mongoose';

// Oddiy quiz (kategoriya bo'yicha) topshirilganda har bir javob saqlanadi.
// Savol matni va variantlar nusxa sifatida saqlanadi — savol keyin o'zgarsa ham tarix buzilmaydi.
const quizAttemptSchema = new mongoose.Schema({
    username: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    correct: { type: Number, default: 0 },
    incorrect: { type: Number, default: 0 },
    unanswered: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    answers: [{
        _id: false,
        questionId: String,
        question: String,
        options: [String],
        choice: { type: Number, default: null },
        correctAnswer: Number,
        isCorrect: Boolean,
    }],
    createdAt: { type: Date, default: Date.now, index: true },
});

if (mongoose.models.QuizAttempt) delete mongoose.models.QuizAttempt;
export const QuizAttempt = mongoose.model('QuizAttempt', quizAttemptSchema);

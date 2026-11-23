import mongoose from 'mongoose';

// Imtihon savoli: 'test' (variantli) yoki 'code' (amaliy, JavaScript funksiya yozish)
const examQuestionSchema = new mongoose.Schema({
    type: { type: String, enum: ['test', 'code'], default: 'test' },
    text: { type: String, required: true },
    points: { type: Number, default: 1, min: 0 },

    // type === 'test'
    options: [{ type: String }],
    correctAnswer: { type: Number, default: 0 },

    // type === 'code'
    language: { type: String, enum: ['javascript', 'python'], default: 'javascript' },
    functionName: { type: String, default: 'solution' },
    starterCode: { type: String, default: '' },
    testCases: [{
        _id: false,
        args: { type: mongoose.Schema.Types.Mixed, default: [] },      // argumentlar massivi
        expected: { type: mongoose.Schema.Types.Mixed, default: null }, // kutilgan natija
    }],
});

const examSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    durationMinutes: { type: Number, default: 60, min: 1 },
    isActive: { type: Boolean, default: false }, // admin ruxsat bergandagina talabalarga ko'rinadi
    questions: [examQuestionSchema],
    createdAt: { type: Date, default: Date.now },
});

if (mongoose.models.Exam) delete mongoose.models.Exam;
export const Exam = mongoose.model('Exam', examSchema);

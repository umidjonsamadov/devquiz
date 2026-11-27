import mongoose from 'mongoose';

// AI tuzgan, hali library'ga qo'shilmagan savollar.
// Alohida kolleksiya: quiz, Dashboard va qidiruv buni o'qimaydi, ya'ni adminsiz hech kimga ko'rinmaydi.
const aiDraftSchema = new mongoose.Schema({
    category:      { type: String, required: true },
    difficulty:    { type: String, enum: ['Easy', 'Medium', 'Hard'], required: true },
    question:      { type: String, required: true },
    options:       [{ type: String }],
    correctAnswer: { type: Number, required: true },
    xpReward:      { type: Number, default: 0 },
    time:          { type: Number, default: 30 },
    // rejected savollar saqlanadi, shunda AI ularni qayta taklif qilmaydi
    status:        { type: String, enum: ['pending', 'approving', 'rejected'], default: 'pending', index: true },
    createdAt:     { type: Date, default: Date.now },
});

aiDraftSchema.index({ category: 1, status: 1 });

if (mongoose.models.AiDraft) delete mongoose.models.AiDraft;
export const AiDraft = mongoose.model('AiDraft', aiDraftSchema);

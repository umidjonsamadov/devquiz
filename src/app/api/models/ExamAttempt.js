import mongoose from 'mongoose';

const examAttemptSchema = new mongoose.Schema({
    exam: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    username: { type: String, required: true, index: true },
    status: { type: String, enum: ['in_progress', 'finished'], default: 'in_progress' },
    startedAt: { type: Date, default: Date.now },
    finishedAt: { type: Date },
    score: { type: Number, default: 0 },
    maxScore: { type: Number, default: 0 },
    violations: { type: Number, default: 0 },
    finishReason: { type: String, default: '' }, // submitted | time | violations
    // { [questionId]: { choice?, code?, passed?, total?, earned } }
    answers: { type: mongoose.Schema.Types.Mixed, default: {} },
});

examAttemptSchema.index({ exam: 1, username: 1 }, { unique: true });

if (mongoose.models.ExamAttempt) delete mongoose.models.ExamAttempt;
export const ExamAttempt = mongoose.model('ExamAttempt', examAttemptSchema);

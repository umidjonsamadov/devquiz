import mongoose from 'mongoose';

// Har bir yuborilgan yechim (qabul qilingan va qilinmagan) — urinishlar statistikasi uchun
const trainSubmissionSchema = new mongoose.Schema({
    username:  { type: String, required: true },
    problemId: { type: String, required: true },
    accepted:  { type: Boolean, required: true },
    createdAt: { type: Date, default: Date.now },
});

trainSubmissionSchema.index({ username: 1, createdAt: -1 });

if (mongoose.models.TrainSubmission) {
    delete mongoose.models.TrainSubmission;
}

export const TrainSubmission = mongoose.model('TrainSubmission', trainSubmissionSchema);

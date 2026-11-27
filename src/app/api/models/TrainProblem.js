import mongoose from 'mongoose';

const trainProblemSchema = new mongoose.Schema({
    title:        { type: String, required: true, trim: true, maxlength: 120 },
    description:  { type: String, required: true, maxlength: 5000 },
    difficulty:   { type: String, enum: ['Easy', 'Medium', 'Hard'], default: 'Easy' },
    languages:    [{ type: String, enum: ['javascript', 'python'] }],
    functionName: { type: String, required: true },
    params:       [{ type: String }],
    // args va expected ixtiyoriy JSON qiymat (null, false, 0 ham bo'lishi mumkin)
    testCases: [{
        _id: false,
        args:     { type: mongoose.Schema.Types.Mixed },
        expected: { type: mongoose.Schema.Types.Mixed },
        hidden:   { type: Boolean, default: false },
    }],
    author:      { type: String, required: true, index: true },
    // false — admin hali tekshirmagan: boshqalarga "Coming soon". Yangi masala false bilan yaratiladi
    published:   { type: Boolean, default: true },
    solvedCount: { type: Number, default: 0 },
    // Username'lar to'plami: har bir odam bir marta sanaladi
    viewedBy:    [{ type: String }],
    likedBy:     [{ type: String }],
    dislikedBy:  [{ type: String }],
    createdAt:   { type: Date, default: Date.now },
}, { minimize: false }); // bo'sh obyekt {} ham test qiymati sifatida saqlansin

trainProblemSchema.index({ createdAt: -1 });

if (mongoose.models.TrainProblem) {
    delete mongoose.models.TrainProblem;
}

export const TrainProblem = mongoose.model('TrainProblem', trainProblemSchema);

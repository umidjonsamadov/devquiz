import mongoose from 'mongoose';

const trainCommentSchema = new mongoose.Schema({
    problemId: { type: String, required: true },
    username:  { type: String, required: true },
    text:      { type: String, required: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
});

trainCommentSchema.index({ problemId: 1, createdAt: -1 });

if (mongoose.models.TrainComment) {
    delete mongoose.models.TrainComment;
}

export const TrainComment = mongoose.model('TrainComment', trainCommentSchema);

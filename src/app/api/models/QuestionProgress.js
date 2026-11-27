import mongoose from 'mongoose';

// Har bir user har bir savolni necha marta yechgani
const questionProgressSchema = new mongoose.Schema({
    _id:        { type: String }, // "<username>:<questionId>" — bitta juftlikka bitta yozuv
    username:   { type: String, required: true, index: true },
    questionId: { type: String, required: true },
    count:      { type: Number, default: 0 },
    lastAt:     { type: Date, default: Date.now },
});

if (mongoose.models.QuestionProgress) delete mongoose.models.QuestionProgress;
export const QuestionProgress = mongoose.model('QuestionProgress', questionProgressSchema);

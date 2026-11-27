import mongoose from 'mongoose';

const trainSolveSchema = new mongoose.Schema({
    // "<userId>:<problemId>" — bitta masala uchun XP ikki marta berilmasligini kafolatlaydi
    _id:       { type: String },
    username:  { type: String, required: true, index: true },
    problemId: { type: String, required: true },
    language:  { type: String },
    code:      { type: String },
    // Yechilgan paytdagi qiymatlar: masala o'chirilsa ham statistika saqlanadi
    difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'] },
    xp:        { type: Number }, // o'z masalasi uchun 0
    bonusXp:   { type: Number, default: 0 }, // 1-o'rin bonusi, reyting baliga kirmaydi
    solvedAt:  { type: Date, default: Date.now },
});

if (mongoose.models.TrainSolve) {
    delete mongoose.models.TrainSolve;
}

export const TrainSolve = mongoose.model('TrainSolve', trainSolveSchema);

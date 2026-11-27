import mongoose from 'mongoose';

// AI savol generatsiyasining kunlik holati
const aiDailyRunSchema = new mongoose.Schema({
    _id:         { type: String },                 // "YYYY-MM-DD" (Toshkent vaqti)
    target:      { type: Number, required: true }, // shu kun uchun reja: 7–24
    created:     { type: Number, default: 0 },
    lockedUntil: { type: Date, default: new Date(0) }, // bir vaqtda ikkita ishga tushishdan himoya
    lastRunAt:   { type: Date, default: null },
    lastError:   { type: String, default: '' },
    stoppedSessions: [String],                     // admin "To'xtatish" bosgan ishga tushirishlar
    log:         [{ _id: false, at: Date, category: String, count: Number }],
});

if (mongoose.models.AiDailyRun) delete mongoose.models.AiDailyRun;
export const AiDailyRun = mongoose.model('AiDailyRun', aiDailyRunSchema);

import mongoose from 'mongoose';

// Bitta o'quvchining bitta savol bo'yicha bir turdagi urinishlari bitta yozuvda sanaladi
const violationSchema = new mongoose.Schema({
    _id:      { type: String },   // "<userId>:<source>:<itemId>:<type>"
    username: { type: String, required: true, index: true },
    source:   { type: String, enum: ['train', 'quiz', 'dashboard', 'exam'], required: true },
    itemId:   { type: String, default: '' },
    title:    { type: String, default: '' }, // masala nomi yoki savol matni (serverda bazadan olinadi)
    context:  { type: String, default: '' }, // library yoki imtihon nomi
    type:     { type: String, enum: ['copy', 'screenshot'], required: true },
    count:    { type: Number, default: 0 },
    methods:  [String],           // qaysi yo'l bilan urinilgan
    firstAt:  { type: Date },
    lastAt:   { type: Date, index: true },
});

if (mongoose.models.Violation) delete mongoose.models.Violation;
export const Violation = mongoose.model('Violation', violationSchema);

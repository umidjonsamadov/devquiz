import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, unique: true },
    icon: { type: String, default: 'BookOpen' },
    color: { type: String, default: 'green' },
    description: { type: String, default: '' },
    aiEnabled: { type: Boolean, default: false }, // AI shu library uchun savol tuzsinmi
    published: { type: Boolean, default: true }, // false — boshqalarga "Coming soon". Yangi library false bilan yaratiladi
    createdAt: { type: Date, default: Date.now },
});

if (mongoose.models.Category) delete mongoose.models.Category;
export const Category = mongoose.model('Category', categorySchema);
